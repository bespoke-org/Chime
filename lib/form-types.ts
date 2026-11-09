import type { FormStatus, OrganizationMemberRole } from "@prisma/client";

import type { SerializedBlock } from "@/lib/blocks";
import type { PageDefinition } from "@/lib/pages";
import type { AppLocale } from "@/lib/i18n";
import type { ResponseIdentityEntry } from "@/lib/response-identity";

export type BuilderBlock = SerializedBlock;
export type PublicBlock = SerializedBlock;
export type AnswerValue = string | string[];

// A stored answer: flat for blocks of non-repeating pages, one entry per
// instance for blocks of a repeating page.
export type StoredAnswerValue = string | string[] | string[][];

export type WorkspaceReference =
  | {
      kind: "personal";
      label: string;
    }
  | {
      kind: "organization";
      organizationId: string;
      label: string;
    };

export type ActiveWorkspace =
  | { kind: "personal" }
  | { kind: "organization"; organizationId: string };

export type CreatorWorkspaceOption =
  | {
      kind: "personal";
      value: string;
      label: string;
      isOwner: true;
    }
  | {
      kind: "organization";
      organizationId: string;
      value: string;
      label: string;
      isOwner: boolean;
    };

export const MAX_FORM_WEBHOOKS = 10;

export type WebhookMode = "IMMEDIATE" | "DIGEST";
export type DigestInterval = "HOURLY" | "DAILY" | "WEEKLY";

export type FormWebhookSummary = {
  id: string;
  url: string;
  secret: string | null;
  enabled: boolean;
  mode: WebhookMode;
  digestInterval: DigestInterval | null;
  digestTime: string | null;
  digestWeekday: number | null;
  lastDigestAt: string | null;
  createdAt: string;
};

// A webhook of another accessible form, offered as a starting point for a new
// one; picking it copies these fields.
export type ReusableWebhook = Pick<
  FormWebhookSummary,
  "url" | "secret" | "mode" | "digestInterval" | "digestTime" | "digestWeekday"
> & { formTitle: string };

// An organization webhook as form settings show it to members.
export type OrganizationWebhookSummary = Pick<
  FormWebhookSummary,
  | "id"
  | "url"
  | "enabled"
  | "mode"
  | "digestInterval"
  | "digestTime"
  | "digestWeekday"
>;

// What the builder sends when creating or editing a webhook.
export type FormWebhookInput = Omit<
  FormWebhookSummary,
  "id" | "lastDigestAt" | "createdAt"
>;

export type BuilderForm = {
  id: string;
  title: string;
  description: string;
  completionTitle: string;
  completionMessage: string;
  completionLinkLabel: string | null;
  completionLinkUrl: string | null;
  respondentLocale: AppLocale | null;
  showProgress: boolean;
  allowBackNavigation: boolean;
  webhooks: FormWebhookSummary[];
  organizationWebhooks: OrganizationWebhookSummary[];
  digestTimezone: string;
  closesAt: string | null;
  maxResponses: number | null;
  closedManually: boolean;
  closedMessage: string;
  notificationsEnabled: boolean;
  viewerHasNotificationEmail: boolean;
  slug: string;
  status: FormStatus;
  updatedAt: string;
  responseCount: number;
  workspace: WorkspaceReference;
  blocks: BuilderBlock[];
  pages: PageDefinition[];
};

export type PublicForm = {
  id: string;
  title: string;
  description: string;
  completionTitle: string;
  completionMessage: string;
  completionLinkLabel: string | null;
  completionLinkUrl: string | null;
  respondentLocale: AppLocale | null;
  showProgress: boolean;
  allowBackNavigation: boolean;
  closedMessage: string;
  slug: string;
  blocks: PublicBlock[];
  pages: PageDefinition[];
};

export type FormListItem = {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: FormStatus;
  closed: boolean;
  updatedAt: string;
  responseCount: number;
  visitCount: number;
  workspace: WorkspaceReference;
};

export type ResponseListItem = {
  id: string;
  submittedAt: string;
  answerCount: number;
  submissionNumber: number;
  identity: ResponseIdentityEntry[];
};

export type ResponseDetailUpload = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type ResponseDetailBlock = SerializedBlock & {
  pageName?: string;
  instanceCount?: number;
};

export type ResponseDetail = {
  id: string;
  submittedAt: string;
  submissionNumber: number;
  formTitle: string;
  workspace: WorkspaceReference;
  identity: ResponseIdentityEntry[];
  answers: Record<string, StoredAnswerValue>;
  uploads: Record<string, ResponseDetailUpload>;
  blocks: ResponseDetailBlock[];
};

export type ResponseReviewFormSummary = {
  id: string;
  title: string;
  slug: string;
  status: FormStatus;
  workspace: WorkspaceReference;
};

export type QuestionSummaryOptionCount = {
  value: string;
  count: number;
};

export type QuestionSummaryAnswer = {
  responseId: string;
  submissionNumber: number;
  value: string;
};

export type QuestionSummary = {
  block: SerializedBlock;
  reachedCount: number;
  answeredCount: number;
  emptyCount: number;
  skippedCount: number;
} & (
  | {
      kind: "choice";
      optionCounts: QuestionSummaryOptionCount[];
    }
  | {
      kind: "number";
      min: number | null;
      max: number | null;
      average: number | null;
      distribution?: QuestionSummaryOptionCount[];
    }
  | {
      kind: "freeform";
      answers: QuestionSummaryAnswer[];
    }
);

export type ResponseReviewData = {
  form: ResponseReviewFormSummary;
  responses: ResponseListItem[];
  questionSummaries: QuestionSummary[];
};

export type ProfileSettingsUserSummary = {
  id: string;
  name: string | null;
  firstName: string | null;
  secondName: string | null;
  locale: "en" | "ru";
  email: string | null;
  image: string | null;
  notificationEmail: string | null;
};

export type OrganizationMemberSummary = {
  userId: string;
  name: string | null;
  firstName: string | null;
  secondName: string | null;
  email: string | null;
  image: string | null;
  role: OrganizationMemberRole;
};

export type OrganizationInviteLinkSummary = {
  id: string;
  token: string;
  createdAt: string;
  revokedAt: string | null;
};

export type OrganizationSettingsSummary = {
  id: string;
  name: string;
  isOwner: boolean;
  members: OrganizationMemberSummary[];
  inviteLinks: OrganizationInviteLinkSummary[];
  // Only the owner gets the list; members get an empty one.
  webhooks: FormWebhookSummary[];
};
