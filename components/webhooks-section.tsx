"use client";

import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { useI18n } from "@/components/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_FORM_WEBHOOKS,
  type DigestInterval,
  type FormWebhookInput,
  type FormWebhookSummary,
  type OrganizationWebhookSummary,
  type ReusableWebhook,
  type WebhookMode,
} from "@/lib/form-types";

type WebhookDraft = {
  url: string;
  secret: string;
  enabled: boolean;
  mode: WebhookMode;
  digestInterval: DigestInterval;
  digestTime: string;
  digestWeekday: number;
};

const DIGEST_INTERVAL_OPTIONS: DigestInterval[] = ["HOURLY", "DAILY", "WEEKLY"];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function toWebhookDraft(
  webhook: (Omit<ReusableWebhook, "formTitle"> & { enabled?: boolean }) | null,
): WebhookDraft {
  return {
    url: webhook?.url ?? "",
    secret: webhook?.secret ?? "",
    enabled: webhook?.enabled ?? true,
    mode: webhook?.mode ?? "IMMEDIATE",
    digestInterval: webhook?.digestInterval ?? "DAILY",
    digestTime: webhook?.digestTime ?? "09:00",
    digestWeekday: webhook?.digestWeekday ?? 1,
  };
}

function toWebhookInput(draft: WebhookDraft): FormWebhookInput {
  const digest = draft.mode === "DIGEST";

  return {
    url: draft.url,
    secret: draft.secret || null,
    enabled: draft.enabled,
    mode: draft.mode,
    digestInterval: digest ? draft.digestInterval : null,
    digestTime:
      digest && draft.digestInterval !== "HOURLY" ? draft.digestTime : null,
    digestWeekday:
      digest && draft.digestInterval === "WEEKLY" ? draft.digestWeekday : null,
  };
}

// 2026-10-18 is a Sunday; adding the weekday number gives a date on that day.
function weekdayName(weekday: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(Date.UTC(2026, 9, 18 + weekday, 12));
}

function WebhookScheduleSummary({
  webhook,
}: {
  webhook: Omit<OrganizationWebhookSummary, "id">;
}) {
  const { t, locale } = useI18n();

  if (webhook.mode !== "DIGEST") {
    return null;
  }

  const time = webhook.digestTime ?? "";
  const text =
    webhook.digestInterval === "HOURLY"
      ? t("builder.webhookScheduleHourly")
      : webhook.digestInterval === "WEEKLY"
        ? t("builder.webhookScheduleWeekly", {
            weekday: weekdayName(webhook.digestWeekday ?? 0, locale),
            time,
          })
        : t("builder.webhookScheduleDaily", { time });

  return <span className="text-xs text-[var(--muted)]">{text}</span>;
}

// Loads the webhooks a new one can be copied from; any failure leaves the
// list empty, since copying is only a shortcut.
function useReusableWebhooks(url: string | undefined) {
  const [webhooks, setWebhooks] = React.useState<ReusableWebhook[]>([]);

  React.useEffect(() => {
    if (!url) {
      return;
    }

    let active = true;

    fetch(url)
      .then((response) => (response.ok ? response.json() : {}))
      .then((payload: { webhooks?: ReusableWebhook[] }) => {
        if (active) {
          setWebhooks(payload.webhooks ?? []);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [url]);

  return webhooks;
}

function WebhookEditor({
  initial,
  reusableUrl,
  digestTimezone,
  busy,
  onSave,
  onCancel,
}: {
  initial: FormWebhookSummary | null;
  // Only a new webhook offers copies of other forms' webhooks.
  reusableUrl?: string;
  digestTimezone: string;
  busy: boolean;
  onSave: (input: FormWebhookInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = React.useState(() => toWebhookDraft(initial));
  const modeName = React.useId();
  const reusable = useReusableWebhooks(reusableUrl);

  function update(patch: Partial<WebhookDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  const digest = draft.mode === "DIGEST";
  const needsTime = digest && draft.digestInterval !== "HOURLY";
  const needsWeekday = digest && draft.digestInterval === "WEEKLY";

  return (
    <div className="grid gap-4 rounded-[18px] border border-[color:var(--line)] p-4">
      {reusable.length > 0 ? (
        <div className="grid gap-2 text-sm text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">
            {t("builder.webhookReuse")}
          </span>
          <div className="grid gap-2">
            {reusable.map((webhook, index) => (
              <button
                key={index}
                type="button"
                className="grid gap-1 rounded-xl border border-[color:var(--line)] px-3 py-2 text-left transition hover:border-[var(--muted)]/40"
                onClick={() => setDraft(toWebhookDraft(webhook))}
              >
                <span className="truncate font-medium text-[var(--ink)]">
                  {webhook.url}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  {webhook.formTitle}
                  <WebhookModeBadges webhook={{ ...webhook, enabled: true }} />
                </span>
              </button>
            ))}
          </div>
          <span className="text-xs">{t("builder.webhookReuseHelp")}</span>
        </div>
      ) : null}

      <label className="grid gap-2 text-sm text-[var(--muted)]">
        <span className="font-medium text-[var(--ink)]">
          {t("builder.webhookUrl")}
        </span>
        <Input
          value={draft.url}
          placeholder={t("builder.webhookUrlPlaceholder")}
          onChange={(event) => update({ url: event.target.value })}
        />
        <span className="text-xs text-[var(--muted)]">
          {t("builder.webhookUrlHelp")}
        </span>
      </label>

      <label className="grid gap-2 text-sm text-[var(--muted)]">
        <span className="font-medium text-[var(--ink)]">
          {t("builder.webhookSecret")}
        </span>
        <Input
          value={draft.secret}
          autoComplete="off"
          onChange={(event) => update({ secret: event.target.value })}
        />
        <span className="text-xs text-[var(--muted)]">
          {t("builder.webhookSecretHelp")}
        </span>
      </label>

      <fieldset className="grid gap-2 text-sm text-[var(--muted)]">
        <legend className="font-medium text-[var(--ink)]">
          {t("builder.webhookMode")}
        </legend>
        {(["IMMEDIATE", "DIGEST"] as const).map((mode) => (
          <label key={mode} className="flex items-start gap-3">
            <input
              type="radio"
              name={modeName}
              className="mt-1 accent-[var(--accent)]"
              checked={draft.mode === mode}
              onChange={() => update({ mode })}
            />
            <span className="grid gap-1">
              <span className="font-medium text-[var(--ink)]">
                {t(
                  mode === "DIGEST"
                    ? "builder.webhookModeDigest"
                    : "builder.webhookModeImmediate",
                )}
              </span>
              <span className="text-xs">
                {t(
                  mode === "DIGEST"
                    ? "builder.webhookModeDigestHelp"
                    : "builder.webhookModeImmediateHelp",
                )}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      {digest ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">
              {t("builder.webhookInterval")}
            </span>
            <Select
              value={draft.digestInterval}
              onValueChange={(value) =>
                update({ digestInterval: value as DigestInterval })
              }
            >
              <SelectTrigger
                className="h-10 px-3.5 text-sm font-medium"
                aria-label={t("builder.webhookInterval")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIGEST_INTERVAL_OPTIONS.map((interval) => (
                  <SelectItem key={interval} value={interval}>
                    {t(
                      interval === "HOURLY"
                        ? "builder.webhookIntervalHourly"
                        : interval === "DAILY"
                          ? "builder.webhookIntervalDaily"
                          : "builder.webhookIntervalWeekly",
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsWeekday ? (
            <div className="grid gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.webhookWeekday")}
              </span>
              <Select
                value={String(draft.digestWeekday)}
                onValueChange={(value) =>
                  update({ digestWeekday: Number(value) })
                }
              >
                <SelectTrigger
                  className="h-10 px-3.5 text-sm font-medium"
                  aria-label={t("builder.webhookWeekday")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((weekday) => (
                    <SelectItem key={weekday} value={String(weekday)}>
                      {weekdayName(weekday, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {needsTime ? (
            <label className="grid gap-2 text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]">
                {t("builder.webhookTime")}
              </span>
              <Input
                type="time"
                value={draft.digestTime}
                onChange={(event) => update({ digestTime: event.target.value })}
              />
              <span className="text-xs text-[var(--muted)]">
                {t("builder.webhookTimeHelp", { zone: digestTimezone })}
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          {t("builder.cancelWebhook")}
        </Button>
        <Button
          size="sm"
          disabled={busy || !draft.url.trim()}
          onClick={async () => {
            if (await onSave(toWebhookInput(draft))) {
              onCancel();
            }
          }}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {t("builder.saveWebhook")}
        </Button>
      </div>
    </div>
  );
}

function WebhookModeBadges({
  webhook,
}: {
  webhook: Omit<OrganizationWebhookSummary, "id">;
}) {
  const { t } = useI18n();

  return (
    <>
      <Badge>
        {t(
          webhook.mode === "DIGEST"
            ? "builder.webhookModeBadgeDigest"
            : "builder.webhookModeBadgeImmediate",
        )}
      </Badge>
      {webhook.enabled ? null : <Badge>{t("builder.webhookDisabled")}</Badge>}
      <WebhookScheduleSummary webhook={webhook} />
    </>
  );
}

// Each webhook is saved on its own, not with the settings Save button; the
// editor opens inline for one webhook at a time.
export function WebhooksSection({
  webhooks,
  reusableWebhooksUrl,
  digestTimezone,
  description,
  saveWebhook,
  deleteWebhook,
  busy,
  onEditingChange,
  children,
}: {
  webhooks: FormWebhookSummary[];
  // Where a new webhook loads copies of other forms' webhooks from.
  reusableWebhooksUrl?: string;
  digestTimezone: string;
  description: string;
  saveWebhook: (
    webhookId: string | null,
    input: FormWebhookInput,
  ) => Promise<boolean>;
  deleteWebhook: (webhookId: string) => Promise<boolean>;
  busy: boolean;
  onEditingChange?: (editing: boolean) => void;
  // Shown under the heading, before the editable webhooks.
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  // null: closed; "new": adding; otherwise the id being edited.
  const [editing, setEditing] = React.useState<string | null>(null);

  React.useEffect(() => {
    onEditingChange?.(editing !== null);
  }, [editing, onEditingChange]);

  return (
    <div className="space-y-5 border-t border-[color:var(--line)] pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--ink)]">
            {t("builder.webhook")}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {description}
          </p>
        </div>
        <Button
          size="icon"
          variant="secondary"
          aria-label={t("builder.addWebhook")}
          title={t("builder.addWebhook")}
          disabled={editing !== null || webhooks.length >= MAX_FORM_WEBHOOKS}
          onClick={() => setEditing("new")}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {children}

      {webhooks.map((webhook) =>
        editing === webhook.id ? (
          <WebhookEditor
            key={webhook.id}
            initial={webhook}
            digestTimezone={digestTimezone}
            busy={busy}
            onSave={(input) => saveWebhook(webhook.id, input)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div
            key={webhook.id}
            className="flex items-start gap-3 rounded-[18px] border border-[color:var(--line)] p-4"
          >
            <Checkbox
              checked={webhook.enabled}
              disabled={busy}
              aria-label={t("builder.webhookEnabled")}
              title={t("builder.webhookEnabled")}
              onChange={(event) =>
                saveWebhook(webhook.id, {
                  ...toWebhookInput(toWebhookDraft(webhook)),
                  enabled: event.target.checked,
                })
              }
            />
            <div className="grid min-w-0 flex-1 gap-1">
              <span className="truncate text-sm font-medium text-[var(--ink)]">
                {webhook.url}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <WebhookModeBadges webhook={webhook} />
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("builder.editWebhook")}
              title={t("builder.editWebhook")}
              disabled={busy || editing !== null}
              onClick={() => setEditing(webhook.id)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("builder.removeWebhook")}
              title={t("builder.removeWebhook")}
              disabled={busy}
              onClick={() => deleteWebhook(webhook.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      )}

      {editing === "new" ? (
        <WebhookEditor
          initial={null}
          reusableUrl={reusableWebhooksUrl}
          digestTimezone={digestTimezone}
          busy={busy}
          onSave={(input) => saveWebhook(null, input)}
          onCancel={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

async function fetchWebhooks(url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    webhooks?: FormWebhookSummary[];
  };

  if (!response.ok || !payload.webhooks) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload.webhooks;
}

// WebhooksSection that keeps its own list and talks to the webhook endpoints
// under apiBasePath, for pages without a form state to keep it in.
export function ManagedWebhooksSection({
  apiBasePath,
  initialWebhooks,
  digestTimezone,
  description,
  showToast,
}: {
  apiBasePath: string;
  initialWebhooks: FormWebhookSummary[];
  digestTimezone: string;
  description: string;
  showToast: (message: string, variant?: "success" | "error") => void;
}) {
  const { t } = useI18n();
  const [webhooks, setWebhooks] = React.useState(initialWebhooks);
  const [busy, setBusy] = React.useState(false);

  async function run(
    request: () => Promise<FormWebhookSummary[]>,
    done: string,
  ) {
    setBusy(true);

    try {
      setWebhooks(await request());
      showToast(done);
      return true;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("builder.toasts.genericError"),
        "error",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <WebhooksSection
      webhooks={webhooks}
      digestTimezone={digestTimezone}
      description={description}
      busy={busy}
      saveWebhook={(webhookId, input) =>
        run(
          () =>
            fetchWebhooks(
              webhookId ? `${apiBasePath}/${webhookId}` : apiBasePath,
              {
                method: webhookId ? "PATCH" : "POST",
                body: JSON.stringify(input),
              },
            ),
          t("builder.toasts.savedWebhook"),
        )
      }
      deleteWebhook={(webhookId) =>
        run(
          () =>
            fetchWebhooks(`${apiBasePath}/${webhookId}`, { method: "DELETE" }),
          t("builder.toasts.removedWebhook"),
        )
      }
    />
  );
}

// Organization webhooks as members see them in form settings: they cover
// this form too, and only the organization owner changes them.
export function OrganizationWebhooksList({
  webhooks,
}: {
  webhooks: OrganizationWebhookSummary[];
}) {
  const { t } = useI18n();

  if (!webhooks.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-[var(--muted)]">
        {t("builder.organizationWebhooksDescription")}
      </p>
      {webhooks.map((webhook) => (
        <div
          key={webhook.id}
          className="grid gap-1 rounded-[18px] border border-dashed border-[color:var(--line)] p-4"
        >
          <span className="truncate text-sm font-medium text-[var(--ink)]">
            {webhook.url}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{t("builder.webhookFromOrganization")}</Badge>
            <WebhookModeBadges webhook={webhook} />
          </div>
        </div>
      ))}
    </div>
  );
}
