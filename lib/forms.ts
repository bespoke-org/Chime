import {
  FormStatus,
  type Form,
  type FormBlock,
  type FormBlockType as PrismaFormBlockType,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";

import {
  getDefaultBlockConfig,
  isQuestionBlock,
  serializeBlock,
  type SerializedBlock,
} from "@/lib/blocks";
import {
  getBranchValidationIssueI18n,
  validateBranchingGraph,
  resolveNextBlockId,
} from "@/lib/branching";
import { validateAndNormalizeAnswer } from "@/lib/answer-validation";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getLocalizedCompletionDefaults } from "@/lib/form-defaults";
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
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  translate,
  type AppLocale,
} from "@/lib/i18n";
import { getMessages } from "@/lib/i18n-server";
import { normalizeBlockConfig } from "@/lib/block-config-normalization";
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
} as const satisfies Record<PrismaFormBlockType, PrismaFormBlockType>;

const builderFormInclude = {
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
    slug: form.slug,
    blocks: form.blocks.map(serializeBlock),
  };
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

function getQuestionLabel(block: SerializedBlock) {
  return block.title || "this question";
}

function normalizeAnswer(
  block: SerializedBlock,
  rawValue: unknown,
): string | string[] | undefined {
  const questionLabel = getQuestionLabel(block);
  const result = validateAndNormalizeAnswer(block, rawValue);

  if (result.ok) {
    return result.value;
  }

  switch (result.error.code) {
    case "answer_required":
      if (block.type === FORM_BLOCK_TYPES.NUMBER) {
        throw new AppError(
          `Please enter a number for “${questionLabel}”.`,
          422,
        );
      }

      if (block.type === FORM_BLOCK_TYPES.LINK) {
        throw new AppError(`Please enter a link for “${questionLabel}”.`, 422);
      }

      if (block.type === FORM_BLOCK_TYPES.DATE) {
        throw new AppError(`Please enter a date for “${questionLabel}”.`, 422);
      }

      throw new AppError(`Please answer “${questionLabel}”.`, 422);
    case "single_choice_required":
      throw new AppError(
        `Please choose an option for “${questionLabel}”.`,
        422,
      );
    case "multi_choice_required":
      throw new AppError(
        `Please choose at least one option for “${questionLabel}”.`,
        422,
      );
    case "agreement_required":
      throw new AppError(`Agreement is required for “${questionLabel}”.`, 422);
    case "invalid_text_format":
      throw new AppError(
        `Please use a valid format for “${questionLabel}”.`,
        422,
      );
    case "invalid_option":
      throw new AppError(
        `Invalid option submitted for “${questionLabel}”.`,
        422,
      );
    case "invalid_number":
      throw new AppError(
        `Please enter a valid number for “${questionLabel}”.`,
        422,
      );
    case "whole_number_required":
      throw new AppError(
        `Please enter a whole number for “${questionLabel}”.`,
        422,
      );
    case "number_below_min":
      throw new AppError(
        `Please enter a number greater than or equal to ${result.error.min} for “${questionLabel}”.`,
        422,
      );
    case "number_above_max":
      throw new AppError(
        `Please enter a number less than or equal to ${result.error.max} for “${questionLabel}”.`,
        422,
      );
    case "invalid_link":
      throw new AppError(
        `Please enter a valid link for “${questionLabel}”.`,
        422,
      );
    case "invalid_date":
      throw new AppError(
        `Please enter a valid date for “${questionLabel}”.`,
        422,
      );
    case "invalid_agreement":
      throw new AppError(
        `Invalid agreement value submitted for “${questionLabel}”.`,
        422,
      );
  }
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

  return forms.map((form) => ({
    id: form.id,
    title: form.title,
    description: form.description,
    slug: form.slug,
    status: form.status,
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

  const currentIds = form.blocks.map((block) => block.id).sort();
  const nextIds = [...parsed.blockIds].sort();

  if (
    currentIds.length !== nextIds.length ||
    currentIds.some((id, index) => id !== nextIds[index])
  ) {
    throw new AppError(
      "Block reorder payload is out of sync with the current form.",
      409,
    );
  }

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

  return toPublicForm(form);
}

export async function createAnonymousResponse(slug: string, payload: unknown) {
  const answersInput = z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .parse(payload);
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

  const blocks = form.blocks.map(serializeBlock);
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const normalizedAnswers: Record<string, string | string[]> = {};
  const visitedBlocks: SerializedBlock[] = [];

  let currentBlock: SerializedBlock | undefined = blocks[0];
  let safetyCounter = 0;

  while (currentBlock && safetyCounter < blocks.length) {
    visitedBlocks.push(currentBlock);

    const answer = normalizeAnswer(currentBlock, answersInput[currentBlock.id]);

    if (typeof answer !== "undefined") {
      normalizedAnswers[currentBlock.id] = answer;
    }

    const nextBlockId = resolveNextBlockId(
      blocks,
      currentBlock.id,
      normalizedAnswers,
    );
    currentBlock = nextBlockId ? blocksById.get(nextBlockId) : undefined;
    safetyCounter += 1;
  }

  const response = await db.response.create({
    data: {
      formId: form.id,
      answersJson: normalizedAnswers,
      formSnapshotJson: visitedBlocks.map((block) => ({
        id: block.id,
        type: block.type,
        title: block.title,
        description: block.description,
        required: block.required,
        position: block.position,
        config: block.config,
      })),
    },
  });

  return response;
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
  });
}
