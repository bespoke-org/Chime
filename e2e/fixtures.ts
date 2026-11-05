import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

export const test = base.extend<{ publicForm: { id: string; slug: string } }>({
  publicForm: async ({}, runTest) => {
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
            },
          },
        },
        include: { forms: true },
      });

      await runTest(user.forms[0]!);
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
