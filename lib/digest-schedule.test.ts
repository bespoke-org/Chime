import { describe, expect, test } from "bun:test";

import {
  dueDigestSlot,
  getDigestSchedule,
  getDigestTimezone,
  latestDigestSlot,
  nextDigestSlot,
  zonedTimeToUtc,
  type DigestSchedule,
} from "@/lib/digest-schedule";

// Saratov is UTC+4 all year, so wall clock and UTC differ by a constant.
const zone = "Europe/Saratov";
const daily: DigestSchedule = { interval: "DAILY", hour: 9, minute: 30 };
const weeklyMonday: DigestSchedule = {
  interval: "WEEKLY",
  weekday: 1,
  hour: 8,
  minute: 0,
};
const hourly: DigestSchedule = { interval: "HOURLY" };

const iso = (value: Date | null) => (value ? value.toISOString() : null);

describe("getDigestTimezone", () => {
  test("defaults to UTC and ignores unknown zones", () => {
    expect(getDigestTimezone({})).toBe("UTC");
    expect(getDigestTimezone({ DIGEST_TIMEZONE: " Europe/Berlin " })).toBe(
      "Europe/Berlin",
    );
    expect(getDigestTimezone({ DIGEST_TIMEZONE: "Mars/Olympus" })).toBe("UTC");
  });
});

describe("getDigestSchedule", () => {
  test("builds a schedule from the stored fields", () => {
    expect(
      JSON.stringify(
        getDigestSchedule({
          digestInterval: "HOURLY",
          digestTime: "10:00",
          digestWeekday: 3,
        }),
      ),
    ).toBe('{"interval":"HOURLY"}');
    expect(
      JSON.stringify(
        getDigestSchedule({
          digestInterval: "DAILY",
          digestTime: "09:30",
          digestWeekday: null,
        }),
      ),
    ).toBe('{"interval":"DAILY","hour":9,"minute":30}');
    expect(
      JSON.stringify(
        getDigestSchedule({
          digestInterval: "WEEKLY",
          digestTime: "08:00",
          digestWeekday: 1,
        }),
      ),
    ).toBe('{"interval":"WEEKLY","weekday":1,"hour":8,"minute":0}');
  });

  test("returns null for incomplete or invalid fields", () => {
    expect(
      getDigestSchedule({
        digestInterval: null,
        digestTime: null,
        digestWeekday: null,
      }),
    ).toBe(null);
    expect(
      getDigestSchedule({
        digestInterval: "DAILY",
        digestTime: "24:00",
        digestWeekday: null,
      }),
    ).toBe(null);
    expect(
      getDigestSchedule({
        digestInterval: "WEEKLY",
        digestTime: "08:00",
        digestWeekday: 7,
      }),
    ).toBe(null);
  });
});

describe("zonedTimeToUtc", () => {
  test("converts a Saratov wall clock to UTC", () => {
    expect(iso(zonedTimeToUtc(zone, 2026, 3, 15, 9, 30))).toBe(
      "2026-03-15T05:30:00.000Z",
    );
  });

  test("follows a DST change in a zone that has one", () => {
    // Berlin is UTC+1 in winter and UTC+2 in summer.
    expect(iso(zonedTimeToUtc("Europe/Berlin", 2026, 1, 15, 9, 0))).toBe(
      "2026-01-15T08:00:00.000Z",
    );
    expect(iso(zonedTimeToUtc("Europe/Berlin", 2026, 7, 15, 9, 0))).toBe(
      "2026-07-15T07:00:00.000Z",
    );
  });

  test("rolls day and hour overflow into the next month and year", () => {
    expect(iso(zonedTimeToUtc(zone, 2026, 12, 32, 9, 0))).toBe(
      "2027-01-01T05:00:00.000Z",
    );
    expect(iso(zonedTimeToUtc(zone, 2026, 2, 28, 24, 0))).toBe(
      "2026-02-28T20:00:00.000Z",
    );
  });
});

describe("nextDigestSlot", () => {
  test("hourly: the next top of the hour, never the current instant", () => {
    expect(
      iso(nextDigestSlot(hourly, new Date("2026-10-19T10:15:00Z"), zone)),
    ).toBe("2026-10-19T11:00:00.000Z");
    expect(
      iso(nextDigestSlot(hourly, new Date("2026-10-19T10:00:00Z"), zone)),
    ).toBe("2026-10-19T11:00:00.000Z");
  });

  test("daily: today when the time is still ahead, otherwise tomorrow", () => {
    // 09:30 Saratov is 05:30Z.
    expect(
      iso(nextDigestSlot(daily, new Date("2026-10-19T04:00:00Z"), zone)),
    ).toBe("2026-10-19T05:30:00.000Z");
    expect(
      iso(nextDigestSlot(daily, new Date("2026-10-19T05:30:00Z"), zone)),
    ).toBe("2026-10-20T05:30:00.000Z");
  });

  test("daily: rolls over month and year boundaries", () => {
    expect(
      iso(nextDigestSlot(daily, new Date("2026-10-31T12:00:00Z"), zone)),
    ).toBe("2026-11-01T05:30:00.000Z");
    expect(
      iso(nextDigestSlot(daily, new Date("2026-12-31T12:00:00Z"), zone)),
    ).toBe("2027-01-01T05:30:00.000Z");
  });

  test("weekly: wraps to the next week", () => {
    // 2026-10-19 is a Monday; 08:00 Saratov is 04:00Z.
    expect(
      iso(nextDigestSlot(weeklyMonday, new Date("2026-10-19T03:00:00Z"), zone)),
    ).toBe("2026-10-19T04:00:00.000Z");
    expect(
      iso(nextDigestSlot(weeklyMonday, new Date("2026-10-19T04:00:00Z"), zone)),
    ).toBe("2026-10-26T04:00:00.000Z");
    // Wednesday looks ahead to the coming Monday.
    expect(
      iso(nextDigestSlot(weeklyMonday, new Date("2026-10-21T12:00:00Z"), zone)),
    ).toBe("2026-10-26T04:00:00.000Z");
  });

  test("uses the zone's local day, not the UTC day", () => {
    // 22:00Z on the 19th is already 02:00 on the 20th in Saratov, so the
    // next 09:30 is on the 20th, not the 21st.
    expect(
      iso(nextDigestSlot(daily, new Date("2026-10-19T22:00:00Z"), zone)),
    ).toBe("2026-10-20T05:30:00.000Z");
  });
});

describe("latestDigestSlot", () => {
  test("returns the instant itself when it is a slot", () => {
    expect(
      iso(latestDigestSlot(daily, new Date("2026-10-19T05:30:00Z"), zone)),
    ).toBe("2026-10-19T05:30:00.000Z");
  });

  test("steps back to yesterday or last week when today's slot is ahead", () => {
    expect(
      iso(latestDigestSlot(daily, new Date("2026-10-19T05:29:00Z"), zone)),
    ).toBe("2026-10-18T05:30:00.000Z");
    // Sunday 2026-10-18 looks back to Monday the 12th.
    expect(
      iso(
        latestDigestSlot(weeklyMonday, new Date("2026-10-18T12:00:00Z"), zone),
      ),
    ).toBe("2026-10-12T04:00:00.000Z");
    expect(
      iso(latestDigestSlot(hourly, new Date("2026-10-19T10:59:59Z"), zone)),
    ).toBe("2026-10-19T10:00:00.000Z");
  });
});

describe("dueDigestSlot", () => {
  const createdAt = new Date("2026-10-18T12:00:00Z");

  test("is null before the first slot after creation", () => {
    // Created after today's 09:30, so the first digest is tomorrow.
    const createdAfterSlot = new Date("2026-10-19T06:00:00Z");
    expect(
      dueDigestSlot(
        daily,
        null,
        createdAfterSlot,
        new Date("2026-10-19T12:00:00Z"),
        zone,
      ),
    ).toBe(null);
    expect(
      iso(
        dueDigestSlot(
          daily,
          null,
          createdAfterSlot,
          new Date("2026-10-20T05:30:00Z"),
          zone,
        ),
      ),
    ).toBe("2026-10-20T05:30:00.000Z");
  });

  test("returns the slot once it has passed", () => {
    expect(
      iso(
        dueDigestSlot(
          daily,
          null,
          createdAt,
          new Date("2026-10-19T05:31:00Z"),
          zone,
        ),
      ),
    ).toBe("2026-10-19T05:30:00.000Z");
  });

  test("is null when lastDigestAt is exactly the latest slot", () => {
    expect(
      dueDigestSlot(
        daily,
        new Date("2026-10-19T05:30:00Z"),
        createdAt,
        new Date("2026-10-19T20:00:00Z"),
        zone,
      ),
    ).toBe(null);
  });

  test("collapses missed slots into the latest one", () => {
    // Last sent on the 15th, the app was down until the 19th: one digest for
    // the whole gap, ending at the 19th's slot.
    expect(
      iso(
        dueDigestSlot(
          daily,
          new Date("2026-10-15T05:30:00Z"),
          createdAt,
          new Date("2026-10-19T12:00:00Z"),
          zone,
        ),
      ),
    ).toBe("2026-10-19T05:30:00.000Z");
    expect(
      iso(
        dueDigestSlot(
          hourly,
          new Date("2026-10-19T03:00:00Z"),
          createdAt,
          new Date("2026-10-19T10:05:00Z"),
          zone,
        ),
      ),
    ).toBe("2026-10-19T10:00:00.000Z");
  });

  test("weekly digest created mid-week waits for the scheduled weekday", () => {
    const createdWednesday = new Date("2026-10-14T10:00:00Z");
    expect(
      dueDigestSlot(
        weeklyMonday,
        null,
        createdWednesday,
        new Date("2026-10-18T23:00:00Z"),
        zone,
      ),
    ).toBe(null);
    expect(
      iso(
        dueDigestSlot(
          weeklyMonday,
          null,
          createdWednesday,
          new Date("2026-10-19T04:00:00Z"),
          zone,
        ),
      ),
    ).toBe("2026-10-19T04:00:00.000Z");
  });
});
