import type { ComponentPropsWithoutRef, JSX } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const allowedElements = [
  "p",
  "em",
  "strong",
  "del",
  "code",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "br",
] as const;

export function isSafeMarkdownHref(href: string | null | undefined) {
  if (!href) {
    return false;
  }

  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type AuthoredMarkdownProps = {
  content: string;
  className?: string;
};

type MarkdownComponentProps<Tag extends keyof JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<Tag> & {
    node?: unknown;
  };

function MarkdownParagraph({
  className,
  node,
  ...props
}: MarkdownComponentProps<"p">) {
  void node;

  return (
    <p
      className={cn(
        "whitespace-pre-wrap text-inherit [&:not(:first-child)]:mt-4",
        className,
      )}
      {...props}
    />
  );
}

function MarkdownHeading({
  className,
  node,
  ...props
}: MarkdownComponentProps<"h2">) {
  void node;

  return (
    <h2
      className={cn(
        "font-display text-2xl leading-tight text-[var(--ink)] [&:not(:first-child)]:mt-6",
        className,
      )}
      {...props}
    />
  );
}

function MarkdownList({
  className,
  node,
  ...props
}: MarkdownComponentProps<"ul">) {
  void node;

  return (
    <ul
      className={cn(
        "ml-5 list-disc space-y-2 text-inherit [&:not(:first-child)]:mt-4",
        className,
      )}
      {...props}
    />
  );
}

function MarkdownOrderedList({
  className,
  node,
  ...props
}: MarkdownComponentProps<"ol">) {
  void node;

  return (
    <ol
      className={cn(
        "ml-5 list-decimal space-y-2 text-inherit [&:not(:first-child)]:mt-4",
        className,
      )}
      {...props}
    />
  );
}

function MarkdownListItem({
  className,
  node,
  ...props
}: MarkdownComponentProps<"li">) {
  void node;

  return <li className={cn("pl-1", className)} {...props} />;
}

function MarkdownCode({
  className,
  node,
  ...props
}: MarkdownComponentProps<"code">) {
  void node;

  return (
    <code
      className={cn(
        "rounded bg-[var(--surface-strong)] px-1.5 py-0.5 font-mono text-[0.95em] text-[var(--ink)]",
        className,
      )}
      {...props}
    />
  );
}

function MarkdownLink({
  href,
  className,
  children,
  node,
  ...props
}: MarkdownComponentProps<"a">) {
  void node;

  if (!isSafeMarkdownHref(href)) {
    return <span className={className}>{children}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "font-medium text-[var(--accent)] underline decoration-current underline-offset-4",
        className,
      )}
      style={{ textDecorationLine: "underline" }}
      {...props}
    >
      {children}
    </a>
  );
}

export function AuthoredMarkdown({
  content,
  className,
}: AuthoredMarkdownProps) {
  return (
    <div className={cn("break-words text-inherit", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={[...allowedElements]}
        unwrapDisallowed
        components={{
          p: MarkdownParagraph,
          h1: MarkdownHeading,
          h2: MarkdownHeading,
          h3: MarkdownHeading,
          h4: MarkdownHeading,
          h5: MarkdownHeading,
          h6: MarkdownHeading,
          ul: MarkdownList,
          ol: MarkdownOrderedList,
          li: MarkdownListItem,
          code: MarkdownCode,
          a: MarkdownLink,
          del: ({ className: nextClassName, node, ...props }) => {
            void node;

            return (
              <del className={cn("line-through", nextClassName)} {...props} />
            );
          },
          em: ({ className: nextClassName, node, ...props }) => {
            void node;

            return <em className={cn("italic", nextClassName)} {...props} />;
          },
          strong: ({ className: nextClassName, node, ...props }) => {
            void node;

            return (
              <strong
                className={cn("font-semibold", nextClassName)}
                {...props}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
