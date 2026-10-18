import { describe, expect, test } from "bun:test";

import {
  getFormAvailability,
  type FormAvailabilityInput,
} from "@/lib/form-availability";

const now = new Date("2026-10-18T12:00:00.000Z");

function form(overrides: Partial<FormAvailabilityInput> = {}) {
  return {
    status: "PUBLISHED" as const,
    closesAt: null,
    maxResponses: null,
    closedManually: false,
    ...overrides,
  };
}

describe("getFormAvailability", () => {
  test("published form without rules is open", () => {
    expect(JSON.stringify(getFormAvailability(form(), 0, now))).toBe(
      JSON.stringify({ open: true }),
    );
  });

  test("draft form without rules is unpublished", () => {
    expect(
      JSON.stringify(getFormAvailability(form({ status: "DRAFT" }), 0, now)),
    ).toBe(JSON.stringify({ open: false, reason: "unpublished" }));
  });

  test("unpublished wins over every other reason", () => {
    const result = getFormAvailability(
      form({
        status: "DRAFT",
        closedManually: true,
        closesAt: new Date("2026-01-01T00:00:00.000Z"),
        maxResponses: 1,
      }),
      5,
      now,
    );

    expect(JSON.stringify(result)).toBe(
      JSON.stringify({ open: false, reason: "unpublished" }),
    );
  });

  test("manual wins over deadline and cap", () => {
    const result = getFormAvailability(
      form({
        closedManually: true,
        closesAt: new Date("2026-01-01T00:00:00.000Z"),
        maxResponses: 1,
      }),
      5,
      now,
    );

    expect(JSON.stringify(result)).toBe(
      JSON.stringify({ open: false, reason: "manual" }),
    );
  });

  test("deadline wins over cap", () => {
    const result = getFormAvailability(
      form({
        closesAt: new Date("2026-01-01T00:00:00.000Z"),
        maxResponses: 1,
      }),
      5,
      now,
    );

    expect(JSON.stringify(result)).toBe(
      JSON.stringify({ open: false, reason: "deadline" }),
    );
  });

  test("closes exactly at the deadline and is open one millisecond before", () => {
    const closesAt = new Date(now.getTime());

    expect(getFormAvailability(form({ closesAt }), 0, now).open).toBe(false);
    expect(
      getFormAvailability(form({ closesAt }), 0, new Date(now.getTime() - 1))
        .open,
    ).toBe(true);
  });

  test("accepts the deadline as an ISO string", () => {
    expect(
      getFormAvailability(form({ closesAt: now.toISOString() }), 0, now).open,
    ).toBe(false);
  });

  test("closes when the response count reaches the cap", () => {
    expect(getFormAvailability(form({ maxResponses: 10 }), 9, now).open).toBe(
      true,
    );
    expect(
      JSON.stringify(getFormAvailability(form({ maxResponses: 10 }), 10, now)),
    ).toBe(JSON.stringify({ open: false, reason: "cap" }));
    expect(getFormAvailability(form({ maxResponses: 10 }), 11, now).open).toBe(
      false,
    );
  });

  test("ignores the response count when no cap is set", () => {
    expect(getFormAvailability(form(), 1_000_000, now).open).toBe(true);
  });
});
