import type { FormStatus, OrganizationMemberRole } from "@prisma/client";

import type { SerializedBlock } from "@/lib/blocks";

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

export type ResponseDetail = {
  id: string;
  submittedAt: string;
  submissionNumber: number;
  formTitle: string;
  workspace: WorkspaceReference;
  answers: Record<string, AnswerValue>;
  blocks: SerializedBlock[];
};

export type ResponseReviewFormSummary = {
  id: string;
  title: string;
  workspace: WorkspaceReference;
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
