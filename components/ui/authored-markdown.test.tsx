import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AuthoredMarkdown,
  isSafeMarkdownHref,
} from "@/components/ui/authored-markdown";

describe("AuthoredMarkdown", () => {
  test("renders the supported markdown subset", () => {
    const markup = renderToStaticMarkup(
      <AuthoredMarkdown
        content={
          "_italic_ **bold** ~~crossed out~~ `code`\n\n[ok](https://example.com)\n\n## Heading\n\n- first\n- second"
        }
      />,
    );

    expect(markup).toContain("<em");
    expect(markup).toContain("<strong");
    expect(markup).toContain("<del");
    expect(markup).toContain("<code");
    expect(markup).toContain('href="https://example.com"');
    expect(markup).toContain("<h2");
    expect(markup).toContain("<ul");
    expect(markup).toContain("<li");
  });

  test("keeps plain text content readable", () => {
    const markup = renderToStaticMarkup(
      <AuthoredMarkdown content={"Plain text still works."} />,
    );

    expect(markup).toContain("Plain text still works.");
  });

  test("does not render unsafe links as anchors", () => {
    const markup = renderToStaticMarkup(
      <AuthoredMarkdown content={"[bad](javascript:alert(1))"} />,
    );

    expect(markup).not.toContain("<a");
    expect(markup).toContain("<span>bad</span>");
  });

  test("does not render raw html as active markup", () => {
    const markup = renderToStaticMarkup(
      <AuthoredMarkdown content={"<script>alert(1)</script>"} />,
    );

    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("isSafeMarkdownHref", () => {
  test("accepts http and https urls only", () => {
    expect(isSafeMarkdownHref("https://example.com")).toBe(true);
    expect(isSafeMarkdownHref("http://example.com")).toBe(true);
    expect(isSafeMarkdownHref("mailto:test@example.com")).toBe(false);
    expect(isSafeMarkdownHref("javascript:alert(1)")).toBe(false);
    expect(isSafeMarkdownHref("/relative")).toBe(false);
  });
});
