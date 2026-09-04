import { describe, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";

import { AuthErrorAlert } from "./auth-error-alert";
import { installTestDom } from "@/test/install-dom";

describe("AuthErrorAlert", () => {
  test("shows the message once and removes authError from the URL", async () => {
    const restoreDom = installTestDom();

    try {
      window.history.replaceState(null, "", "/?authError=start_failed&lang=en");

      const view = render(<AuthErrorAlert message="Sign-in failed" />);

      expect(view.getByRole("alert").textContent).toContain("Sign-in failed");
      await waitFor(() => {
        expect(window.location.href).toBe("http://localhost/?lang=en");
      });
    } finally {
      cleanup();
      restoreDom();
    }
  });
});
