"use client";

import { useState } from "react";

import { getUserDisplayName, getUserImage, getUserInitials, type UserIdentityLike } from "@/lib/user-identity";
import { cn } from "@/lib/utils";

export function UserAvatar({
  user,
  className,
  initialsClassName,
}: {
  user: UserIdentityLike;
  className?: string;
  initialsClassName?: string;
}) {
  const image = getUserImage(user);
  const [failedImage, setFailedImage] = useState<string | null>(null);

  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);

  return (
    <span
      className={cn(
        "relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:var(--line)] bg-[var(--accent-soft)] text-[var(--accent-ink)]",
        className,
      )}
      aria-label={displayName}
      title={displayName}
    >
      {image && failedImage !== image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={displayName}
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedImage(image)}
        />
      ) : (
        <span className={cn("text-sm font-semibold uppercase tracking-[0.08em]", initialsClassName)}>{initials}</span>
      )}
    </span>
  );
}
