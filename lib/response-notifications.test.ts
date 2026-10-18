import { describe, expect, test } from "bun:test";

import type { SubmissionSnapshotBlock } from "@/lib/form-submission";
import type { MailMessage } from "@/lib/mailer";

type SubscriberRecord = {
  id: string;
  notificationEmail: string | null;
  locale: string | null;
};

let subscribers: SubscriberRecord[] = [];
let subscriptionLookups = 0;

const { mock } = (await import("bun:test")) as unknown as {
  mock: {
    module: (specifier: string, factory: () => Record<string, unknown>) => void;
  };
};

mock.module("@/lib/db", () => ({
  db: {
    formNotificationSubscription: {
      findMany: async () => {
        subscriptionLookups += 1;
        return subscribers.map((user) => ({ user }));
      },
    },
  },
}));

const {
  buildResponseNotificationEmail,
  notifyResponseSubscribers,
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

function fakeMailer(
  configured: boolean,
  behavior?: (message: MailMessage) => void,
) {
  const sent: MailMessage[] = [];
  setResponseNotificationMailer({
    isConfigured: () => configured,
    sendMail: async (message) => {
      behavior?.(message);
      sent.push(message);
      return { ok: true };
    },
  });
  return sent;
}

function resetSubscribers(records: SubscriberRecord[]) {
  subscribers = records;
  subscriptionLookups = 0;
}

const notifyInput = {
  form: { id: "form-1", title: "Demo" },
  response: { id: "resp-1", answers: { "q-name": "Ada" } },
  snapshot: [blocks[0], blocks[1]],
};

const ada = {
  id: "user-1",
  notificationEmail: "ada@example.com",
  locale: "en",
};
const boris = {
  id: "user-2",
  notificationEmail: "boris@example.ru",
  locale: "ru-RU",
};

describe("notifyResponseSubscribers", () => {
  test("does not read subscriptions when the mailer is not configured", async () => {
    resetSubscribers([ada]);
    const sent = fakeMailer(false);

    try {
      const result = await notifyResponseSubscribers(notifyInput);

      expect(result.sent).toBe(0);
      expect(subscriptionLookups).toBe(0);
      expect(sent.length).toBe(0);
    } finally {
      setResponseNotificationMailer(null);
    }
  });

  test("sends nothing when nobody is subscribed", async () => {
    resetSubscribers([]);
    const sent = fakeMailer(true);

    try {
      const result = await notifyResponseSubscribers(notifyInput);

      expect(result.recipients).toBe(0);
      expect(subscriptionLookups).toBe(1);
      expect(sent.length).toBe(0);
    } finally {
      setResponseNotificationMailer(null);
    }
  });

  test("sends one email per subscriber in that subscriber's language", async () => {
    resetSubscribers([ada, boris]);
    const sent = fakeMailer(true);

    try {
      const result = await notifyResponseSubscribers(notifyInput);

      expect(result.recipients).toBe(2);
      expect(result.sent).toBe(2);
      expect(sent.length).toBe(2);
      expect(sent[0].to).toBe("ada@example.com");
      expect(sent[0].subject).toBe("New response: Demo");
      expect(sent[1].to).toBe("boris@example.ru");
      expect(sent[1].subject).toBe("Новый ответ: Demo");
      expect(sent[1].text).toContain("Name\nAda");
      expect(sent[1].text).toContain("/forms/form-1/responses/resp-1");
    } finally {
      setResponseNotificationMailer(null);
    }
  });

  test("keeps sending to the others when one send throws", async () => {
    resetSubscribers([ada, boris]);
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message: unknown) => {
      warnings.push(String(message));
    };
    const sent = fakeMailer(true, (message) => {
      if (message.to === "ada@example.com") {
        throw new Error("smtp down");
      }
    });

    try {
      const result = await notifyResponseSubscribers(notifyInput);

      expect(result.recipients).toBe(2);
      expect(result.sent).toBe(1);
      expect(sent.length).toBe(1);
      expect(sent[0].to).toBe("boris@example.ru");
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain("form-1");
      expect(warnings[0]).toContain("example.com");
      expect(warnings[0]).toContain("smtp down");
      expect(warnings[0]).not.toContain("ada@example.com");
    } finally {
      console.warn = originalWarn;
      setResponseNotificationMailer(null);
    }
  });

  test("swallows a failing subscription lookup", async () => {
    resetSubscribers([ada]);
    subscriptionLookups = 0;
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message: unknown) => {
      warnings.push(String(message));
    };
    const sent = fakeMailer(true);
    const brokenSubscribers = subscribers;
    subscribers = {
      get map() {
        throw new Error("db down");
      },
    } as unknown as SubscriberRecord[];

    try {
      const result = await notifyResponseSubscribers(notifyInput);

      expect(result.sent).toBe(0);
      expect(sent.length).toBe(0);
      expect(warnings[0]).toContain("db down");
    } finally {
      subscribers = brokenSubscribers;
      console.warn = originalWarn;
      setResponseNotificationMailer(null);
    }
  });
});

describe("buildResponseNotificationEmail file answers", () => {
  test("writes the download URL for a file answer", () => {
    const email = buildResponseNotificationEmail({
      form: { id: "form-1", title: "Demo" },
      response: { id: "resp-1", answers: { cv: "up1" } },
      blocks: [block("cv", "FILE_UPLOAD", "CV", 0)],
      locale: "en",
      baseUrl: "https://forms.example.com",
    });

    expect(email.text).toContain(
      "CV\nhttps://forms.example.com/api/forms/form-1/uploads/up1",
    );
    expect(email.html).toContain(
      "https://forms.example.com/api/forms/form-1/uploads/up1",
    );
  });
});
