"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";

export function InlineTitleEditor({
  title,
  disabled = false,
  onCommit,
}: {
  title: string;
  disabled?: boolean;
  onCommit: (title: string) => void;
}) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.select();
    }
  }, [isEditing]);

  function startEditing() {
    if (disabled) {
      return;
    }

    setDraft(title);
    setIsEditing(true);
  }

  function commit() {
    setIsEditing(false);
    const nextTitle = draft.trim();

    if (nextTitle && nextTitle !== title) {
      onCommit(nextTitle);
    }
  }

  function cancel() {
    setIsEditing(false);
    setDraft(title);
  }

  return (
    <h1 className="flex min-w-0 items-center gap-2 font-display text-4xl leading-tight text-[var(--ink)]">
      {isEditing ? (
        // The hidden span sizes the grid cell to the text, so the input is as
        // wide as the title and the badge next to it does not move.
        <span className="inline-grid min-w-0 max-w-full border-b border-[color:var(--line-strong)]">
          <span
            aria-hidden
            className="invisible col-start-1 row-start-1 whitespace-pre pr-2"
          >
            {draft || " "}
          </span>
          <input
            ref={inputRef}
            autoFocus
            aria-label={t("builder.editTitle")}
            className="col-start-1 row-start-1 w-full min-w-0 bg-transparent font-display text-4xl leading-tight text-[var(--ink)] outline-none"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit();
              } else if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
          />
        </span>
      ) : (
        <button
          type="button"
          aria-label={t("builder.editTitle")}
          disabled={disabled}
          className="group flex min-w-0 items-center gap-2 border-b border-transparent text-left disabled:cursor-default"
          onClick={startEditing}
        >
          {title}
          <Pencil
            aria-hidden
            className="size-4 shrink-0 text-[var(--muted)] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </button>
      )}
    </h1>
  );
}
