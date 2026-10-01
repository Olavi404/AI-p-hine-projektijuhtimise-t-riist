// Vastuvõtukatse sammud läbi HTTP API, kasutades näidis-AI-d (AI_PROVIDER=mock).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "../server/db.ts";
import { Repo } from "../server/repo.ts";
import { createProvider } from "../server/ai/provider.ts";
import { AiService } from "../server/ai/service.ts";
import { createApp } from "../server/app.ts";
import type { ChatAction, ProjectState } from "../shared/types.ts";

const dbFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aipj-")), "test.db");
let server: Server;
let base = "";

function start() {
  const app = createApp(new Repo(openDb(dbFile)), new AiService(createProvider({ AI_PROVIDER: "mock" })));
  return new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      base = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}`;
      resolve();
    });
  });
}

async function api<T = ProjectState>(method: string, url: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(base + url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = res.status === 204 ? (null as T) : ((await res.json()) as T);
  return { status: res.status, data };
}

const chat = async (id: string, action: ChatAction) => {
  const r = await api("POST", `/api/projects/${id}/chat`, action);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data;
};

before(start);
after(() => server.close());

test("vastuvõtukatse samm-sammult", async () => {
  // 1. Projekt + umbmäärane lause -> täpsustav küsimus valikutega
  const created = await api("POST", "/api/projects", { name: "Spordiklubi", description: "Klubi veeb" });
  assert.equal(created.status, 201);
  const id = created.data.project.id;
  let s = await chat(id, { type: "text", text: "Spordiklubi tahab veebi, kus saab treeningutega tutvuda ja liikmeks astuda." });
  let last = s.messages.at(-1)!;
  assert.equal(last.card?.kind, "question");
  if (last.card?.kind !== "question") return;
  assert.ok(last.card.question.options.length >= 2);

  s = await chat(id, { type: "answer", questionId: last.card.question.id, values: ["Külastaja", "Klubi liige", "Administraator"] });
  last = s.messages.at(-1)!;
  assert.equal(last.card?.kind, "question");
  // Vabatekst ootel küsimuse ajal = oma vastus
  s = await chat(id, { type: "text", text: "Jah, veebis pangalingiga" });
  assert.equal(s.project.context.answers.length, 2);

  // Rollid
  last = s.messages.at(-1)!;
  assert.equal(last.card?.kind, "proposal");
  const rolesProposal = s.proposals.at(-1)!;
  assert.equal(rolesProposal.payload.kind, "roles");
  if (rolesProposal.payload.kind !== "roles") return;
  s = await chat(id, { type: "confirm_roles", proposalId: rolesProposal.id, roles: rolesProposal.payload.roles });

  // 2. Vähemalt 5 lugu happy path'i järjekorras, lisame valitud
  const storiesProposal = s.proposals.at(-1)!;
  assert.equal(storiesProposal.payload.kind, "stories");
  if (storiesProposal.payload.kind !== "stories") return;
  assert.ok(storiesProposal.payload.stories.length >= 5);
  assert.equal(s.stories.length, 0, "ettepanek ei tohi enne kinnitust backlogi jõuda");
  const indices = storiesProposal.payload.stories.map((_, i) => i).filter((i) => i !== 5);
  s = await chat(id, { type: "add_stories", proposalId: storiesProposal.id, indices });
  assert.equal(s.stories.length, indices.length);

  // 3. Soovitus, millest alustada + järjekorra muutmine
  last = s.messages.at(-1)!;
  assert.equal(last.card?.kind, "priority");
  if (last.card?.kind !== "priority") return;
  const focusId = last.card.storyId;
  const reversed = [...s.stories].reverse().map((x) => x.id);
  s = (await api("POST", `/api/projects/${id}/reorder`, { orderedIds: reversed })).data;
  assert.deepEqual(
    s.stories.map((x) => x.id),
    reversed,
  );
  s = await chat(id, { type: "choose_focus", storyId: focusId, moveToTop: true });
  assert.equal(s.stories[0].id, focusId);

  // 4. Kriteeriumid + mockup: kinnita osa, lükka üks tagasi, muuda üht
  const cm = s.proposals.at(-1)!;
  assert.equal(cm.payload.kind, "criteria_mockup");
  if (cm.payload.kind !== "criteria_mockup") return;
  assert.ok(cm.payload.criteria.length >= 4);
  const kept = cm.payload.criteria
    .slice(0, -1)
    .map((c, i) => (i === 0 ? { ...c, text: "Paketivaates on iga paketi juures paketi nimi suures kirjas." } : c));
  s = await chat(id, { type: "apply_criteria", proposalId: cm.id, criteria: kept, includeMockup: true });
  let focus = s.stories.find((x) => x.id === focusId)!;
  assert.equal(focus.criteria.length, kept.length);
  assert.equal(focus.criteria[0].text, kept[0].text);
  assert.equal(focus.mockup?.version, 1);

  // 5. Kliendi täpsustus -> eelvaade -> rakendamine; teised lood muutmata
  const othersBefore = JSON.stringify(s.stories.filter((x) => x.id !== focusId));
  s = await chat(id, { type: "text", text: "Klient ütleb, et paketi hinnas peab olema näha, kas see sisaldab käibemaksu." });
  const change = s.proposals.at(-1)!;
  assert.equal(change.payload.kind, "change");
  if (change.payload.kind !== "change") return;
  assert.equal(change.payload.storyId, focusId);
  assert.notDeepEqual(change.payload.before, change.payload.after);
  s = await chat(id, { type: "apply_change", proposalId: change.id });
  focus = s.stories.find((x) => x.id === focusId)!;
  assert.equal(focus.mockup?.version, 2);
  assert.ok(JSON.stringify(focus.mockup?.spec).includes("sh km"));
  assert.ok(focus.criteria.some((c) => c.text.includes("sh km")));
  assert.equal(JSON.stringify(s.stories.filter((x) => x.id !== focusId)), othersBefore);
  // Teise loo kohta tuleb eraldi soovitus, mitte automaatne muudatus
  assert.ok(s.messages.some((m) => m.card?.kind === "suggestion"));

  // Mockup'i varasem versioon on alles ja taastatav; tagasivõtmine töötab
  const versions = (await api<{ id: string; version: number }[]>("GET", `/api/projects/${id}/stories/${focusId}/mockups`)).data;
  assert.equal(versions.length, 2);
  s = (await api("POST", `/api/projects/${id}/stories/${focusId}/mockups/restore`, { mockupId: versions[1].id })).data;
  assert.equal(s.stories.find((x) => x.id === focusId)!.mockup?.version, 1);
  s = (await api("POST", `/api/projects/${id}/undo`)).data;
  assert.equal(s.stories.find((x) => x.id === focusId)!.mockup?.version, 2);

  // 6. Liiga suur lugu + AI ülevaatus + jagamine eelvaate kaudu
  s = (
    await api("POST", `/api/projects/${id}/stories`, {
      role: "Klubi liige",
      action: "broneerida treeninguid ja tühistada broneeringuid ning maksta trahve",
      benefit: "hallata oma treeninguid",
    })
  ).data;
  const big = s.stories.at(-1)!;
  s = await chat(id, { type: "review" });
  const review = s.proposals.at(-1)!;
  assert.equal(review.payload.kind, "review");
  if (review.payload.kind !== "review") return;
  const idx = review.payload.findings.findIndex((f) => f.fixKind === "split" && f.storyIds.includes(big.id));
  assert.ok(idx >= 0, "liiga suur lugu peab leitama");
  const count = s.stories.length;
  s = await chat(id, { type: "apply_finding", proposalId: review.id, index: idx });
  assert.ok(!s.stories.some((x) => x.id === big.id));
  assert.ok(s.stories.length > count);

  // 7. Täpsustamist vajav lugu ei saa staatust "Valmis arenduseks"
  let r = await api("PATCH", `/api/projects/${id}/stories/${focusId}`, {
    status: "needs_clarification",
    openQuestions: [{ id: "q1", text: "Klient täpsustab maksevõimalused" }],
  });
  assert.equal(r.status, 200);
  r = await api("PATCH", `/api/projects/${id}/stories/${focusId}`, { status: "ready" });
  assert.equal(r.status, 400);
  assert.match((r.data as unknown as { error: string }).error, /Avatud küsimusi/);
  r = await api("PATCH", `/api/projects/${id}/stories/${focusId}`, { openQuestions: [] });
  r = await api("PATCH", `/api/projects/${id}/stories/${focusId}`, { status: "ready" });
  assert.equal(r.status, 200, JSON.stringify(r.data));

  // MVP joon
  s = (await api("PATCH", `/api/projects/${id}`, { mvpLine: 3 })).data;
  assert.equal(s.project.mvpLine, 3);

  // 8. Serveri taaskäivitus: andmed on alles
  const snapshot = JSON.stringify({ stories: s.stories, messages: s.messages.length, stage: s.project.stage });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await start();
  const again = (await api("GET", `/api/projects/${id}`)).data;
  assert.equal(JSON.stringify({ stories: again.stories, messages: again.messages.length, stage: again.project.stage }), snapshot);

  // Eksport
  const md = await fetch(`${base}/api/projects/${id}/export.md`).then((x) => x.text());
  assert.match(md, /MVP joon/);
});

test("ühendamine käsitsi eemaldab korduvad kriteeriumid", async () => {
  const id = (await api("POST", "/api/projects", { name: "Test" })).data.project.id;
  await api("POST", `/api/projects/${id}/stories`, { role: "Külastaja", action: "näha hindu", benefit: "valida pakett" });
  const s = (await api("POST", `/api/projects/${id}/stories`, { role: "Külastaja", action: "näha pakettide hindu", benefit: "valida pakett" })).data;
  const [a, b] = s.stories;
  const merged = await api("POST", `/api/projects/${id}/merge`, {
    storyIds: [a.id, b.id],
    merged: {
      role: "Külastaja",
      action: "näha pakettide hindu",
      benefit: "valida pakett",
      size: "S",
      isView: true,
      criteria: ["Hind on eurodes kuvatud.", "hind on eurodes kuvatud.", "Iga paketi juures on nimi."],
    },
  });
  assert.equal(merged.status, 200);
  assert.equal(merged.data.stories.length, 1);
  assert.equal(merged.data.stories[0].criteria.length, 2);
});

test("AI puudumisel annab vestlus arusaadava veateate, käsitsi haldus töötab", async () => {
  const app = createApp(new Repo(openDb(":memory:")), new AiService(createProvider({ AI_PROVIDER: "anthropic" })));
  const srv = await new Promise<Server>((resolve) => {
    const x = app.listen(0, () => resolve(x));
  });
  const addr = srv.address();
  const url = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}`;
  const post = (p: string, b: unknown) =>
    fetch(url + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json() as Promise<ProjectState>);
  const s = await post("/api/projects", { name: "Ilma AI-ta" });
  const res = await post(`/api/projects/${s.project.id}/chat`, { type: "text", text: "Tahame veebipoodi" });
  assert.equal(res.ai.available, false);
  assert.ok(res.messages.at(-1)!.isError);
  const manual = await post(`/api/projects/${s.project.id}/stories`, { role: "Ostja", action: "näha tooteid", benefit: "valida sobiv toode" });
  assert.equal(manual.stories.length, 1);
  srv.close();
});

test("AI vea järel kordab 'Proovi uuesti' ebaõnnestunud AI sammu", async () => {
  const { AiError } = await import("../server/ai/provider.ts");
  const base = createProvider({ AI_PROVIDER: "mock" });
  const failed = new Set<string>();
  const flaky = {
    name: "flaky",
    available: true,
    generate<T>(task: Parameters<typeof base.generate<T>>[0]) {
      if ((task.step === "clarify" || task.step === "roles") && !failed.has(task.step)) {
        failed.add(task.step);
        return Promise.reject(new AiError("Ajutine viga"));
      }
      return base.generate(task);
    },
  };
  const app = createApp(new Repo(openDb(":memory:")), new AiService(flaky));
  const srv = await new Promise<Server>((resolve) => {
    const x = app.listen(0, () => resolve(x));
  });
  const addr = srv.address();
  const url = `http://localhost:${typeof addr === "object" && addr ? addr.port : 0}`;
  const post = (p: string, b: unknown) =>
    fetch(url + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json() as Promise<ProjectState>);
  const id = (await post("/api/projects", { name: "Kordus" })).project.id;

  // Idee järel ebaõnnestunud täpsustus: kordus küsib täpsustavad küsimused uuesti
  let s = await post(`/api/projects/${id}/chat`, { type: "text", text: "Tahame spordiklubi veebi" });
  let last = s.messages.at(-1)!;
  assert.ok(last.isError);
  s = await post(`/api/projects/${id}/chat`, last.nextSteps[0].action);
  assert.equal(s.messages.at(-1)!.card?.kind, "question");

  // Viimase vastuse järel ebaõnnestunud rollide samm: kordus pakub rollid (mitte ei vasta küsimusele uuesti)
  for (const q of s.project.context.questions) s = await post(`/api/projects/${id}/chat`, { type: "skip_question", questionId: q.id });
  last = s.messages.at(-1)!;
  assert.ok(last.isError);
  assert.equal(last.nextSteps[0].action.type, "propose_roles");
  s = await post(`/api/projects/${id}/chat`, last.nextSteps[0].action);
  assert.equal(s.proposals.at(-1)!.payload.kind, "roles");
  srv.close();
});
