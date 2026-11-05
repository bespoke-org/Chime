import { createHmac } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

import { getAppBaseUrl } from "@/lib/app-url";
import { isQuestionBlock } from "@/lib/blocks";
import type {
  SubmissionAnswers,
  SubmissionSnapshotBlock,
} from "@/lib/form-submission";
import type { AnswerValue } from "@/lib/form-types";
import {
  collectResponseIdentity,
  type ResponseIdentityEntry,
} from "@/lib/response-identity";
import { buildUploadDownloadUrl } from "@/lib/uploads";

export const WEBHOOK_EVENT_RESPONSE_CREATED = "response.created";
export const WEBHOOK_EVENT_RESPONSES_BATCH = "responses.batch";
export const WEBHOOK_USER_AGENT = "chime-webhook/1";

const PRIVATE_HOST_SUFFIXES = [".local", ".internal"];

function isPrivateIpv4(host: string) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);

  if (!match) {
    return false;
  }

  const [a, b] = match.slice(1).map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a >= 224
  );
}

function isPrivateIpv6(host: string) {
  // URL.hostname keeps the brackets for IPv6 literals.
  const literal = host.replace(/^\[|\]$/g, "").toLowerCase();

  if (literal === "::1" || literal === "::") {
    return true;
  }

  // IPv4-mapped addresses (::ffff:127.0.0.1 or ::ffff:7f00:1) are checked
  // as their IPv4 form.
  const mapped = /^::ffff:(.+)$/.exec(literal);

  if (mapped) {
    const tail = mapped[1];

    if (tail.includes(".")) {
      return isPrivateIpv4(tail);
    }

    const [high, low] = tail
      .split(":")
      .map((part) => Number.parseInt(part, 16));

    if (Number.isInteger(high) && Number.isInteger(low)) {
      return isPrivateIpv4(
        `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`,
      );
    }
  }

  // fc00::/7 (unique local), fe80::/10 (link local) and ff00::/8 (multicast).
  return (
    /^f[cd][0-9a-f]{2}:/.test(literal) ||
    /^fe[89ab][0-9a-f]:/.test(literal) ||
    /^ff[0-9a-f]{2}:/.test(literal)
  );
}

// True for an address a webhook may be sent to: not loopback, unspecified,
// private (RFC 1918), shared (100.64.0.0/10), link-local, unique-local or
// multicast, in IPv4, IPv6 or IPv4-mapped IPv6 form.
export function isPublicIpAddress(address: string) {
  const bare = address.replace(/^\[|\]$/g, "");

  switch (isIP(bare)) {
    case 4:
      return !isPrivateIpv4(bare);
    case 6:
      return !isPrivateIpv6(bare);
    default:
      return false;
  }
}

// A webhook URL must point at a public http(s) host so the server cannot be
// made to call itself or anything on its network. This checks the URL as
// written, which is what the builder validates; a hostname is resolved and
// checked again by isPublicWebhookTarget right before each delivery.
export function isPublicWebhookUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  if (url.username || url.password) {
    return false;
  }

  const host = url.hostname.toLowerCase();

  if (!host || host === "localhost" || host.endsWith(".localhost")) {
    return false;
  }

  if (PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return false;
  }

  if (host.startsWith("[")) {
    return !isPrivateIpv6(host);
  }

  return !isPrivateIpv4(host);
}

export type AddressLookup = (hostname: string) => Promise<string[]>;

const defaultLookup: AddressLookup = async (hostname) =>
  (await dnsLookup(hostname, { all: true })).map((entry) => entry.address);

// Resolves the hostname and refuses the URL when any of its addresses is not
// public, so a name like 127.0.0.1.nip.io or a record pointing into the
// network is caught. fetch resolves the name once more when it connects:
// an answer that changes between the two lookups is not caught. Pinning the
// connection to the checked address would need a custom dispatcher, which
// the fetch of Node and Bun do not share.
export async function isPublicWebhookTarget(
  value: string,
  lookup: AddressLookup = defaultLookup,
) {
  if (!isPublicWebhookUrl(value)) {
    return false;
  }

  const host = new URL(value.trim()).hostname;

  if (isIP(host.replace(/^\[|\]$/g, ""))) {
    return true;
  }

  let addresses: string[];

  try {
    addresses = await lookup(host);
  } catch {
    return false;
  }

  return addresses.length > 0 && addresses.every(isPublicIpAddress);
}

export type WebhookAnswer = {
  blockId: string;
  type: SubmissionSnapshotBlock["type"];
  title: string;
  value: AnswerValue;
};

export type WebhookPayload = {
  event: typeof WEBHOOK_EVENT_RESPONSE_CREATED;
  formId: string;
  formSlug: string;
  formTitle: string;
  formUrl: string;
  responseId: string;
  responseUrl: string;
  submittedAt: string;
  identity: ResponseIdentityEntry[];
  answers: WebhookAnswer[];
};

// File answers are sent as the authenticated download URL, not the upload id.
export function buildWebhookPayload(
  form: { id: string; slug: string; title: string },
  response: { id: string; submittedAt: Date; answers: SubmissionAnswers },
  snapshot: SubmissionSnapshotBlock[],
  baseUrl: string = getAppBaseUrl(),
): WebhookPayload {
  const answers: WebhookAnswer[] = [];

  for (const block of snapshot) {
    if (!isQuestionBlock(block.type)) {
      continue;
    }

    const value = response.answers[block.id];

    if (typeof value === "undefined") {
      continue;
    }

    answers.push({
      blockId: block.id,
      type: block.type,
      title: block.title,
      value:
        block.type === "FILE_UPLOAD" && typeof value === "string"
          ? buildUploadDownloadUrl(baseUrl, form.id, value)
          : value,
    });
  }

  const origin = baseUrl.replace(/\/+$/, "");

  return {
    event: WEBHOOK_EVENT_RESPONSE_CREATED,
    formId: form.id,
    formSlug: form.slug,
    formTitle: form.title,
    formUrl: `${origin}/f/${form.slug}`,
    responseId: response.id,
    // Opens only for members of the form's workspace.
    responseUrl: `${origin}/forms/${form.id}/responses/${response.id}`,
    submittedAt: response.submittedAt.toISOString(),
    identity: collectResponseIdentity(snapshot, response.answers),
    answers,
  };
}

export function signWebhookPayload(
  body: string,
  secret: string,
  timestamp: number,
) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

// One item per response, with the same fields as response.created.
export type WebhookBatchResponse = Pick<
  WebhookPayload,
  "responseId" | "submittedAt" | "identity" | "answers"
>;

export type WebhookBatchPayload = {
  event: typeof WEBHOOK_EVENT_RESPONSES_BATCH;
  formId: string;
  formSlug: string;
  formTitle: string;
  periodStart: string;
  periodEnd: string;
  part: number;
  parts: number;
  responses: WebhookBatchResponse[];
};

export type WebhookDeliveryResult = {
  ok: boolean;
  status?: number;
  error?: string;
};

export type WebhookDeliveryInput = {
  url: string;
  secret: string | null;
  payload: WebhookPayload | WebhookBatchPayload;
  fetchImpl?: typeof fetch;
  lookup?: AddressLookup;
  timeoutMs?: number;
  retryDelayMs?: number;
  now?: () => number;
};

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function postOnce(
  input: Required<
    Pick<WebhookDeliveryInput, "url" | "fetchImpl" | "timeoutMs">
  > & {
    body: string;
    headers: Record<string, string>;
  },
): Promise<WebhookDeliveryResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await input.fetchImpl(input.url, {
      method: "POST",
      headers: input.headers,
      body: input.body,
      signal: controller.signal,
      redirect: "manual",
    });

    return { ok: response.ok, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: controller.signal.aborted
        ? "timeout"
        : error instanceof Error
          ? error.message
          : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function shouldRetry(result: WebhookDeliveryResult) {
  if (result.ok) {
    return false;
  }

  return typeof result.status === "undefined" || result.status >= 500;
}

// Never throws. A failed delivery is logged and reported in the result; the
// stored response is not affected by it.
export async function deliverWebhook(
  input: WebhookDeliveryInput,
): Promise<WebhookDeliveryResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelayMs = input.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const timestamp = Math.floor((input.now ?? Date.now)() / 1000);
  const body = JSON.stringify(input.payload);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": WEBHOOK_USER_AGENT,
    "x-chime-event": input.payload.event,
    "x-chime-timestamp": String(timestamp),
  };

  if (input.secret) {
    headers["x-chime-signature"] =
      `sha256=${signWebhookPayload(body, input.secret, timestamp)}`;
  }

  // The host is resolved and checked before each attempt, so a webhook saved
  // with a public-looking name cannot reach the server's own network.
  const attempt = async (): Promise<WebhookDeliveryResult> => {
    if (!(await isPublicWebhookTarget(input.url, input.lookup))) {
      return { ok: false, error: "blocked_address" };
    }

    return postOnce({ url: input.url, fetchImpl, timeoutMs, body, headers });
  };

  let result = await attempt();

  if (shouldRetry(result) && result.error !== "blocked_address") {
    await sleep(retryDelayMs);
    result = await attempt();
  }

  if (!result.ok) {
    console.warn(
      `Webhook delivery failed for form ${input.payload.formId}: ${
        result.status ?? result.error ?? "unknown error"
      }`,
    );
  }

  return result;
}

export type WebhookDeliverer = (
  input: WebhookDeliveryInput,
) => Promise<WebhookDeliveryResult>;

let activeDeliverer: WebhookDeliverer = deliverWebhook;

export function getWebhookDeliverer() {
  return activeDeliverer;
}

// Tests swap the deliverer so form logic can be checked without a network.
export function setWebhookDeliverer(deliverer: WebhookDeliverer | null) {
  activeDeliverer = deliverer ?? deliverWebhook;
}
