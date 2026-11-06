import { randomUUID } from "node:crypto";

import { expect, test } from "./fixtures";

const countId = randomUUID();
const nameId = randomUUID();
const notesId = randomUUID();

test.describe("Grouped pages", () => {
  test.use({
    formLayout: {
      pagesJson: [{ id: "details", name: "Details" }],
      blocks: {
        create: [
          {
            id: nameId,
            pageId: "details",
            type: "SHORT_TEXT",
            title: "Name",
            required: true,
            position: 0,
            config: { placeholder: "Type your name" },
          },
          {
            id: notesId,
            pageId: "details",
            type: "SHORT_TEXT",
            title: "Notes",
            required: true,
            position: 1,
            config: { placeholder: "Type your notes" },
          },
        ],
      },
    },
  });

  test("Enter keeps focus on the first invalid field across repeated presses", async ({
    page,
    publicForm,
  }) => {
    await page.goto(`/f/${publicForm.slug}`);
    const name = page.getByPlaceholder("Type your name");
    const notes = page.getByPlaceholder("Type your notes");
    await notes.fill("Hello");
    await notes.press("Enter");
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    for (let press = 0; press < 3; press += 1) {
      await name.press("Enter");
      // Flush any deferred focus scheduled by the keyboard handler.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(name).toBeFocused();
    }
    await expect(page.locator("p[role=alert]")).toHaveCount(1);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("validates every field of a page and saves both answers", async ({
    page,
    publicForm,
  }) => {
    await page.goto(`/f/${publicForm.slug}`);
    const name = page.getByPlaceholder("Type your name");
    const notes = page.getByPlaceholder("Type your notes");
    await expect(name).toBeVisible();
    await expect(notes).toBeVisible();
    const openedAt = Date.now();
    await name.fill("Ada");
    await page.getByRole("button", { name: /^Submit$/ }).click();
    await expect(notes).toBeFocused();
    await expect(notes).toHaveAttribute("aria-invalid", "true");
    await expect(notes).toHaveAccessibleDescription(
      "Please answer before continuing.",
    );
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(name).toHaveAttribute("aria-invalid", "false");
    await expect(name).toHaveValue("Ada");
    await notes.fill("Hello");
    await expect(notes).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator("p[role=alert]")).toHaveCount(0);

    // Let the real minimum-fill guard expire so a successful response must
    // come from persistence rather than the guard's honeypot response.
    await expect.poll(() => Date.now() - openedAt).toBeGreaterThan(3500);
    const submitted = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/api/public/forms/${publicForm.slug}/responses`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /^Submit$/ }).click();
    const response = await submitted;
    expect(response.status()).toBe(200);
    const { responseId } = await response.json();
    expect(await publicForm.readAnswers(responseId)).toEqual({
      [nameId]: "Ada",
      [notesId]: "Hello",
    });
  });
});

test.describe("Repeating pages", () => {
  test.use({
    formLayout: {
      pagesJson: [
        { id: "setup" },
        { id: "members", name: "Member", repeat: { countBlockId: countId } },
      ],
      blocks: {
        create: [
          {
            id: countId,
            pageId: "setup",
            type: "NUMBER",
            title: "How many members?",
            required: true,
            position: 0,
            config: {
              placeholder: "Member count",
              allowFloat: false,
              min: 0,
              max: 50,
            },
          },
          {
            id: nameId,
            pageId: "members",
            type: "SHORT_TEXT",
            title: "Name",
            required: true,
            position: 1,
            config: { placeholder: "Member name" },
          },
        ],
      },
    },
  });

  test("restores the current instance after reload and saves every member", async ({
    page,
    publicForm,
  }) => {
    await page.goto(`/f/${publicForm.slug}`);
    await expect(page.getByPlaceholder("Member count")).toBeVisible();
    await page.getByPlaceholder("Member count").fill("2");
    await page.getByRole("button", { name: /^Continue$/ }).click();
    await page.getByPlaceholder("Member name").fill("Ada");
    await page.getByRole("button", { name: /^Continue$/ }).click();
    await expect(page.getByPlaceholder("Member name")).toHaveValue("");

    await page.reload();
    await expect(page.getByText("Saved progress restored.")).toBeVisible();
    const restoredAt = Date.now();
    await expect(page.getByPlaceholder("Member name")).toHaveValue("");
    await page.getByPlaceholder("Member name").fill("Grace");
    await expect.poll(() => Date.now() - restoredAt).toBeGreaterThan(3500);
    const submitted = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/api/public/forms/${publicForm.slug}/responses`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: /^Submit$/ }).click();
    const response = await submitted;
    expect(response.status()).toBe(200);
    const { responseId } = await response.json();
    expect(await publicForm.readAnswers(responseId)).toEqual({
      [countId]: "2",
      [nameId]: ["Ada", "Grace"],
    });
  });
});
