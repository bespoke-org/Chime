import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import { ResponseInstanceCards } from "@/components/response-instance-cards";
import { parseSubmissionPayload } from "@/lib/form-submission";
import {
  restoreVisitedBlocksFromSnapshot,
  groupResponseDetailBlocks,
} from "@/lib/response-review";

describe("ResponseInstanceCards", () => {
  test("keeps names, sparse surnames, and multiple selections in their original cards", () => {
    const blocks = restoreVisitedBlocksFromSnapshot(
      [
        { id: "name", type: "SHORT_TEXT", title: "Имя" },
        { id: "surname", type: "SHORT_TEXT", title: "Фамилия" },
        { id: "choices", type: "MULTIPLE_CHOICE", title: "Выбор" },
      ].map((block, position) => ({
        ...block,
        position,
        pageId: "team",
        pageName: "Участники",
        instanceCount: 4,
        description: "",
        required: false,
        config: {},
      })),
      [],
      "form-1",
      new Date(),
    );
    const answers = parseSubmissionPayload({
      name: ["Леонид", "Андрей", "Никита"],
      surname: ["Тихонов", null, "Зюзин"],
      choices: [["A", "B"], null, ["C"]],
    });
    const section = groupResponseDetailBlocks(blocks, answers)[0];
    if (section.kind !== "repeatedPage") throw new Error("Missing group");
    const markup = renderToStaticMarkup(
      <ResponseInstanceCards
        section={section}
        answers={answers}
        title="Ответы"
        instanceLabel={(number) => `Экземпляр ${number}`}
        noAnswer="Нет ответа"
        renderAnswer={(_type, value) => (
          <p>
            {Array.isArray(value) ? value.join(", ") : value || "Нет ответа"}
          </p>
        )}
      />,
    );
    const dom = new JSDOM(markup);
    const document = dom.window.document;
    expect(document.querySelector("h2")?.textContent).toBe("Участники");
    const cards = [...document.querySelectorAll("article")];
    expect(cards.length).toBe(4);
    const values = cards.map((card) =>
      [...card.querySelectorAll("dd p")].map((cell) => cell.textContent),
    );
    expect(values).toEqual([
      ["Леонид", "Тихонов", "A, B"],
      ["Андрей", "Нет ответа", "Нет ответа"],
      ["Никита", "Зюзин", "C"],
      ["Нет ответа", "Нет ответа", "Нет ответа"],
    ]);
    dom.window.close();
  });
});
