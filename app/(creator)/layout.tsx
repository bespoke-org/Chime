import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountMenu } from "@/components/account-menu";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { getServerAuthSession } from "@/lib/auth";
import { getRequestI18n } from "@/lib/i18n-server";
import {
  getActiveWorkspaceForUser,
  serializeWorkspaceValue,
} from "@/lib/workspaces";

export default async function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  const { t } = await getRequestI18n();
  const appName = t("app.name");

  if (!session?.user?.id) {
    redirect("/");
  }

  const workspaceState = await getActiveWorkspaceForUser(session.user.id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8 lg:px-10">
      <header className="mb-8 flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            aria-label={t("app.goToDashboardAria")}
            className="shrink-0 transition-transform hover:scale-[1.02]"
          >
            <Image
              src="/sproute.png"
              alt={appName}
              width={48}
              height={48}
              priority
              className="size-12"
            />
          </Link>
          <Link
            href="/dashboard"
            className="font-display text-2xl text-[var(--ink)] transition hover:text-[var(--accent)]"
          >
            {appName}
          </Link>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
          <WorkspaceSwitcher
            options={workspaceState.options}
            activeValue={serializeWorkspaceValue(
              workspaceState.activeWorkspace,
            )}
          />
          <AccountMenu user={session.user} />
        </div>
      </header>
      {children}
    </main>
  );
}
