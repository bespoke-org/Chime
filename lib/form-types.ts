import type { FormStatus } from "@prisma/client";

import type { SerializedBlock } from "@/lib/blocks";

export type BuilderBlock = SerializedBlock;
export type PublicBlock = SerializedBlock;
export type AnswerValue = string | string[];

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
  answers: Record<string, AnswerValue>;
  blocks: SerializedBlock[];
};
