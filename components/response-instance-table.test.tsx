import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";

import { ResponseInstanceTable } from "@/components/response-instance-table";
import { parseSubmissionPayload } from "@/lib/form-submission";
import {
  restoreVisitedBlocksFromSnapshot,
  groupResponseDetailBlocks,
} from "@/lib/response-review";

describe("ResponseInstanceTable", () => {
  test("keeps names, sparse surnames, and multiple selections in their original rows", () => {
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
      <ResponseInstanceTable
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
    expect(document.querySelector("caption")?.textContent).toBe("Участники");
    const rows = [...document.querySelectorAll("tbody tr")];
    expect(rows.length).toBe(4);
    const values = rows.map((row) =>
      [...row.querySelectorAll("td p")].map((cell) => cell.textContent),
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
