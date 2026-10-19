// Wall-clock arithmetic for digest webhooks. All schedules are expressed in
// one app-wide IANA zone (DIGEST_TIMEZONE); the Intl API converts between
// that zone and UTC so no date library is needed.

export const DEFAULT_DIGEST_TIMEZONE = "Europe/Saratov";

export const DIGEST_INTERVALS = ["HOURLY", "DAILY", "WEEKLY"] as const;
export type DigestIntervalValue = (typeof DIGEST_INTERVALS)[number];

export type DigestSchedule =
  | { interval: "HOURLY" }
  | { interval: "DAILY"; hour: number; minute: number }
  | { interval: "WEEKLY"; weekday: number; hour: number; minute: number };

export type DigestScheduleFields = {
  digestInterval: DigestIntervalValue | null;
  digestTime: string | null;
  digestWeekday: number | null;
};

export const DIGEST_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimezone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

let warnedAboutTimezone = false;

export function getDigestTimezone(
  env: Record<string, string | undefined> = process.env,
) {
  const zone = env.DIGEST_TIMEZONE?.trim();

  if (!zone) {
    return DEFAULT_DIGEST_TIMEZONE;
  }

  if (!isValidTimezone(zone)) {
    if (!warnedAboutTimezone) {
      warnedAboutTimezone = true;
      console.warn(
        `DIGEST_TIMEZONE "${zone}" is not a known time zone; using ${DEFAULT_DIGEST_TIMEZONE}.`,
      );
    }
    return DEFAULT_DIGEST_TIMEZONE;
  }

  return zone;
}

export function parseDigestTime(value: string | null) {
  const match = value ? DIGEST_TIME_PATTERN.exec(value) : null;

  if (!match) {
    return null;
  }

  return { hour: Number(match[1]), minute: Number(match[2]) };
}

// Returns null when the stored fields do not form a complete schedule.
export function getDigestSchedule(
  webhook: DigestScheduleFields,
): DigestSchedule | null {
  if (webhook.digestInterval === "HOURLY") {
    return { interval: "HOURLY" };
  }

  const time = parseDigestTime(webhook.digestTime);

  if (!time) {
    return null;
  }

  if (webhook.digestInterval === "DAILY") {
    return { interval: "DAILY", ...time };
  }

  if (
    webhook.digestInterval === "WEEKLY" &&
    webhook.digestWeekday !== null &&
    Number.isInteger(webhook.digestWeekday) &&
    webhook.digestWeekday >= 0 &&
    webhook.digestWeekday <= 6
  ) {
    return { interval: "WEEKLY", weekday: webhook.digestWeekday, ...time };
  }

  return null;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string) {
  let formatter = formatters.get(zone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    formatters.set(zone, formatter);
  }

  return formatter;
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function zonedParts(date: Date, zone: string): ZonedParts {
  const parts: Record<string, string> = {};

  for (const part of formatterFor(zone).formatToParts(date)) {
    parts[part.type] = part.value;
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Some engines print midnight as 24 even with hourCycle h23.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAY_NAMES.indexOf(parts.weekday),
  };
}

// The instant at which the given wall clock is shown in the zone. Day and
// hour may overflow (day 32, hour 24); Date.UTC rolls them over. Two passes
// are enough to settle across a DST change.
export function zonedTimeToUtc(
  zone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let utc = wanted;

  for (let pass = 0; pass < 2; pass += 1) {
    const shown = zonedParts(new Date(utc), zone);
    const shownAsUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
    );
    utc -= shownAsUtc - wanted;
  }

  return new Date(utc);
}

function slotAround(
  schedule: DigestSchedule,
  at: Date,
  zone: string,
  dayOffset: number,
  hourOffset: number,
) {
  const parts = zonedParts(at, zone);

  switch (schedule.interval) {
    case "HOURLY":
      return zonedTimeToUtc(
        zone,
        parts.year,
        parts.month,
        parts.day,
        parts.hour + hourOffset,
        0,
      );
    case "DAILY":
      return zonedTimeToUtc(
        zone,
        parts.year,
        parts.month,
        parts.day + dayOffset,
        schedule.hour,
        schedule.minute,
      );
    case "WEEKLY": {
      const daysUntil = (schedule.weekday - parts.weekday + 7) % 7;
      return zonedTimeToUtc(
        zone,
        parts.year,
        parts.month,
        parts.day + daysUntil + dayOffset,
        schedule.hour,
        schedule.minute,
      );
    }
  }
}

function periodDays(schedule: DigestSchedule) {
  return schedule.interval === "WEEKLY" ? 7 : 1;
}

// The first slot strictly after the given instant.
export function nextDigestSlot(
  schedule: DigestSchedule,
  after: Date,
  zone: string,
): Date {
  const candidate = slotAround(schedule, after, zone, 0, 0);

  if (candidate.getTime() > after.getTime()) {
    return candidate;
  }

  return slotAround(schedule, after, zone, periodDays(schedule), 1);
}

// The latest slot at or before the given instant.
export function latestDigestSlot(
  schedule: DigestSchedule,
  at: Date,
  zone: string,
): Date {
  // For WEEKLY, slotAround looks forward to the scheduled weekday, so start
  // from the forward candidate and step back a period when it lies ahead.
  const candidate = slotAround(schedule, at, zone, 0, 0);

  if (candidate.getTime() <= at.getTime()) {
    return candidate;
  }

  return slotAround(schedule, at, zone, -periodDays(schedule), -1);
}

// The slot a digest is due for: the latest slot at or before now that lies
// after the last delivered slot (or after the webhook's creation when none
// was delivered yet). Several missed slots collapse into one, so a webhook
// is sent once after downtime, never once per missed slot.
export function dueDigestSlot(
  schedule: DigestSchedule,
  lastDigestAt: Date | null,
  createdAt: Date,
  now: Date,
  zone: string,
): Date | null {
  const since = lastDigestAt ?? createdAt;
  const slot = latestDigestSlot(schedule, now, zone);

  return slot.getTime() > since.getTime() ? slot : null;
}
