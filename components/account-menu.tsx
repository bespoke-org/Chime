"use client";

import Link from "next/link";
import { LoaderCircle, LogOut, Settings } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState, useTransition } from "react";

import { useI18n } from "@/components/i18n-provider";
import { UserAvatar } from "@/components/user-avatar";
import { getUserDisplayName, type UserIdentityLike } from "@/lib/user-identity";

export function AccountMenu({ user }: { user: UserIdentityLike }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = getUserDisplayName(user);
  const { t } = useI18n();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (!isOpen) {
      return;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center justify-center rounded-full transition hover:opacity-95"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t("account.openMenuAria")}
      >
        <UserAvatar
          user={user}
          className="size-11"
          initialsClassName="text-xs"
        />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-[240px] overflow-hidden rounded-[18px] border border-[color:var(--line)] bg-[var(--bg-strong)] p-2 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 rounded-[12px] px-3 py-3">
            <UserAvatar
              user={user}
              className="size-10"
              initialsClassName="text-xs"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ink)]">
                {displayName}
              </p>
              {user.email ? (
                <p className="truncate text-xs text-[var(--muted)]">
                  {user.email}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-1 grid gap-1">
            <Link
              href="/settings?section=profile"
              className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--accent-soft)]"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="size-4" />
              {t("account.settings")}
            </Link>
            <button
              type="button"
              className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--accent-soft)]"
              onClick={() =>
                startTransition(() => {
                  setIsOpen(false);
                  void signOut({ callbackUrl: "/" });
                })
              }
            >
              {isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              {t("account.logout")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
