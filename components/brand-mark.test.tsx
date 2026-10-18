import { describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { BrandMark } from "@/components/brand-mark";
import { installTestDom } from "@/test/install-dom";

describe("BrandMark", () => {
  test("renders a decorative svg stroked with currentColor", () => {
    const restoreDom = installTestDom();
    const view = render(<BrandMark className="size-6" />);

    const svg = view.container.querySelector("svg");
    expect(svg instanceof Element).toBe(true);
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("fill")).toBe("none");
    expect(svg?.getAttribute("class")).toBe("size-6");

    cleanup();
    restoreDom();
  });
});
