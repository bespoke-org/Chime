import {
  FormStatus,
  type Form,
  type FormBlock,
  type FormBlockType as PrismaFormBlockType,
  type Prisma,
} from "@prisma/client";

import {
  getDefaultBlockConfig,
  isQuestionBlock,
  serializeBlock,
} from "@/lib/blocks";
import {
  getBranchValidationIssueI18n,
  validateBranchingGraph,
} from "@/lib/branching";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  getFormAvailability,
  type FormAvailability,
} from "@/lib/form-availability";
import { getLocalizedCompletionDefaults } from "@/lib/form-defaults";
import {
  assertReorderMatchesForm,
  buildSubmission,
  parseSubmissionPayload,
} from "@/lib/form-submission";
import type {
  ActiveWorkspace,
  BuilderForm,
  FormListItem,
  PublicForm,
  ResponseDetail,
  ResponseReviewData,
  WorkspaceReference,
} from "@/lib/form-types";
import {
  blockUpdateSchema,
  createBlockSchema,
  formMetadataSchema,
  publishFormSchema,
  reorderBlocksSchema,
} from "@/lib/validators";
import { slugify } from "@/lib/utils";
import { buildWebhookPayload, getWebhookDeliverer } from "@/lib/webhooks";
import { notifyOwnerOfResponse } from "@/lib/response-notifications";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  translate,
  type AppLocale,
} from "@/lib/i18n";
import { getMessages } from "@/lib/i18n-server";
import { normalizeBlockConfig } from "@/lib/block-config-normalization";
import { getObjectStorage } from "@/lib/object-storage";
import {
  buildUploadKey,
  collectFileUploadAnswers,
  DOWNLOAD_URL_TTL_SECONDS,
  parseUploadRequest,
  UPLOAD_URL_TTL_SECONDS,
  verifyUploadForAnswer,
  type FileUploadAnswer,
} from "@/lib/uploads";
import {
  buildResponseDetailData,
  buildResponseReviewData,
} from "@/lib/response-review";
import {
  assertOrganizationMember,
  workspaceAccessWhere,
  workspaceFilterWhere,
} from "@/lib/workspaces";

const FORM_BLOCK_TYPES = {
  TEXT: "TEXT",
  SHORT_TEXT: "SHORT_TEXT",
  LONG_TEXT: "LONG_TEXT",
  SINGLE_CHOICE: "SINGLE_CHOICE",
  MULTIPLE_CHOICE: "MULTIPLE_CHOICE",
  NUMBER: "NUMBER",
  LINK: "LINK",
  AGREEMENT: "AGREEMENT",
  DATE: "DATE",
  RATING: "RATING",
  FILE_UPLOAD: "FILE_UPLOAD",
} as const satisfies Record<PrismaFormBlockType, PrismaFormBlockType>;

const builderFormInclude = {
  organization: {
    select: {
      id: true,
      name: true,
    },
  },
  user: {
    select: {
      notificationEmail: true,
    },
  },
  blocks: {
    orderBy: {
      position: "asc",
    },
  },
  _count: {
    select: {
      responses: true,
    },
  },
} satisfies Prisma.FormInclude;

type BuilderFormRecord = Form &
  Prisma.FormGetPayload<{
    include: typeof builderFormInclude;
  }>;

export type {
  BuilderForm,
  FormListItem,
  PublicForm,
  ResponseDetail,
  ResponseListItem,
} from "@/lib/form-types";

function toWorkspaceReference(form: {
  organizationId: string | null;
  organization: { id: string; name: string } | null;
}): WorkspaceReference {
  if (form.organizationId && form.organization) {
    return {
      kind: "organization",
      organizationId: form.organizationId,
      label: form.organization.name,
    };
  }

  return {
    kind: "personal",
    label: "Personal workspace",
  };
}

function toBuilderForm(form: BuilderFormRecord): BuilderForm {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    completionTitle: form.completionTitle,
    completionMessage: form.completionMessage,
    completionLinkLabel: form.completionLinkLabel,
    completionLinkUrl: form.completionLinkUrl,
    respondentLocale: form.respondentLocale
      ? normalizeLocale(form.respondentLocale)
      : null,
    showProgress: form.showProgress,
    allowBackNavigation: form.allowBackNavigation,
    webhookUrl: form.webhookUrl,
    webhookSecret: form.webhookSecret,
    closesAt: form.closesAt ? form.closesAt.toISOString() : null,
    maxResponses: form.maxResponses,
    closedManually: form.closedManually,
    closedMessage: form.closedMessage,
    notifyOnResponse: form.notifyOnResponse,
    ownerHasNotificationEmail: Boolean(form.user.notificationEmail),
    slug: form.slug,
    status: form.status,
    updatedAt: form.updatedAt.toISOString(),
    responseCount: form._count.responses,
    workspace: toWorkspaceReference(form),
    blocks: form.blocks.map(serializeBlock),
  };
}

function toPublicForm(form: Form & { blocks: FormBlock[] }): PublicForm {
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    completionTitle: form.completionTitle,
    completionMessage: form.completionMessage,
    completionLinkLabel: form.completionLinkLabel,
    completionLinkUrl: form.completionLinkUrl,
    respondentLocale: form.respondentLocale
      ? normalizeLocale(form.respondentLocale)
      : null,
    showProgress: form.showProgress,
    allowBackNavigation: form.allowBackNavigation,
    closedMessage: form.closedMessage,
    slug: form.slug,
    blocks: form.blocks.map(serializeBlock),
  };
}

// Counts responses only when a cap is set, so forms without one cost no
// extra query on every public page view or submission.
async function resolveFormAvailability(
  form: Pick<
    Form,
    "id" | "status" | "closesAt" | "maxResponses" | "closedManually"
  >,
  now = new Date(),
): Promise<FormAvailability> {
  const responseCount =
    form.maxResponses === null
      ? 0
      : await db.response.count({ where: { formId: form.id } });

  return getFormAvailability(form, responseCount, now);
}

const defaultFormCopyByLocale: Record<
  AppLocale,
  {
    untitledForm: string;
    completionTitle: string;
    completionMessage: string;
    initialBlocks: Prisma.FormBlockCreateWithoutFormInput[];
    newBlockTitles: Record<PrismaFormBlockType, string>;
  }
> = {
  en: {
    untitledForm: "Untitled form",
    completionTitle: getLocalizedCompletionDefaults("en").title,
    completionMessage: getLocalizedCompletionDefaults("en").message,
    initialBlocks: [
      {
        type: FORM_BLOCK_TYPES.TEXT,
        title: "Welcome",
        description: "Set the scene before people start answering.",
        position: 0,
        required: false,
        config: getDefaultBlockConfig(FORM_BLOCK_TYPES.TEXT, "en"),
      },
      {
        type: FORM_BLOCK_TYPES.SHORT_TEXT,
        title: "What should we call you?",
        description: "A simple first question keeps the flow moving.",
        position: 1,
        required: true,
        config: getDefaultBlockConfig(FORM_BLOCK_TYPES.SHORT_TEXT, "en"),
      },
    ],
    newBlockTitles: {
      TEXT: "Section note",
      SHORT_TEXT: "Short text question",
      LONG_TEXT: "Long text question",
      SINGLE_CHOICE: "Single choice question",
      MULTIPLE_CHOICE: "Multiple choice question",
      NUMBER: "Number question",
      LINK: "Link question",
      AGREEMENT: "Agreement question",
      DATE: "Date question",
      RATING: "Rating question",
      FILE_UPLOAD: "File upload question",
    },
  },
  ru: {
    untitledForm: "Форма без названия",
    completionTitle: getLocalizedCompletionDefaults("ru").title,
    completionMessage: getLocalizedCompletionDefaults("ru").message,
    initialBlocks: [
      {
        type: FORM_BLOCK_TYPES.TEXT,
        title: "Добро пожаловать",
        description: "Задайте тон перед тем, как люди начнут отвечать.",
        position: 0,
        required: false,
        config: getDefaultBlockConfig(FORM_BLOCK_TYPES.TEXT, "ru"),
      },
      {
        type: FORM_BLOCK_TYPES.SHORT_TEXT,
        title: "Как к вам обращаться?",
        description: "Простой первый вопрос помогает сохранить ритм.",
        position: 1,
        required: true,
        config: getDefaultBlockConfig(FORM_BLOCK_TYPES.SHORT_TEXT, "ru"),
      },
    ],
    newBlockTitles: {
      TEXT: "Текстовый блок",
      SHORT_TEXT: "Вопрос с коротким ответом",
      LONG_TEXT: "Вопрос с длинным ответом",
      SINGLE_CHOICE: "Вопрос с одним выбором",
      MULTIPLE_CHOICE: "Вопрос с несколькими вариантами",
      NUMBER: "Вопрос с числом",
      LINK: "Вопрос со ссылкой",
      AGREEMENT: "Вопрос с согласием",
      DATE: "Вопрос с датой",
      RATING: "Вопрос с оценкой",
      FILE_UPLOAD: "Вопрос с файлом",
    },
  },
};

function getDefaultFormCopy(locale: AppLocale = DEFAULT_LOCALE) {
  return (
    defaultFormCopyByLocale[locale] ?? defaultFormCopyByLocale[DEFAULT_LOCALE]
  );
}

function initialBlocks(
  locale: AppLocale = DEFAULT_LOCALE,
): Prisma.FormBlockCreateWithoutFormInput[] {
  return getDefaultFormCopy(locale).initialBlocks;
}

async function ensureUniqueSlug(
  slug: string,
  exceptFormId?: string,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const existing = await db.form.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing && existing.id !== exceptFormId) {
    const messages = await getMessages(locale);
    throw new AppError(
      translate(messages, "builder.toasts.shareUrlTaken"),
      409,
    );
  }
}

async function createUniqueSlug(seed: string) {
  const base = slugify(seed) || "form";
  let slug = base;
  let attempt = 0;

  while (attempt < 20) {
    const existing = await db.form.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    attempt += 1;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function assertAccessibleForm(userId: string, formId: string) {
  const form = await db.form.findFirst({
    where: {
      id: formId,
      ...workspaceAccessWhere(userId),
    },
    include: builderFormInclude,
  });

  if (!form) {
    throw new AppError("Form not found.", 404);
  }

  return form;
}

export async function listFormsForWorkspace(
  userId: string,
  workspace: ActiveWorkspace,
): Promise<FormListItem[]> {
  if (workspace.kind === "organization") {
    await assertOrganizationMember(userId, workspace.organizationId);
  }

  const forms = await db.form.findMany({
    where: workspaceFilterWhere(userId, workspace),
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          responses: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const now = new Date();

  return forms.map((form) => ({
    id: form.id,
    title: form.title,
    description: form.description,
    slug: form.slug,
    status: form.status,
    closed: !getFormAvailability(form, form._count.responses, now).open,
    updatedAt: form.updatedAt.toISOString(),
    responseCount: form._count.responses,
    workspace: toWorkspaceReference(form),
  }));
}

export async function createDraftForm(
  userId: string,
  workspace: ActiveWorkspace,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  if (workspace.kind === "organization") {
    await assertOrganizationMember(userId, workspace.organizationId);
  }

  const slug = await createUniqueSlug(
    `untitled-form-${Math.random().toString(36).slice(2, 6)}`,
  );

  const copy = getDefaultFormCopy(locale);

  const form = await db.form.create({
    data: {
      userId,
      organizationId:
        workspace.kind === "organization" ? workspace.organizationId : null,
      title: copy.untitledForm,
      description: "",
      completionTitle: copy.completionTitle,
      completionMessage: copy.completionMessage,
      showProgress: true,
      allowBackNavigation: true,
      slug,
      blocks: {
        create: initialBlocks(locale),
      },
    },
    include: builderFormInclude,
  });

  return toBuilderForm(form);
}

export async function getOwnedFormForBuilder(userId: string, formId: string) {
  const form = await assertAccessibleForm(userId, formId);
  return toBuilderForm(form);
}

export async function updateOwnedFormMetadata(
  userId: string,
  formId: string,
  payload: unknown,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const parsed = formMetadataSchema.parse(payload);
  await assertAccessibleForm(userId, formId);
  await ensureUniqueSlug(parsed.slug, formId, locale);

  const form = await db.form.update({
    where: { id: formId },
    data: parsed,
    include: builderFormInclude,
  });

  return toBuilderForm(form);
}

export async function deleteOwnedForm(userId: string, formId: string) {
  await assertAccessibleForm(userId, formId);

  await db.form.delete({
    where: { id: formId },
  });
}

export async function setOwnedFormPublished(
  userId: string,
  formId: string,
  payload: unknown,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const parsed = publishFormSchema.parse(payload);
  const form = await assertAccessibleForm(userId, formId);

  if (parsed.published && form.blocks.length === 0) {
    throw new AppError("Add at least one block before publishing.", 422);
  }

  if (parsed.published) {
    const branchValidationIssues = validateBranchingGraph(
      form.blocks.map(serializeBlock),
    );

    if (branchValidationIssues.length > 0) {
      const messages = await getMessages(locale);
      const issueI18n = getBranchValidationIssueI18n(
        branchValidationIssues[0],
        form.blocks.map(serializeBlock),
      );
      throw new AppError(
        translate(messages, issueI18n.key, issueI18n.values),
        422,
      );
    }
  }

  const updated = await db.form.update({
    where: { id: formId },
    data: {
      status: parsed.published ? FormStatus.PUBLISHED : FormStatus.DRAFT,
    },
    include: builderFormInclude,
  });

  return toBuilderForm(updated);
}

export async function addOwnedBlock(
  userId: string,
  formId: string,
  payload: unknown,
  locale: AppLocale = DEFAULT_LOCALE,
) {
  const parsed = createBlockSchema.parse(payload);
  const form = await assertAccessibleForm(userId, formId);
  const position = form.blocks.length;

  const titleByType = getDefaultFormCopy(locale).newBlockTitles;

  const created = await db.formBlock.create({
    data: {
      formId,
      type: parsed.type,
      title: titleByType[parsed.type],
      description: "",
      required: false,
      position,
      config: getDefaultBlockConfig(parsed.type, locale),
    },
  });

  return serializeBlock(created);
}

export async function updateOwnedBlock(
  userId: string,
  formId: string,
  blockId: string,
  payload: unknown,
) {
  const parsed = blockUpdateSchema.parse(payload);
  await assertAccessibleForm(userId, formId);

  const block = await db.formBlock.findFirst({
    where: {
      id: blockId,
      formId,
    },
  });

  if (!block) {
    throw new AppError("Block not found.", 404);
  }

  const config = normalizeBlockConfig(block.type, parsed.config);
  const updated = await db.formBlock.update({
    where: { id: blockId },
    data: {
      title: parsed.title,
      description: parsed.description,
      required: isQuestionBlock(block.type) ? parsed.required : false,
      config,
    },
  });

  return serializeBlock(updated);
}

export async function deleteOwnedBlock(
  userId: string,
  formId: string,
  blockId: string,
) {
  await assertAccessibleForm(userId, formId);

  const block = await db.formBlock.findFirst({
    where: {
      id: blockId,
      formId,
    },
  });

  if (!block) {
    throw new AppError("Block not found.", 404);
  }

  await db.$transaction(async (tx) => {
    await tx.formBlock.delete({
      where: { id: blockId },
    });

    const remainingBlocks = await tx.formBlock.findMany({
      where: { formId },
      orderBy: { position: "asc" },
    });

    await Promise.all(
      remainingBlocks.map((remainingBlock, index) =>
        tx.formBlock.update({
          where: { id: remainingBlock.id },
          data: { position: index },
        }),
      ),
    );
  });
}

export async function reorderOwnedBlocks(
  userId: string,
  formId: string,
  payload: unknown,
) {
  const parsed = reorderBlocksSchema.parse(payload);
  const form = await assertAccessibleForm(userId, formId);

  assertReorderMatchesForm(
    form.blocks.map((block) => block.id),
    parsed.blockIds,
  );

  await db.$transaction(
    parsed.blockIds.map((blockId, index) =>
      db.formBlock.update({
        where: { id: blockId },
        data: { position: index },
      }),
    ),
  );

  return getOwnedFormForBuilder(userId, formId);
}

export async function getPublicFormBySlug(slug: string) {
  const form = await db.form.findFirst({
    where: {
      slug,
      status: FormStatus.PUBLISHED,
    },
    include: {
      blocks: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!form) {
    return null;
  }

  return {
    form: toPublicForm(form),
    availability: await resolveFormAvailability(form),
  };
}

export async function createAnonymousResponse(slug: string, payload: unknown) {
  const answersInput = parseSubmissionPayload(payload);
  const form = await db.form.findFirst({
    where: {
      slug,
      status: FormStatus.PUBLISHED,
    },
    include: {
      blocks: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!form) {
    throw new AppError("This form is not accepting responses right now.", 404);
  }

  const { normalizedAnswers, snapshot } = buildSubmission(
    form.blocks.map(serializeBlock),
    answersInput,
  );

  // Checked right before the insert. Two submissions that both pass the
  // count can still exceed the cap by one; that is accepted.
  const availability = await resolveFormAvailability(form);

  if (!availability.open) {
    throw new AppError("This form is no longer accepting responses.", 410);
  }

  const fileAnswers = collectFileUploadAnswers(snapshot, normalizedAnswers);
  const responseData = {
    formId: form.id,
    answersJson: normalizedAnswers,
    formSnapshotJson: snapshot,
  };

  const response = fileAnswers.length
    ? await createResponseWithUploads(form.id, responseData, fileAnswers)
    : await db.response.create({ data: responseData });

  if (form.webhookUrl) {
    // Delivery runs in the background and never throws, so the stored
    // response and the HTTP answer do not depend on the webhook endpoint.
    void getWebhookDeliverer()({
      url: form.webhookUrl,
      secret: form.webhookSecret,
      payload: buildWebhookPayload(
        form,
        {
          id: response.id,
          submittedAt: response.submittedAt,
          answers: normalizedAnswers,
        },
        snapshot,
      ),
    });
  }

  // Same rule as the webhook: the email is sent in the background and a
  // failure there never reaches the respondent.
  void notifyOwnerOfResponse({
    form,
    response: { id: response.id, answers: normalizedAnswers },
    snapshot,
  });

  return response;
}

// Every file answer must name a pending upload of this form and block whose
// object exists in storage within the block's limit; otherwise the whole
// submission is rejected. The response and the status flip to ATTACHED are
// written in one transaction so an upload can never be attached twice.
async function createResponseWithUploads(
  formId: string,
  responseData: Prisma.ResponseUncheckedCreateInput,
  fileAnswers: FileUploadAnswer[],
) {
  const storage = getObjectStorage();

  if (!storage) {
    throw new AppError("File uploads are not available right now.", 503);
  }

  const uploads = await db.upload.findMany({
    where: { id: { in: fileAnswers.map((answer) => answer.uploadId) } },
  });
  const uploadsById = new Map(uploads.map((upload) => [upload.id, upload]));

  for (const answer of fileAnswers) {
    const upload = uploadsById.get(answer.uploadId) ?? null;
    const head =
      upload && upload.formId === formId && upload.status === "PENDING"
        ? await storage.headObject(upload.key)
        : null;
    const verdict = verifyUploadForAnswer({ answer, formId, upload, head });

    if (!verdict.ok) {
      throw new AppError("The uploaded file could not be verified.", 422);
    }
  }

  return db.$transaction(async (tx) => {
    const response = await tx.response.create({ data: responseData });
    const attached = await tx.upload.updateMany({
      where: {
        id: { in: fileAnswers.map((answer) => answer.uploadId) },
        formId,
        status: "PENDING",
      },
      data: {
        status: "ATTACHED",
        responseId: response.id,
        attachedAt: new Date(),
      },
    });

    if (attached.count !== fileAnswers.length) {
      throw new AppError("The uploaded file could not be verified.", 422);
    }

    return response;
  });
}

// Issues a presigned PUT for one file of a published, open form. The Upload
// row is created PENDING; the submission later attaches it.
export async function requestAnonymousUpload(slug: string, payload: unknown) {
  const storage = getObjectStorage();

  if (!storage) {
    throw new AppError("File uploads are not available right now.", 503);
  }

  const form = await db.form.findFirst({
    where: {
      slug,
      status: FormStatus.PUBLISHED,
    },
    include: {
      blocks: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!form) {
    throw new AppError("This form is not accepting responses right now.", 404);
  }

  const availability = await resolveFormAvailability(form);

  if (!availability.open) {
    throw new AppError("This form is no longer accepting responses.", 410);
  }

  const request = parseUploadRequest(form.blocks.map(serializeBlock), payload);
  const uploadId = crypto.randomUUID().replaceAll("-", "");
  const key = buildUploadKey({
    formId: form.id,
    blockId: request.blockId,
    uploadId,
    filename: request.filename,
  });

  const upload = await db.upload.create({
    data: {
      id: uploadId,
      formId: form.id,
      blockId: request.blockId,
      key,
      filename: request.filename,
      contentType: request.contentType,
      size: request.size,
    },
  });

  const url = await storage.createUploadUrl({
    key,
    contentType: request.contentType,
    contentLength: request.size,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });

  return {
    uploadId: upload.id,
    url,
    method: "PUT" as const,
    headers: { "content-type": request.contentType },
    expiresAt: new Date(
      Date.now() + UPLOAD_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };
}

// A short-lived presigned GET for a file attached to a response of a form
// the user can access.
export async function getOwnedUploadDownloadUrl(
  userId: string,
  formId: string,
  uploadId: string,
) {
  await assertAccessibleForm(userId, formId);

  const upload = await db.upload.findFirst({
    where: { id: uploadId, formId, status: "ATTACHED" },
  });

  if (!upload) {
    throw new AppError("File not found.", 404);
  }

  const storage = getObjectStorage();

  if (!storage) {
    throw new AppError("File downloads are not available right now.", 503);
  }

  return storage.createDownloadUrl({
    key: upload.key,
    filename: upload.filename,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
  });
}

export async function listResponsesForOwnedForm(
  userId: string,
  formId: string,
): Promise<ResponseReviewData> {
  const form = await assertAccessibleForm(userId, formId);
  const responses = await db.response.findMany({
    where: {
      formId,
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
  });

  return buildResponseReviewData({
    form: {
      id: form.id,
      title: form.title,
      workspace: toWorkspaceReference(form),
      blocks: form.blocks.map(serializeBlock),
    },
    responses,
  });
}

export async function getOwnedResponseDetail(
  userId: string,
  formId: string,
  responseId: string,
): Promise<ResponseDetail> {
  await assertAccessibleForm(userId, formId);

  const response = await db.response.findFirst({
    where: {
      id: responseId,
      formId,
      form: workspaceAccessWhere(userId),
    },
    include: {
      form: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          blocks: {
            orderBy: {
              position: "asc",
            },
          },
        },
      },
    },
  });

  if (!response) {
    throw new AppError("Response not found.", 404);
  }

  const uploads = await db.upload.findMany({
    where: { responseId: response.id, status: "ATTACHED" },
    select: { id: true, filename: true, contentType: true, size: true },
  });

  const submissionNumber = await db.response.count({
    where: {
      formId,
      OR: [
        {
          submittedAt: {
            lt: response.submittedAt,
          },
        },
        {
          submittedAt: response.submittedAt,
          id: {
            lte: response.id,
          },
        },
      ],
    },
  });

  return buildResponseDetailData({
    responseId: response.id,
    formId,
    submittedAt: response.submittedAt,
    submissionNumber,
    formTitle: response.form.title,
    workspace: toWorkspaceReference(response.form),
    answersJson: response.answersJson,
    formSnapshotJson: response.formSnapshotJson,
    currentBlocks: response.form.blocks.map(serializeBlock),
    uploads,
  });
}
