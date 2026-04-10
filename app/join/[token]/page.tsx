import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptOrganizationInviteAction } from "@/app/join/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";
import { getRequestI18n } from "@/lib/i18n-server";
import { getOrganizationInviteState } from "@/lib/organizations";

export default async function JoinOrganizationPage({ params }: { params: Promise<{ token: string }> }) {
  const session = await getServerAuthSession();
  const { t } = await getRequestI18n();

  if (!session?.user?.id) {
    redirect("/");
  }

  const { token } = await params;
  const invite = await getOrganizationInviteState(session.user.id, token);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-10 lg:px-10">
      <Card className="w-full p-8 lg:p-10">
        {invite ? (
          <>
            <h1 className="font-display text-4xl text-[var(--ink)]">{t("join.joinTitle", { organization: invite.organizationName })}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {invite.alreadyMember ? t("join.alreadyMember") : t("join.inviteDescription")}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {invite.alreadyMember ? (
                <Link href="/dashboard">
                  <Button>{t("join.openDashboard")}</Button>
                </Link>
              ) : (
                <form action={acceptOrganizationInviteAction}>
                  <input type="hidden" name="token" value={token} />
                  <Button type="submit">{t("join.joinOrganization")}</Button>
                </form>
              )}
              <Link href="/dashboard">
                <Button variant="secondary">{t("join.cancel")}</Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-4xl text-[var(--ink)]">{t("join.unavailableTitle")}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {t("join.unavailableDescription")}
            </p>
            <div className="mt-8">
              <Link href="/dashboard">
                <Button>{t("join.backToDashboard")}</Button>
              </Link>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
