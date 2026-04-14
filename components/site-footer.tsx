"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PROJECT_LICENSE, PROJECT_URLS } from "@/lib/project";

export type SiteFooterCopy = {
  poweredBy: string;
  appName: string;
  licensedUnder: string;
  sourceCode: string;
  reportBug: string;
};

export function SiteFooter({ copy }: { copy: SiteFooterCopy }) {
  const pathname = usePathname();
  const showPoweredBy = pathname?.startsWith("/f/");
  const hideFooter = /^\/forms\/[^/]+\/graph$/.test(pathname ?? "");

  if (hideFooter) {
    return null;
  }

  return (
    <footer>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-6 py-4 text-xs text-[var(--muted)] opacity-70 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showPoweredBy ? (
            <>
              <Link href="/" className="transition hover:opacity-90">
                {copy.appName}
              </Link>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>{copy.licensedUnder}</span>
          <Link
            href={PROJECT_URLS.license}
            target="_blank"
            rel="noreferrer"
            className="transition hover:opacity-90"
          >
            {PROJECT_LICENSE}
          </Link>
        </p>

        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href={PROJECT_URLS.source}
            target="_blank"
            rel="noreferrer"
            className="transition hover:opacity-90"
          >
            {copy.sourceCode}
          </Link>
          <Link
            href={PROJECT_URLS.issues}
            target="_blank"
            rel="noreferrer"
            className="transition hover:opacity-90"
          >
            {copy.reportBug}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
