// AI vastuste kontroll: vigane JSON, skeemivead ja sisulised vead viivad uuesti proovimiseni.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAndValidate } from "../server/ai/provider.ts";
import { CriteriaMockupSchema } from "../server/ai/schemas.ts";
import { criteriaQuality, validateCriteriaAndMockup } from "../server/ai/service.ts";

const mockup = {
  title: "Paketid",
  sections: [{ id: "s1", heading: "", layout: "stack", elements: [{ id: "e1", type: "price", label: "39 €", detail: "", items: [] }] }],
};

const task = {
  schema: CriteriaMockupSchema,
  validate: (o: { criteria: { text: string; element_ids: string[] }[]; mockup: typeof mockup }) =>
    validateCriteriaAndMockup(o.criteria, o.mockup as never, true),
  soft: (o: { criteria: { text: string }[] }) => criteriaQuality(o.criteria, 3),
};

test("vigane JSON lükatakse tagasi", () => {
  const r = parseAndValidate(task as never, "see pole json", false);
  assert.equal(r.ok, false);
});

test("skeemile mittevastav vastus lükatakse tagasi", () => {
  const r = parseAndValidate(task as never, JSON.stringify({ message: "x", criteria: [] }), false);
  assert.equal(r.ok, false);
});

test("olematule mockup'i elemendile viitav kriteerium lükatakse tagasi", () => {
  const out = { message: "x", criteria: [{ text: "Hind on eurodes.", element_ids: ["e9"] }], mockup };
  const r = parseAndValidate(task as never, JSON.stringify(out), true);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.problems.join(), /e9/);
});

test("mittekontrollitav kriteerium põhjustab uue katse, viimasel katsel aktsepteeritakse", () => {
  const out = {
    message: "x",
    criteria: [
      { text: "Hinnad on selgelt näha.", element_ids: ["e1"] },
      { text: "Hind on eurodes.", element_ids: ["e1"] },
      { text: "Hinna juures on märge sh km.", element_ids: ["e1"] },
    ],
    mockup,
  };
  assert.equal(parseAndValidate(task as never, JSON.stringify(out), false).ok, false);
  assert.equal(parseAndValidate(task as never, "```json\n" + JSON.stringify(out) + "\n```", true).ok, true);
});
