import { expect, test } from "@playwright/test";

test.describe("Public runner text-input focus", () => {
  test("focuses the next text input after continuing from a text step", async ({
    page,
  }) => {
    await page.goto("/dev/public-runner-focus");

    const nameInput = page.getByPlaceholder("Type your name");
    await expect(nameInput).toBeFocused();
    await nameInput.fill("Ada");

    await page.getByRole("button", { name: /^Continue$/ }).click();

    const notesInput = page.getByPlaceholder("Type your notes");
    await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
    await expect(notesInput).toBeFocused();
  });

  test("focuses the next text input after continuing from a choice step", async ({
    page,
  }) => {
    await page.goto("/dev/public-runner-focus");

    await page.getByPlaceholder("Type your name").fill("Ada");
    await page.getByRole("button", { name: /^Continue$/ }).click();
    await page.getByPlaceholder("Type your notes").fill("Hello");
    await page.getByRole("button", { name: /^Continue$/ }).click();

    await expect(page.getByRole("heading", { name: "Pick one" })).toBeVisible();
    await page.getByRole("button", { name: /Yes 1/i }).click();
    await page.getByRole("button", { name: /^Continue$/ }).click();

    const emailInput = page.getByPlaceholder("Type your email");
    await expect(page.getByRole("heading", { name: "Email" })).toBeVisible();
    await expect(emailInput).toBeFocused();
  });
});
