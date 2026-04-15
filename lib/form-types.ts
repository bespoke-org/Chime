import type { FormStatus, OrganizationMemberRole } from "@prisma/client";

import type { SerializedBlock } from "@/lib/blocks";
import type { AppLocale } from "@/lib/i18n";

export type BuilderBlock = SerializedBlock;
export type PublicBlock = SerializedBlock;
export type AnswerValue = string | string[];

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
  slug: string;
  status: FormStatus;
  updatedAt: string;
  responseCount: number;
  workspace: WorkspaceReference;
  blocks: BuilderBlock[];
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
  slug: string;
  blocks: PublicBlock[];
};

export type FormListItem = {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: FormStatus;
  updatedAt: string;
  responseCount: number;
  workspace: WorkspaceReference;
};

export type ResponseListItem = {
  id: string;
  submittedAt: string;
  answerCount: number;
  submissionNumber: number;
};

export type ResponseDetailRouteBlock = {
  block: SerializedBlock;
  status: "visited" | "skipped";
};

export type ResponseDetail = {
  id: string;
  submittedAt: string;
  submissionNumber: number;
  formTitle: string;
  workspace: WorkspaceReference;
  answers: Record<string, AnswerValue>;
  blocks: SerializedBlock[];
  routeBlocks: ResponseDetailRouteBlock[];
};

export type ResponseReviewFormSummary = {
  id: string;
  title: string;
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
};
