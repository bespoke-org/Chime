"use client";

import { useEffect, useState } from "react";

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
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [image]);

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
      {image && !imageFailed ? (
        <img
          src={image}
          alt={displayName}
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={cn("text-sm font-semibold uppercase tracking-[0.08em]", initialsClassName)}>{initials}</span>
      )}
    </span>
  );
}
