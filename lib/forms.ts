import {
  FormStatus,
  type Form,
  type FormBlock,
  type FormBlockType as PrismaFormBlockType,
  type Prisma,
} from "@prisma/client";
import { z } from "zod";

import {
  AGREEMENT_ANSWER_VALUES,
  blockTypeSchema,
  getDefaultBlockConfig,
  isAgreementAnswerValue,
  isChoiceBlock,
  isQuestionBlock,
  isTextAnswerBlock,
  isValidDateAnswer,
  isValidLinkAnswer,
  parseBlockConfig,
  parseNumericAnswer,
  serializeBlock,
  type BlockConfig,
  type ChoiceBlockConfig,
  type NumberBlockConfig,
  type SerializedBlock,
  type TextAnswerBlockConfig,
} from "@/lib/blocks";
import {
  getBranchValidationIssueI18n,
  validateBranchingGraph,
  resolveNextBlockId,
} from "@/lib/branching";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getLocalizedCompletionDefaults } from "@/lib/form-defaults";
import type {
  ActiveWorkspace,
  BuilderForm,
  FormListItem,
  PublicForm,
  ResponseDetail,
  ResponseListItem,
  ResponseReviewFormSummary,
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
import { DEFAULT_LOCALE, translate, type AppLocale } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n-server";
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

type BuilderFormRecord = Prisma.FormGetPayload<{
  include: typeof builderFormInclude;
}>;

type ResponseRecord = Prisma.ResponseGetPayload<{
  include: {
    form: {
      include: {
        organization: {
          select: {
            id: true;
            name: true;
          };
        };
        blocks: {
          orderBy: {
            position: "asc";
          };
        };
      };
    };
  };
}>;

const snapshotBlockSchema = z.object({
  id: z.string(),
  type: blockTypeSchema,
  title: z.string(),
  description: z.string(),
  required: z.boolean(),
  position: z.number(),
  config: z.unknown(),
});

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

async function ensureUniqueSlug(slug: string, exceptFormId?: string) {
  const existing = await db.form.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing && existing.id !== exceptFormId) {
    throw new AppError("That share URL is already taken.", 409);
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

function sanitizeOptions(options: string[]) {
  return options
    .map((option) => option.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeBlockConfig(
  type: PrismaFormBlockType,
  value: unknown,
): BlockConfig {
  if (isChoiceBlock(type)) {
    const rawOptions =
      typeof value === "object" &&
      value &&
      "options" in value &&
      Array.isArray(value.options)
        ? value.options.filter(
            (option): option is string => typeof option === "string",
          )
        : [];
    const options = sanitizeOptions(rawOptions);
    const branchRules =
      typeof value === "object" &&
      value &&
      "branchRules" in value &&
      Array.isArray(value.branchRules)
        ? value.branchRules
        : undefined;
    const defaultNextBlockId =
      typeof value === "object" &&
      value &&
      "defaultNextBlockId" in value &&
      typeof value.defaultNextBlockId === "string"
        ? value.defaultNextBlockId
        : value &&
            typeof value === "object" &&
            "defaultNextBlockId" in value &&
            value.defaultNextBlockId === null
          ? null
          : undefined;

    return parseBlockConfig(type, {
      options: options.length >= 2 ? options : ["Option 1", "Option 2"],
      branchRules,
      defaultNextBlockId,
    });
  }

  return parseBlockConfig(type, value);
}

function getQuestionLabel(block: SerializedBlock) {
  return block.title || "this question";
}

function normalizeAnswer(
  block: SerializedBlock,
  rawValue: unknown,
): string | string[] | undefined {
  const config = block.config;
  const questionLabel = getQuestionLabel(block);

  if (!isQuestionBlock(block.type)) {
    return undefined;
  }

  if (isTextAnswerBlock(block.type)) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    const validationRegex = (config as TextAnswerBlockConfig).validationRegex;

    if (!value) {
      if (block.required) {
        throw new AppError(`Please answer “${questionLabel}”.`, 422);
      }

      return undefined;
    }

    if (validationRegex && !new RegExp(validationRegex).test(value)) {
      throw new AppError(
        `Please use a valid format for “${questionLabel}”.`,
        422,
      );
    }

    return value;
  }

  if (block.type === FORM_BLOCK_TYPES.SINGLE_CHOICE) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    const options = (config as ChoiceBlockConfig).options;

    if (!value) {
      if (block.required) {
        throw new AppError(
          `Please choose an option for “${questionLabel}”.`,
          422,
        );
      }

      return undefined;
    }

    if (!options.includes(value)) {
      throw new AppError(
        `Invalid option submitted for “${questionLabel}”.`,
        422,
      );
    }

    return value;
  }

  if (block.type === FORM_BLOCK_TYPES.MULTIPLE_CHOICE) {
    const values = Array.isArray(rawValue)
      ? rawValue.filter((value): value is string => typeof value === "string")
      : [];
    const options = (config as ChoiceBlockConfig).options;
    const uniqueValues = [
      ...new Set(values.map((value) => value.trim()).filter(Boolean)),
    ];

    if (!uniqueValues.length) {
      if (block.required) {
        throw new AppError(
          `Please choose at least one option for “${questionLabel}”.`,
          422,
        );
      }

      return undefined;
    }

    if (!uniqueValues.every((value) => options.includes(value))) {
      throw new AppError(
        `Invalid option submitted for “${questionLabel}”.`,
        422,
      );
    }

    return uniqueValues;
  }

  if (block.type === FORM_BLOCK_TYPES.NUMBER) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    const numberConfig = config as NumberBlockConfig;

    if (!value) {
      if (block.required) {
        throw new AppError(
          `Please enter a number for “${questionLabel}”.`,
          422,
        );
      }

      return undefined;
    }

    const numericValue = parseNumericAnswer(value);

    if (numericValue === null) {
      throw new AppError(
        `Please enter a valid number for “${questionLabel}”.`,
        422,
      );
    }

    if (!numberConfig.allowFloat && !Number.isInteger(numericValue)) {
      throw new AppError(
        `Please enter a whole number for “${questionLabel}”.`,
        422,
      );
    }

    if (numberConfig.min !== null && numericValue < numberConfig.min) {
      throw new AppError(
        `Please enter a number greater than or equal to ${numberConfig.min} for “${questionLabel}”.`,
        422,
      );
    }

    if (numberConfig.max !== null && numericValue > numberConfig.max) {
      throw new AppError(
        `Please enter a number less than or equal to ${numberConfig.max} for “${questionLabel}”.`,
        422,
      );
    }

    return String(numericValue);
  }

  if (block.type === FORM_BLOCK_TYPES.LINK) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      if (block.required) {
        throw new AppError(`Please enter a link for “${questionLabel}”.`, 422);
      }

      return undefined;
    }

    if (!isValidLinkAnswer(value)) {
      throw new AppError(
        `Please enter a valid link for “${questionLabel}”.`,
        422,
      );
    }

    return new URL(value).toString();
  }

  if (block.type === FORM_BLOCK_TYPES.DATE) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      if (block.required) {
        throw new AppError(`Please enter a date for “${questionLabel}”.`, 422);
      }

      return undefined;
    }

    if (!isValidDateAnswer(value)) {
      throw new AppError(
        `Please enter a valid date for “${questionLabel}”.`,
        422,
      );
    }

    return value;
  }

  if (block.type === FORM_BLOCK_TYPES.AGREEMENT) {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (!value) {
      if (block.required) {
        throw new AppError(
          `Agreement is required for “${questionLabel}”.`,
          422,
        );
      }

      return undefined;
    }

    if (!isAgreementAnswerValue(value)) {
      throw new AppError(
        `Invalid agreement value submitted for “${questionLabel}”.`,
        422,
      );
    }

    if (block.required && value !== AGREEMENT_ANSWER_VALUES.AGREED) {
      throw new AppError(`Agreement is required for “${questionLabel}”.`, 422);
    }

    return value;
  }

  return undefined;
}

function parseSnapshotBlocks(response: ResponseRecord): SerializedBlock[] {
  const parsed = z
    .array(snapshotBlockSchema)
    .safeParse(response.formSnapshotJson);

  if (!parsed.success) {
    return response.form.blocks.map(serializeBlock);
  }

  return parsed.data
    .sort((left, right) => left.position - right.position)
    .map((block) => ({
      id: block.id,
      type: block.type,
      title: block.title,
      description: block.description,
      required: block.required,
      position: block.position,
      formId: response.formId,
      createdAt: response.submittedAt,
      updatedAt: response.submittedAt,
      config: normalizeBlockConfig(block.type, block.config),
    }));
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
) {
  const parsed = formMetadataSchema.parse(payload);
  await assertAccessibleForm(userId, formId);
  await ensureUniqueSlug(parsed.slug, formId);

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
) {
  const form = await assertAccessibleForm(userId, formId);
  const responses = await db.response.findMany({
    where: {
      formId,
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
  });

  return {
    form: {
      id: form.id,
      title: form.title,
      workspace: toWorkspaceReference(form),
    } satisfies ResponseReviewFormSummary,
    responses: responses
      .map((response, index) => ({
        id: response.id,
        submittedAt: response.submittedAt.toISOString(),
        answerCount:
          typeof response.answersJson === "object" &&
          response.answersJson &&
          !Array.isArray(response.answersJson)
            ? Object.keys(response.answersJson as Record<string, unknown>)
                .length
            : 0,
        submissionNumber: index + 1,
      }))
      .reverse() satisfies ResponseListItem[],
  };
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

  const visitedBlocks = parseSnapshotBlocks(response);
  const visitedBlockIds = new Set(visitedBlocks.map((block) => block.id));
  const currentFormBlocks = response.form.blocks.map(serializeBlock);

  return {
    id: response.id,
    submittedAt: response.submittedAt.toISOString(),
    submissionNumber,
    formTitle: response.form.title,
    workspace: toWorkspaceReference(response.form),
    answers:
      typeof response.answersJson === "object" &&
      response.answersJson &&
      !Array.isArray(response.answersJson)
        ? (response.answersJson as Record<string, string | string[]>)
        : {},
    blocks: visitedBlocks,
    routeBlocks: currentFormBlocks.map((block) => ({
      block,
      status: visitedBlockIds.has(block.id) ? "visited" : "skipped",
    })),
  };
}
