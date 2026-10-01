import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCriterion, isTestable, storyTitle, mergeCriteriaTexts } from "../shared/quality.ts";

test("ülesande näidete kontrollitavad kriteeriumid läbivad kontrolli", () => {
  for (const t of [
    "Treeningute lehel on iga treeningu juures selle kestus minutites.",
    "Paketi hinna juures on märge, kas hind sisaldab käibemaksu.",
    "Pärast registreerumist kuvatakse kinnitusteade.",
    "Registreerumisvorm ei lase saata tühja e-posti väljaga.",
    "Paketi kaardil on näha paketi nimi ja kuuhind eurodes.",
  ]) {
    assert.deepEqual(checkCriterion(t), [], t);
  }
});

test("ülesande näidete mittekontrollitavad kriteeriumid saavad hoiatuse", () => {
  assert.equal(checkCriterion("Treeningute leht on kasutajasõbralik.")[0].code, "subjective");
  assert.equal(checkCriterion("Hinnad on selgelt näha.")[0].code, "subjective");
  assert.ok(!isTestable("Registreerumine on kiire ja lihtne."));
  assert.ok(checkCriterion("Vorm kontrollib andmeid ja saadab meili.").some((i) => i.code === "multiple"));
});

test("Connextra pealkiri kasutab olevat käänet", () => {
  assert.equal(
    storyTitle({ role: "Külastaja", action: "näha liikmepakette ja hindu", benefit: "valida endale sobiv pakett" }),
    "Külastajana soovin näha liikmepakette ja hindu, et valida endale sobiv pakett.",
  );
  assert.match(storyTitle({ role: "Klubi liige", action: "x tegevus", benefit: "y kasu" }), /^Klubi liikmena/);
});

test("kriteeriumide ühendamine eemaldab kordused", () => {
  assert.deepEqual(mergeCriteriaTexts([["A on näha lehel", "B kuvatakse"], ["a on näha lehel", "C kuvatakse"]]), [
    "A on näha lehel",
    "B kuvatakse",
    "C kuvatakse",
  ]);
});
