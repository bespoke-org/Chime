import { describe, expect, test } from "bun:test";

import type { SubmissionSnapshotBlock } from "@/lib/form-submission";
import type { MailMessage } from "@/lib/mailer";

type OwnerRecord = {
  notificationEmail: string | null;
  locale: string | null;
};

let currentOwner: OwnerRecord | null = null;
let ownerLookups = 0;

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/db", () => ({
  db: {
    user: {
      findUnique: async () => {
        ownerLookups += 1;
        return currentOwner;
      },
    },
  },
}));

const {
  buildResponseNotificationEmail,
  notifyOwnerOfResponse,
  setResponseNotificationMailer,
} = await import("@/lib/response-notifications");

function block(
  id: string,
  type: SubmissionSnapshotBlock["type"],
  title: string,
  position: number,
): SubmissionSnapshotBlock {
  return {
    id,
    type,
    title,
    description: "",
    required: false,
    position,
    config: {},
  } as SubmissionSnapshotBlock;
}

const blocks = [
  block("intro", "TEXT", "Welcome", 0),
  block("q-name", "SHORT_TEXT", "Name", 1),
  block("q-tags", "MULTIPLE_CHOICE", "Tags", 2),
  block("q-terms", "AGREEMENT", "Terms", 3),
  block("q-untitled", "LONG_TEXT", "   ", 4),
];

const answers = {
  "q-name": "Ada <script>alert(1)</script>",
  "q-tags": ["one", "two"],
  "q-terms": "agreed",
  "q-untitled": "line one\nline two",
};

describe("buildResponseNotificationEmail", () => {
  test("lists visited questions with readable answers and a link", () => {
    const email = buildResponseNotificationEmail({
      form: { id: "form-1", title: "Demo" },
      response: { id: "resp-1", answers },
      blocks,
      locale: "en",
      baseUrl: "https://forms.example.com/",
    });

    expect(email.subject).toBe("New response: Demo");
    expect(email.text).toBe(
      [
        "A new response to “Demo” has been received.",
        "",
        "Name",
        "Ada <script>alert(1)</script>",
        "",
        "Tags",
        "one | two",
        "",
        "Terms",
        "Agree",
        "",
        "Question 4",
        "line one\nline two",
        "",
        "Open the response: https://forms.example.com/forms/form-1/responses/resp-1",
      ].join("\n"),
    );
  });

  test("escapes creator and respondent text in the html version", () => {
    const email = buildResponseNotificationEmail({
      form: { id: "form-1", title: "<b>Demo</b> & co" },
      response: { id: "resp-1", answers },
      blocks,
      locale: "en",
      baseUrl: "https://forms.example.com",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>");
    expect(email.html).toContain("&lt;b&gt;Demo&lt;/b&gt; &amp; co");
    expect(email.html).toContain(
      "<strong>Name</strong><br>Ada &lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(email.html).toContain("<strong>Tags</strong><br>one | two");
    expect(email.html).toContain("line one<br>line two");
    expect(email.html).toContain(
      '<a href="https://forms.example.com/forms/form-1/responses/resp-1">Open the response</a>',
    );
    expect(email.subject).toBe("New response: <b>Demo</b> & co");
  });

  test("leaves out blocks that are not in the snapshot and text blocks", () => {
    const email = buildResponseNotificationEmail({
      form: { id: "form-1", title: "Demo" },
      response: {
        id: "resp-1",
        answers: { "q-name": "Ada", "q-skipped": "never shown" },
      },
      blocks: [blocks[0], blocks[1]],
      locale: "en",
      baseUrl: "https://forms.example.com",
    });

    expect(email.text).not.toContain("Welcome");
    expect(email.text).not.toContain("never shown");
    expect(email.text).toContain("Name\nAda");
  });

  test("uses Russian copy for the ru locale", () => {
    const email = buildResponseNotificationEmail({
      form: { id: "form-1", title: "Опрос" },
      response: { id: "resp-1", answers: { "q-terms": "declined" } },
      blocks: [blocks[3], blocks[4]],
      locale: "ru",
      baseUrl: "https://forms.example.com",
    });

    expect(email.subject).toBe("Новый ответ: Опрос");
    expect(email.text).toContain("Terms\nНе согласен");
    expect(email.text).toContain("Вопрос 2\n");
    expect(email.text).toContain("Открыть ответ: ");
  });
});

function fakeMailer(configured: boolean, behavior?: () => never) {
  const sent: MailMessage[] = [];
  setResponseNotificationMailer({
    isConfigured: () => configured,
    sendMail: async (message) => {
      if (behavior) {
        behavior();
      }
      sent.push(message);
      return { ok: true };
    },
  });
  return sent;
}

function resetOwner(owner: OwnerRecord | null) {
  currentOwner = owner;
  ownerLookups = 0;
}

const notifyInput = (notifyOnResponse: boolean) => ({
  form: { id: "form-1", title: "Demo", userId: "user-1", notifyOnResponse },
  response: { id: "resp-1", answers: { "q-name": "Ada" } },
  snapshot: [blocks[0], blocks[1]],
});

describe("notifyOwnerOfResponse", () => {
  test("does nothing when the form has notifications off", async () => {
    resetOwner({ notificationEmail: "owner@example.com", locale: "en" });
    const sent = fakeMailer(true);

    try {
      const result = await notifyOwnerOfResponse(notifyInput(false));

      expect(result.ok).toBe(false);
      expect(result.error).toBe("disabled");
      expect(ownerLookups).toBe(0);
      expect(sent.length).toBe(0);
    } finally {
      setResponseNotificationMailer(null);
    }
  });

  test("does not look up the owner when the mailer is not configured", async () => {
    resetOwner({ notificationEmail: "owner@example.com", locale: "en" });
    const sent = fakeMailer(false);

    try {
      const result = await notifyOwnerOfResponse(notifyInput(true));

      expect(result.error).toBe("not_configured");
      expect(ownerLookups).toBe(0);
      expect(sent.length).toBe(0);
    } finally {
      setResponseNotificationMailer(null);
    }
  });

  test("does not send when the owner has no notification email", async () => {
    resetOwner({ notificationEmail: null, locale: "en" });
    const sent = fakeMailer(true);

    try {
      const result = await notifyOwnerOfResponse(notifyInput(true));

      expect(result.error).toBe("no_recipient");
      expect(ownerLookups).toBe(1);
      expect(sent.length).toBe(0);
    } finally {
      setResponseNotificationMailer(null);
    }
  });

  test("sends to the owner in the owner's language", async () => {
    resetOwner({ notificationEmail: "owner@example.com", locale: "ru-RU" });
    const sent = fakeMailer(true);

    try {
      const result = await notifyOwnerOfResponse(notifyInput(true));

      expect(result.ok).toBe(true);
      expect(sent.length).toBe(1);
      expect(sent[0].to).toBe("owner@example.com");
      expect(sent[0].subject).toBe("Новый ответ: Demo");
      expect(sent[0].text).toContain("Name\nAda");
      expect(sent[0].text).toContain("/forms/form-1/responses/resp-1");
    } finally {
      setResponseNotificationMailer(null);
    }
  });

  test("swallows a sender that throws", async () => {
    resetOwner({ notificationEmail: "owner@example.com", locale: null });
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message: unknown) => {
      warnings.push(String(message));
    };
    fakeMailer(true, () => {
      throw new Error("smtp down");
    });

    try {
      const result = await notifyOwnerOfResponse(notifyInput(true));

      expect(result.ok).toBe(false);
      expect(result.error).toBe("smtp down");
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("form-1");
      expect(warnings[0]).not.toContain("owner@example.com");
    } finally {
      console.warn = originalWarn;
      setResponseNotificationMailer(null);
    }
  });
});
