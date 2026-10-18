import nodemailer, { type Transporter } from "nodemailer";

export type MailerTransport =
  | string
  | {
      host: string;
      port: number;
      secure: boolean;
      auth?: { user: string; pass: string };
    };

export type MailerConfig = {
  from: string;
  transport: MailerTransport;
};

function readString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function readBoolean(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "true" || normalized === "1";
}

// SMTP_URL wins over the split variables. Without MAIL_FROM nothing can be
// sent, so the mailer counts as not configured.
export function getMailerConfig(
  env: Record<string, string | undefined> = process.env,
): MailerConfig | null {
  const from = readString(env.MAIL_FROM);

  if (!from) {
    return null;
  }

  const url = readString(env.SMTP_URL);

  if (url) {
    return { from, transport: url };
  }

  const host = readString(env.SMTP_HOST);

  if (!host) {
    return null;
  }

  const secure = readBoolean(env.SMTP_SECURE);
  const parsedPort = Number(readString(env.SMTP_PORT));
  const port =
    Number.isInteger(parsedPort) && parsedPort > 0
      ? parsedPort
      : secure
        ? 465
        : 587;
  const user = readString(env.SMTP_USER);
  const pass = env.SMTP_PASSWORD ?? "";

  return {
    from,
    transport: {
      host,
      port,
      secure,
      ...(user ? { auth: { user, pass } } : {}),
    },
  };
}

export function isMailerConfigured() {
  return getMailerConfig() !== null;
}

let transporter: Transporter | null = null;
let warnedNotConfigured = false;

function getTransporter(config: MailerConfig) {
  transporter ??= nodemailer.createTransport(config.transport);
  return transporter;
}

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailResult = {
  ok: boolean;
  error?: string;
};

function recipientDomain(address: string) {
  const at = address.lastIndexOf("@");
  return at === -1 ? "unknown" : address.slice(at + 1);
}

// Never throws. Addresses and message content stay out of the log.
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const config = getMailerConfig();

  if (!config) {
    if (!warnedNotConfigured) {
      warnedNotConfigured = true;
      console.warn(
        "Email sending is not configured: set MAIL_FROM and SMTP_URL or SMTP_HOST.",
      );
    }

    return { ok: false, error: "not_configured" };
  }

  try {
    await getTransporter(config).sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `Email delivery to ${recipientDomain(message.to)} failed: ${reason}`,
    );

    return { ok: false, error: reason };
  }
}
