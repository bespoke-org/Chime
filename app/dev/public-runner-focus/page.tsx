"use client";

import { notFound } from "next/navigation";

import { PublicFormRunner } from "@/components/public-form-runner";
import type { SerializedBlock } from "@/lib/blocks";
import type { PublicForm } from "@/lib/form-types";

const now = new Date("2026-04-15T12:00:00.000Z");

const blocks: SerializedBlock[] = [
  {
    id: "name",
    formId: "focus-demo",
    type: "SHORT_TEXT",
    title: "Name",
    description: "",
    required: true,
    position: 0,
    pageId: null,
    createdAt: now,
    updatedAt: now,
    config: {
      placeholder: "Type your name",
      validationRegex: null,
      branchRules: [],
      defaultNextBlockId: null,
      endForm: false,
    },
  },
  {
    id: "notes",
    formId: "focus-demo",
    type: "SHORT_TEXT",
    title: "Notes",
    description: "",
    required: false,
    position: 1,
    pageId: null,
    createdAt: now,
    updatedAt: now,
    config: {
      placeholder: "Type your notes",
      validationRegex: null,
      branchRules: [],
      defaultNextBlockId: null,
      endForm: false,
    },
  },
  {
    id: "pick-one",
    formId: "focus-demo",
    type: "SINGLE_CHOICE",
    title: "Pick one",
    description: "",
    required: true,
    position: 2,
    pageId: null,
    createdAt: now,
    updatedAt: now,
    config: {
      options: ["Yes", "No"],
      branchRules: [],
      defaultNextBlockId: null,
      endForm: false,
    },
  },
  {
    id: "email",
    formId: "focus-demo",
    type: "SHORT_TEXT",
    title: "Email",
    description: "",
    required: false,
    position: 3,
    pageId: null,
    createdAt: now,
    updatedAt: now,
    config: {
      placeholder: "Type your email",
      validationRegex: null,
      branchRules: [],
      defaultNextBlockId: null,
      endForm: false,
    },
  },
];

const form: PublicForm = {
  id: "focus-demo",
  title: "Public runner focus demo",
  description: "",
  completionTitle: "Thanks",
  completionMessage: "Done",
  completionLinkLabel: null,
  completionLinkUrl: null,
  respondentLocale: "en",
  showProgress: true,
  allowBackNavigation: true,
  closedMessage: "",
  slug: "focus-demo",
  blocks,
  pages: [],
};

export default function PublicRunnerFocusPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <PublicFormRunner form={form} />
    </main>
  );
}
