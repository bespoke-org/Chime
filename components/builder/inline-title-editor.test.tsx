import { describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { InlineTitleEditor } from "@/components/builder/inline-title-editor";
import { I18nProvider } from "@/components/i18n-provider";
import { installTestDom } from "@/test/install-dom";

// react-dom is loaded before the test DOM exists, so it falls back to its
// legacy change-tracking path: it watches the focused text input and re-reads
// its value on key events instead of listening to input events.
function typeIntoInput(input: HTMLElement, value: string) {
  fireEvent.focusIn(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyUp(input, { key: value.slice(-1) });
}

function renderEditor(onCommit: (title: string) => void) {
  return render(
    <I18nProvider locale="en" messages={{}}>
      <InlineTitleEditor title="Form title" onCommit={onCommit} />
    </I18nProvider>,
  );
}

function openEditor(view: ReturnType<typeof renderEditor>) {
  fireEvent.click(view.getByRole("button", { name: "builder.editTitle" }));
  return view.getByLabelText("builder.editTitle") as HTMLInputElement;
}

describe("InlineTitleEditor", () => {
  test("renders the title as a button and opens a prefilled input", () => {
    const restoreDom = installTestDom();
    const view = renderEditor(() => {});

    const button = view.getByRole("button", { name: "builder.editTitle" });
    expect(button.textContent).toContain("Form title");

    const input = openEditor(view);
    expect(input.tagName).toBe("INPUT");
    expect(input.value).toBe("Form title");

    cleanup();
    restoreDom();
  });

  test("commits the trimmed value on Enter", () => {
    const restoreDom = installTestDom();
    const committed: string[] = [];
    const view = renderEditor((title) => committed.push(title));

    const input = openEditor(view);
    typeIntoInput(input, "  Renamed form  ");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(committed.length).toBe(1);
    expect(committed[0]).toBe("Renamed form");
    expect(view.queryByLabelText("builder.editTitle")?.tagName).toBe("BUTTON");

    cleanup();
    restoreDom();
  });

  test("restores the title on Escape without committing", () => {
    const restoreDom = installTestDom();
    const committed: string[] = [];
    const view = renderEditor((title) => committed.push(title));

    const input = openEditor(view);
    typeIntoInput(input, "Something else");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(committed.length).toBe(0);
    expect(
      view.getByRole("button", { name: "builder.editTitle" }).textContent,
    ).toContain("Form title");

    cleanup();
    restoreDom();
  });

  test("ignores blank and unchanged values", () => {
    const restoreDom = installTestDom();
    const committed: string[] = [];
    const view = renderEditor((title) => committed.push(title));

    let input = openEditor(view);
    typeIntoInput(input, "   ");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(committed.length).toBe(0);

    input = openEditor(view);
    typeIntoInput(input, "Form title");
    fireEvent.blur(input);
    expect(committed.length).toBe(0);

    cleanup();
    restoreDom();
  });
});
