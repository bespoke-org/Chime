import { cookies } from "next/headers";
import { OrganizationMemberRole, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { ActiveWorkspace, CreatorWorkspaceOption } from "@/lib/form-types";

export const ACTIVE_WORKSPACE_COOKIE = "chime-active-workspace";

export function serializeWorkspaceValue(workspace: ActiveWorkspace) {
  return workspace.kind === "personal"
    ? "personal"
    : `organization:${workspace.organizationId}`;
}

export function parseWorkspaceValue(
  value: string | null | undefined,
): ActiveWorkspace {
  if (!value || value === "personal") {
    return { kind: "personal" };
  }

  if (value.startsWith("organization:")) {
    const organizationId = value.slice("organization:".length).trim();

    if (organizationId) {
      return { kind: "organization", organizationId };
    }
  }

  return { kind: "personal" };
}

export async function setActiveWorkspaceCookie(workspace: ActiveWorkspace) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, serializeWorkspaceValue(workspace), {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveWorkspaceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}

export async function listCreatorWorkspaceOptions(
  userId: string,
): Promise<CreatorWorkspaceOption[]> {
  const memberships = await db.organizationMembership.findMany({
    where: { userId },
    include: {
      organization: true,
    },
    orderBy: {
      organization: {
        name: "asc",
      },
    },
  });

  return [
    {
      kind: "personal",
      label: "Personal workspace",
      value: "personal",
      isOwner: true,
    },
    ...memberships.map((membership) => ({
      kind: "organization" as const,
      organizationId: membership.organizationId,
      label: membership.organization.name,
      value: serializeWorkspaceValue({
        kind: "organization",
        organizationId: membership.organizationId,
      }),
      isOwner: membership.role === OrganizationMemberRole.OWNER,
    })),
  ];
}

export async function getActiveWorkspaceForUser(userId: string) {
  const options = await listCreatorWorkspaceOptions(userId);
  const cookieStore = await cookies();
  const parsed = parseWorkspaceValue(
    cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value,
  );

  if (parsed.kind === "organization") {
    const match = options.find(
      (option) =>
        option.kind === "organization" &&
        option.organizationId === parsed.organizationId,
    );

    if (match) {
      return {
        activeWorkspace: parsed,
        activeOption: match,
        options,
      };
    }
  }

  return {
    activeWorkspace: { kind: "personal" } satisfies ActiveWorkspace,
    activeOption: options[0],
    options,
  };
}

export function workspaceAccessWhere(userId: string): Prisma.FormWhereInput {
  return {
    OR: [
      {
        userId,
        organizationId: null,
      },
      {
        organization: {
          memberships: {
            some: {
              userId,
            },
          },
        },
      },
    ],
  };
}

export function workspaceFilterWhere(
  userId: string,
  workspace: ActiveWorkspace,
): Prisma.FormWhereInput {
  if (workspace.kind === "personal") {
    return {
      userId,
      organizationId: null,
    };
  }

  return {
    organizationId: workspace.organizationId,
    organization: {
      memberships: {
        some: {
          userId,
        },
      },
    },
  };
}

export async function assertOrganizationMember(
  userId: string,
  organizationId: string,
) {
  const membership = await db.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      organization: true,
    },
  });

  if (!membership) {
    throw new AppError("Organization not found.", 404);
  }

  return membership;
}

export async function assertOrganizationOwner(
  userId: string,
  organizationId: string,
) {
  const membership = await assertOrganizationMember(userId, organizationId);

  if (membership.role !== OrganizationMemberRole.OWNER) {
    throw new AppError("Only the organization owner can do that.", 403);
  }

  return membership;
}
