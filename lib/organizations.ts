import { OrganizationMemberRole } from "@prisma/client";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type {
  OrganizationInviteLinkSummary,
  OrganizationMemberSummary,
  OrganizationSettingsSummary,
} from "@/lib/form-types";
import {
  assertOrganizationMember,
  assertOrganizationOwner,
} from "@/lib/workspaces";

function normalizeOrganizationName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";

  if (name.length < 2) {
    throw new AppError("Organization name must be at least 2 characters.", 422);
  }

  if (name.length > 80) {
    throw new AppError(
      "Organization name must be 80 characters or fewer.",
      422,
    );
  }

  return name;
}

function toMemberSummary(member: {
  userId: string;
  role: OrganizationMemberRole;
  user: {
    name: string | null;
    firstName: string | null;
    secondName: string | null;
    email: string | null;
    image: string | null;
  };
}): OrganizationMemberSummary {
  return {
    userId: member.userId,
    name: member.user.name,
    firstName: member.user.firstName,
    secondName: member.user.secondName,
    email: member.user.email,
    image: member.user.image,
    role: member.role,
  };
}

function toInviteSummary(invite: {
  id: string;
  token: string;
  createdAt: Date;
  revokedAt: Date | null;
}): OrganizationInviteLinkSummary {
  return {
    id: invite.id,
    token: invite.token,
    createdAt: invite.createdAt.toISOString(),
    revokedAt: invite.revokedAt ? invite.revokedAt.toISOString() : null,
  };
}

export async function listOrganizationsForUser(
  userId: string,
): Promise<OrganizationSettingsSummary[]> {
  const memberships = await db.organizationMembership.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          memberships: {
            include: {
              user: {
                select: {
                  name: true,
                  firstName: true,
                  secondName: true,
                  email: true,
                  image: true,
                },
              },
            },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          },
          inviteLinks: {
            where: {
              revokedAt: null,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
    orderBy: {
      organization: {
        name: "asc",
      },
    },
  });

  return memberships.map((membership) => ({
    id: membership.organizationId,
    name: membership.organization.name,
    isOwner: membership.role === OrganizationMemberRole.OWNER,
    members: membership.organization.memberships.map(toMemberSummary),
    inviteLinks: membership.organization.inviteLinks.map(toInviteSummary),
  }));
}

export async function createOrganization(
  userId: string,
  payload: { name: unknown },
) {
  const name = normalizeOrganizationName(payload.name);

  return db.organization.create({
    data: {
      name,
      ownerId: userId,
      memberships: {
        create: {
          userId,
          role: OrganizationMemberRole.OWNER,
        },
      },
    },
  });
}

export async function renameOrganization(
  userId: string,
  organizationId: string,
  payload: { name: unknown },
) {
  const name = normalizeOrganizationName(payload.name);
  await assertOrganizationOwner(userId, organizationId);

  return db.organization.update({
    where: { id: organizationId },
    data: { name },
  });
}

export async function deleteOrganization(
  userId: string,
  organizationId: string,
) {
  await assertOrganizationOwner(userId, organizationId);

  await db.organization.delete({
    where: { id: organizationId },
  });
}

export async function createOrganizationInviteLink(
  userId: string,
  organizationId: string,
) {
  await assertOrganizationOwner(userId, organizationId);

  return db.organizationInviteLink.create({
    data: {
      organizationId,
      createdById: userId,
      token: crypto.randomUUID(),
    },
  });
}

export async function revokeOrganizationInviteLink(
  userId: string,
  organizationId: string,
  inviteLinkId: string,
) {
  await assertOrganizationOwner(userId, organizationId);

  const inviteLink = await db.organizationInviteLink.findFirst({
    where: {
      id: inviteLinkId,
      organizationId,
    },
  });

  if (!inviteLink) {
    throw new AppError("Invite link not found.", 404);
  }

  return db.organizationInviteLink.update({
    where: { id: inviteLinkId },
    data: {
      revokedAt: inviteLink.revokedAt ?? new Date(),
    },
  });
}

export async function removeOrganizationMember(
  userId: string,
  organizationId: string,
  memberUserId: string,
) {
  const ownerMembership = await assertOrganizationOwner(userId, organizationId);

  if (ownerMembership.userId === memberUserId) {
    throw new AppError("The organization owner cannot be removed.", 422);
  }

  const membership = await db.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: memberUserId,
      },
    },
  });

  if (!membership) {
    throw new AppError("Member not found.", 404);
  }

  await db.organizationMembership.delete({
    where: {
      organizationId_userId: {
        organizationId,
        userId: memberUserId,
      },
    },
  });
}

export async function getOrganizationInviteState(
  userId: string,
  token: string,
) {
  const inviteLink = await db.organizationInviteLink.findUnique({
    where: { token },
    include: {
      organization: true,
    },
  });

  if (!inviteLink || inviteLink.revokedAt) {
    return null;
  }

  const existingMembership = await db.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: inviteLink.organizationId,
        userId,
      },
    },
  });

  return {
    organizationId: inviteLink.organizationId,
    organizationName: inviteLink.organization.name,
    alreadyMember: Boolean(existingMembership),
  };
}

export async function acceptOrganizationInvite(userId: string, token: string) {
  const inviteLink = await db.organizationInviteLink.findUnique({
    where: { token },
    include: {
      organization: true,
    },
  });

  if (!inviteLink || inviteLink.revokedAt) {
    throw new AppError("This invite link is no longer valid.", 404);
  }

  const membership = await db.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: inviteLink.organizationId,
        userId,
      },
    },
    update: {},
    create: {
      organizationId: inviteLink.organizationId,
      userId,
      role: OrganizationMemberRole.MEMBER,
    },
  });

  return {
    membership,
    organization: inviteLink.organization,
  };
}

export async function getOrganizationDetailsForMember(
  userId: string,
  organizationId: string,
) {
  await assertOrganizationMember(userId, organizationId);

  return db.organization.findUnique({
    where: { id: organizationId },
    include: {
      memberships: {
        include: {
          user: {
            select: {
              name: true,
              firstName: true,
              secondName: true,
              email: true,
              image: true,
            },
          },
        },
      },
      inviteLinks: true,
    },
  });
}
