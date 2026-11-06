import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

type FormLayout = Pick<
  Prisma.FormCreateWithoutUserInput,
  "pagesJson" | "blocks"
>;

export const test = base.extend<{
  formLayout: FormLayout;
  publicForm: {
    id: string;
    slug: string;
    readAnswers: (responseId: string) => Promise<Prisma.JsonValue>;
  };
}>({
  formLayout: [{}, { option: true }],
  publicForm: async ({ formLayout }, runTest) => {
    // Require a separate, explicit connection so browser tests cannot silently
    // fall back to the developer's normal DATABASE_URL.
    const connectionString = process.env.E2E_DATABASE_URL;
    if (!connectionString) {
      throw new Error("Set E2E_DATABASE_URL to an isolated test database.");
    }

    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    const userId = `e2e-${randomUUID()}`;

    try {
      const user = await db.user.create({
        data: {
          id: userId,
          name: "Browser test owner",
          forms: {
            create: {
              slug: `e2e-${randomUUID()}`,
              title: "Public runner browser test",
              status: "PUBLISHED",
              respondentLocale: "en",
              blocks: {
                create: [
                  {
                    type: "SHORT_TEXT",
                    title: "Name",
                    required: true,
                    position: 0,
                    config: { placeholder: "Type your name" },
                  },
                  {
                    type: "SHORT_TEXT",
                    title: "Notes",
                    position: 1,
                    config: { placeholder: "Type your notes" },
                  },
                  {
                    type: "SINGLE_CHOICE",
                    title: "Pick one",
                    position: 2,
                    config: { options: ["Yes", "No"] },
                  },
                  {
                    type: "SHORT_TEXT",
                    title: "Email",
                    position: 3,
                    config: { placeholder: "Type your email" },
                  },
                ],
              },
              ...formLayout,
            },
          },
        },
        include: { forms: true },
      });

      const form = user.forms[0]!;
      await runTest({
        ...form,
        readAnswers: async (responseId) => {
          const response = await db.response.findFirstOrThrow({
            where: { id: responseId, formId: form.id },
          });
          return response.answersJson;
        },
      });
    } finally {
      try {
        // Cascades remove only this test's form, visits and responses.
        await db.user.deleteMany({ where: { id: userId } });
      } finally {
        await db.$disconnect();
      }
    }
  },
});
