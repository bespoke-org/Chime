import type { FormStatus } from "@prisma/client";

export type FormAvailabilityInput = {
  status: FormStatus;
  closesAt: Date | string | null;
  maxResponses: number | null;
  closedManually: boolean;
};

export type FormClosedReason = "unpublished" | "manual" | "deadline" | "cap";

export type FormAvailability =
  | { open: true }
  | { open: false; reason: FormClosedReason };

// Reasons are checked in a fixed order so the message a creator sees names
// the first rule that applies: unpublished, manual, deadline, cap.
export function getFormAvailability(
  form: FormAvailabilityInput,
  responseCount: number,
  now: Date,
): FormAvailability {
  if (form.status !== "PUBLISHED") {
    return { open: false, reason: "unpublished" };
  }

  if (form.closedManually) {
    return { open: false, reason: "manual" };
  }

  if (form.closesAt !== null) {
    const closesAt = new Date(form.closesAt);

    if (now.getTime() >= closesAt.getTime()) {
      return { open: false, reason: "deadline" };
    }
  }

  if (form.maxResponses !== null && responseCount >= form.maxResponses) {
    return { open: false, reason: "cap" };
  }

  return { open: true };
}
