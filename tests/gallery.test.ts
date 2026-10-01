// Galerii eksport: kaust tekib ja AI tekstid on HTML-is paotatud (skripte ei käivitu).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { galleryHtml, slugify, writeGalleryFolder } from "../server/gallery.ts";
import type { MockupVersion, Project, Story } from "../shared/types.ts";

const spec = {
  title: "Paketid <script>alert(1)</script>",
  sections: [{ id: "s1", heading: "", layout: "stack" as const, elements: [{ id: "e1", type: "price" as const, label: "39 €", detail: "sh km", items: [] }] }],
};
const version: MockupVersion = { id: "m1", storyId: "s", version: 1, spec, note: "", isCurrent: true, createdAt: new Date().toISOString() };
const story = {
  id: "s", projectId: "p", code: "L1", role: "Külastaja", action: "näha hindu", benefit: "valida pakett", status: "idea", position: 0, size: "S",
  isView: true, openQuestions: [], origin: "ai", criteria: [{ id: "c", text: "Hinna all on märge „sh km“.", elementIds: ["e1"] }],
  mockup: version, mockupVersionCount: 1, createdAt: "", updatedAt: "",
} as Story;
const project = { id: "p", name: "Spordiklubi (päris AI)", description: "" } as Project;

test("galerii HTML paotab AI teksti", () => {
  const html = galleryHtml(project, [{ story, versions: [version] }], []);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("sh km"));
});

test("galerii kirjutatakse projekti kausta", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gal-"));
  const out = writeGalleryFolder(root, project, [{ story, versions: [version] }], []);
  assert.equal(path.basename(out.dir), "spordiklubi-paris-ai");
  assert.ok(fs.existsSync(path.join(out.dir, "galerii.html")));
  assert.equal(JSON.parse(fs.readFileSync(path.join(out.dir, "mockups.json"), "utf8")).stories[0].code, "L1");
  assert.equal(slugify("../../etc"), "etc");
});
