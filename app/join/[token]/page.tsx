import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptOrganizationInviteAction } from "@/app/join/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getServerAuthSession } from "@/lib/auth";
import { getOrganizationInviteState } from "@/lib/organizations";

export default async function JoinOrganizationPage({ params }: { params: Promise<{ token: string }> }) {
  const session = await getServerAuthSession();

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
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Organization invite</p>
            <h1 className="mt-3 font-display text-4xl text-[var(--ink)]">Join {invite.organizationName}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {invite.alreadyMember
                ? "You already belong to this organization. You can switch to it from the workspace selector."
                : "Accept this invite to collaborate in the organization workspace."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {invite.alreadyMember ? (
                <Link href="/dashboard">
                  <Button>Open dashboard</Button>
                </Link>
              ) : (
                <form action={acceptOrganizationInviteAction}>
                  <input type="hidden" name="token" value={token} />
                  <Button type="submit">Join organization</Button>
                </form>
              )}
              <Link href="/dashboard">
                <Button variant="secondary">Cancel</Button>
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Organization invite</p>
            <h1 className="mt-3 font-display text-4xl text-[var(--ink)]">Invite not available</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              This invite link is invalid or has been revoked.
            </p>
            <div className="mt-8">
              <Link href="/dashboard">
                <Button>Back to dashboard</Button>
              </Link>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
