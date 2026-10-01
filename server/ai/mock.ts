// Näidisvastused AI_PROVIDER=mock režiimi jaoks (testimine ja demo ilma API võtmeta).
// Vastused on spordiklubi näite põhised, kuid arvestavad projekti hetkeseisu.
import type { PromptContext } from "./prompts.ts";
import type {
  ClarifyOut,
  CriteriaMockupOut,
  InterpretOut,
  MockupOut,
  NewViewOut,
  PriorityOut,
  RefineOut,
  ReviewOut,
  RolesOut,
  StoriesOut,
} from "./schemas.ts";
import type { Story } from "../../shared/types.ts";
import { checkCriterion, mergeCriteriaTexts, similarity } from "../../shared/quality.ts";

export function clarify(_ctx: PromptContext): ClarifyOut {
  return {
    message: "Enne lugude pakkumist täpsustan paari asja.",
    questions: [
      { text: "Kes on rakenduse kasutajad?", multi: true, options: ["Külastaja", "Klubi liige", "Treener", "Administraator"] },
      { text: "Kas liikmetasu makstakse rakenduses?", multi: false, options: ["Jah, veebis", "Ei, kohapeal", "Otsustame hiljem"] },
    ],
  };
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Külastaja: "Uus huviline, kes tutvub treeningutega ja astub liikmeks.",
  "Klubi liige": "Olemasolev liige, kes haldab oma liikmesust ja treeninguid.",
  Treener: "Viib läbi treeninguid ja haldab tunniplaani.",
  Administraator: "Haldab pakette, liikmeid ja makseid.",
};

export function roles(ctx: PromptContext): RolesOut {
  const answered = ctx.project.context.answers.find((a) => /kasutaja/i.test(a.question));
  const names = answered ? answered.answer.split(/,\s*/).filter(Boolean) : ["Külastaja", "Klubi liige", "Administraator"];
  return {
    message: "Pakun need rollid. Esimese rolli põhitöövoost alustame. Vali, millised jäävad, või lisa oma.",
    roles: names.map((name) => ({ name, description: ROLE_DESCRIPTIONS[name] ?? "Rakenduse kasutaja." })),
  };
}

const HAPPY_PATH: StoriesOut["stories"] = [
  { role: "Külastaja", action: "näha treeningute loendit koos kirjeldustega", benefit: "mõista, mida klubi pakub", size: "M", is_view: true, note: "Töövoo algus: tutvumine." },
  { role: "Külastaja", action: "näha liikmepakette ja hindu", benefit: "valida endale sobiv pakett", size: "S", is_view: true, note: "Otsuse alus." },
  { role: "Külastaja", action: "valida sobiv liikmepakett", benefit: "alustada liikmeks astumist", size: "S", is_view: true, note: "" },
  { role: "Külastaja", action: "registreeruda liikmeks oma andmetega", benefit: "saada klubi liikmeks", size: "M", is_view: true, note: "" },
  { role: "Külastaja", action: "tasuda liikmetasu veebis", benefit: "liikmesus aktiveeruks kohe", size: "L", is_view: true, note: "Täpsustustes valiti veebimakse." },
  { role: "Külastaja", action: "saada liikmesuse kinnitus e-postiga", benefit: "mul oleks tõend liikmesuse kohta", size: "S", is_view: false, note: "Töövoo lõpp." },
  { role: "Administraator", action: "näha uute liikmete ja maksete loendit", benefit: "hallata liikmesusi", size: "M", is_view: true, note: "Vajalik, et töövoog toimiks." },
];

const ALTERNATIVE: StoriesOut["stories"] = [
  { role: "Külastaja", action: "näha treeningute tunniplaani", benefit: "leida endale sobiv aeg", size: "M", is_view: true, note: "" },
  { role: "Külastaja", action: "broneerida proovitreening", benefit: "proovida klubi enne liitumist", size: "M", is_view: true, note: "" },
  { role: "Klubi liige", action: "registreeruda rühmatreeningule", benefit: "mul oleks treeningul koht kindel", size: "M", is_view: true, note: "" },
  { role: "Klubi liige", action: "näha oma liikmesuse kehtivusaega", benefit: "teada, millal pikendada", size: "S", is_view: true, note: "" },
  { role: "Klubi liige", action: "pikendada liikmesust veebis", benefit: "treeningutes ei tekiks pausi", size: "M", is_view: true, note: "" },
];

export function stories(ctx: PromptContext, feedback?: string): StoriesOut {
  const existing = ctx.stories.map((s) => s.action.toLowerCase());
  const pool = feedback ? ALTERNATIVE : HAPPY_PATH;
  const fresh = pool.filter((s) => !existing.includes(s.action.toLowerCase()));
  const list = fresh.length >= 5 ? fresh : [...fresh, ...ALTERNATIVE.filter((s) => !existing.includes(s.action.toLowerCase()))].slice(0, 7);
  return {
    message: feedback
      ? `Arvestasin tagasisidega ja pakun ${list.length} teistsugust lugu.`
      : `Pakun külastaja põhitöövoo põhjal ${list.length} lugu. Need on happy path'i järjekorras.`,
    stories: list,
  };
}

export function priority(ctx: PromptContext): PriorityOut {
  const pick = ctx.stories.find((s) => /pakett/i.test(s.action) && /hind/i.test(s.action)) ?? ctx.stories[0];
  return {
    message: `Milline lugu on kliendile kõige olulisem? Soovitan alustada loost ${pick.code}.`,
    story_code: pick.code,
    reason: "Ilma selleta ei ole ülejäänud töövoogu mõtet kasutada: külastaja peab enne liitumist nägema, mida ta saab ja kui palju see maksab.",
  };
}

function packagesMockup(): MockupOut {
  return {
    title: "Liikmepaketid",
    sections: [
      { id: "s1", heading: "", layout: "row", elements: [{ id: "e1", type: "nav", label: "Spordiklubi", detail: "", items: ["Treeningud", "Paketid", "Logi sisse"] }] },
      {
        id: "s2",
        heading: "Vali endale sobiv pakett",
        layout: "grid",
        elements: [
          { id: "e2", type: "card", label: "Põhipakett", detail: "Kõik rühmatreeningud tööpäeviti", items: [] },
          { id: "e3", type: "price", label: "39 € / kuu", detail: "", items: [] },
          { id: "e4", type: "button", label: "Vali pakett", detail: "", items: [] },
          { id: "e5", type: "card", label: "Premium", detail: "Kõik treeningud + jõusaal 24/7", items: [] },
          { id: "e6", type: "price", label: "59 € / kuu", detail: "", items: [] },
          { id: "e7", type: "button", label: "Vali pakett", detail: "", items: [] },
        ],
      },
      { id: "s3", heading: "", layout: "stack", elements: [{ id: "e8", type: "text", label: "Paketi saab valida ka ilma sisse logimata.", detail: "", items: [] }] },
    ],
  };
}

function genericMockup(story: Story): MockupOut {
  const form = /registreeru|tasu|maks|broneeri|pikenda|lisa/i.test(story.action);
  const list = /loend|näha|nimekiri|tunniplaan/i.test(story.action);
  return {
    title: capitalize(story.action),
    sections: [
      { id: "s1", heading: "", layout: "row", elements: [{ id: "e1", type: "nav", label: "Spordiklubi", detail: "", items: ["Treeningud", "Paketid", "Minu konto"] }] },
      {
        id: "s2",
        heading: capitalize(story.action),
        layout: "stack",
        elements: form
          ? [
              { id: "e2", type: "input", label: "Nimi", detail: "Ees- ja perekonnanimi", items: [] },
              { id: "e3", type: "input", label: "E-post", detail: "nimi@näide.ee", items: [] },
              { id: "e4", type: "checkbox", label: "Nõustun klubi tingimustega", detail: "", items: [] },
              { id: "e5", type: "button", label: "Kinnita", detail: "", items: [] },
            ]
          : list
            ? [
                { id: "e2", type: "list", label: "Loend", detail: "", items: ["Jooga – 60 min", "Spinning – 45 min", "Crossfit – 60 min"] },
                { id: "e3", type: "select", label: "Filtreeri", detail: "", items: ["Kõik", "Hommik", "Õhtu"] },
                { id: "e4", type: "button", label: "Vaata lähemalt", detail: "", items: [] },
              ]
            : [
                { id: "e2", type: "text", label: `Siin saab ${story.action}.`, detail: "", items: [] },
                { id: "e3", type: "button", label: "Jätka", detail: "", items: [] },
              ],
      },
      { id: "s3", heading: "", layout: "stack", elements: [{ id: "e9", type: "notice", label: "Toiming õnnestus", detail: "Kuvatakse pärast kinnitamist", items: [] }] },
    ],
  };
}

export function criteriaMockup(_ctx: PromptContext, story: Story): CriteriaMockupOut {
  if (/pakett/i.test(story.action) && /hind/i.test(story.action)) {
    return {
      message: "Pakun sellele loole 5 vastuvõtukriteeriumi ja mockup'i.",
      criteria: [
        { text: "Paketivaates on iga paketi juures paketi nimi.", element_ids: ["e2", "e5"] },
        { text: "Iga paketi juures on kuuhind eurodes.", element_ids: ["e3", "e6"] },
        { text: "Iga paketi juures on nupp „Vali pakett“.", element_ids: ["e4", "e7"] },
        { text: "Nupule „Vali pakett“ vajutamine avab registreerumisvormi valitud paketiga.", element_ids: ["e4"] },
        { text: "Paketivaade avaneb ka sisse logimata külastajale.", element_ids: ["e8"] },
      ],
      mockup: packagesMockup(),
    };
  }
  const mockup = genericMockup(story);
  const first = mockup.sections[1].elements;
  const existing = story.criteria.filter((c) => checkCriterion(c.text).length === 0).map((c) => ({ text: c.text, element_ids: c.elementIds.filter((id) => mockup.sections.some((s) => s.elements.some((e) => e.id === id))) }));
  const proposed = [
    { text: `Vaate päises on navigeerimismenüü punktiga „${mockup.sections[0].elements[0].items[0]}“.`, element_ids: ["e1"] },
    { text: `Vaates on element „${first[0].label}“.`, element_ids: [first[0].id] },
    { text: `Nupule „${first[first.length - 1].label}“ vajutamisel kuvatakse teade „Toiming õnnestus“.`, element_ids: [first[first.length - 1].id, "e9"] },
    { text: `Vaates on nupp „${first[first.length - 1].label}“.`, element_ids: [first[first.length - 1].id] },
  ];
  const texts = mergeCriteriaTexts([existing.map((c) => c.text), proposed.map((c) => c.text)]);
  const all = [...existing, ...proposed];
  return {
    message: `Pakun loole ${story.code} ${texts.length} vastuvõtukriteeriumi ja mockup'i.`,
    criteria: texts.map((t) => all.find((c) => c.text === t)!),
    mockup,
  };
}

export function refine(ctx: PromptContext, story: Story, request: string): RefineOut {
  const mockup: MockupOut = story.mockup ? structuredClone(story.mockup.spec) : genericMockup(story);
  const criteria = story.criteria.map((c) => ({ text: c.text, element_ids: c.elementIds }));
  const vat = /käibemaks|km\b|km-?ga/i.test(request);
  const other: RefineOut["other_stories"] = [];
  let summary: string;
  if (vat) {
    const prices = mockup.sections.flatMap((s) => s.elements).filter((e) => e.type === "price");
    for (const p of prices) p.detail = "sh km";
    criteria.push({ text: "Iga paketi hinna all on märge „sh km“.", element_ids: prices.map((p) => p.id) });
    summary = "Mockup'is lisandub hinna alla märge „sh km“ ja kriteeriumide hulka lisandub üks kriteerium.";
    const payment = ctx.stories.find((s) => s.id !== story.id && /tasu|maks/i.test(s.action));
    if (payment) other.push({ story_code: payment.code, reason: "Ka maksmise vaates võiks olla näha, kas summa sisaldab käibemaksu." });
  } else {
    const id = nextElementId(mockup);
    mockup.sections[mockup.sections.length - 1].elements.push({ id, type: "notice", label: request.slice(0, 80), detail: "Kliendi täpsustus", items: [] });
    criteria.push({ text: `Vaates on nähtav teave „${request.slice(0, 60)}“.`, element_ids: [id] });
    summary = "Mockup'is lisandub täpsustust kajastav element ja kriteeriumide hulka lisandub üks kriteerium.";
  }
  summary += other.length ? " Seotud lugude kohta teen eraldi ettepaneku." : " Teisi lugusid see ei mõjuta.";
  return {
    message: `Muudatusettepanek loole ${story.code}.`,
    summary,
    role: story.role,
    action: story.action,
    benefit: story.benefit,
    criteria,
    mockup_changed: true,
    mockup,
    other_stories: other,
  };
}

export function review(ctx: PromptContext): ReviewOut {
  const findings: ReviewOut["findings"] = [];
  const used = new Set<string>();
  for (const a of ctx.stories) {
    for (const b of ctx.stories) {
      if (a.id >= b.id || used.has(a.id) || used.has(b.id)) continue;
      if (a.role === b.role && similarity(a.action, b.action) >= 0.4) {
        used.add(a.id).add(b.id);
        findings.push({
          type: "duplicate",
          story_codes: [a.code, b.code],
          problem: `Lood ${a.code} ja ${b.code} kirjeldavad sisuliselt sama vajadust.`,
          reason: "Kattuvad lood dubleerivad tööd ja segavad prioriseerimist.",
          fix_kind: "merge",
          new_stories: [
            {
              role: a.role,
              action: a.action.length >= b.action.length ? a.action : b.action,
              benefit: a.benefit,
              size: a.size ?? "M",
              is_view: a.isView || b.isView,
              criteria: mergeCriteriaTexts([a.criteria.map((c) => c.text), b.criteria.map((c) => c.text)]),
            },
          ],
        });
      }
    }
  }
  for (const s of ctx.stories) {
    if (used.has(s.id)) continue;
    const parts = s.action.split(/\s(?:ja|ning)\s|,\s/).filter((p) => p.trim().length > 3);
    if (parts.length >= 2 || s.criteria.length > 8) {
      used.add(s.id);
      const pieces = parts.length >= 2 ? parts : [s.action, s.action];
      findings.push({
        type: "too_large",
        story_codes: [s.code],
        problem: `Lugu ${s.code} sisaldab mitut eraldi tegevust.`,
        reason: "Liiga suurt lugu on raske hinnata ja ühe iteratsiooniga valmis teha.",
        fix_kind: "split",
        new_stories: pieces.map((p, i) => ({
          role: s.role,
          action: p.trim(),
          benefit: s.benefit,
          size: "S" as const,
          is_view: s.isView,
          criteria: s.criteria.filter((_, ci) => ci % pieces.length === i).map((c) => c.text),
        })),
      });
    }
  }
  for (const s of ctx.stories) {
    if (used.has(s.id)) continue;
    const bad = s.criteria.filter((c) => checkCriterion(c.text).length > 0);
    if (bad.length > 0 || (s.criteria.length > 0 && s.criteria.length < 3)) {
      used.add(s.id);
      findings.push({
        type: "untestable_criteria",
        story_codes: [s.code],
        problem: bad.length ? `Lool ${s.code} on ${bad.length} mittekontrollitavat kriteeriumi.` : `Lool ${s.code} on alla 3 kriteeriumi.`,
        reason: "Kriteerium peab olema üks tingimus, mida saab kontrollida jah/ei vastusega.",
        fix_kind: "rewrite",
        new_stories: [
          {
            role: s.role,
            action: s.action,
            benefit: s.benefit,
            size: s.size ?? "M",
            is_view: s.isView,
            criteria: [
              ...s.criteria.filter((c) => !bad.includes(c)).map((c) => c.text),
              ...bad.map((c) => `Vaates on element, mis vastab nõudele: ${c.text.replace(/[.!]$/, "").toLowerCase().slice(0, 50)}.`),
              "Vaate avamisel kuvatakse lehe pealkiri.",
            ].filter((t) => checkCriterion(t).length === 0),
          },
        ],
      });
    }
  }
  for (const s of ctx.stories) {
    if (used.has(s.id) || !s.isView || s.mockup) continue;
    findings.push({
      type: "missing_mockup",
      story_codes: [s.code],
      problem: `Vaadet puudutaval lool ${s.code} pole mockup'i.`,
      reason: "Ilma mockup'ita ei saa klient vaadet visuaalselt kontrollida.",
      fix_kind: "generate_mockup",
      new_stories: [],
    });
    if (findings.length >= 6) break;
  }
  return {
    message: findings.length ? `Leidsin ${findings.length} probleemi. Vaata iga leid üle ja otsusta.` : "Backlog on korras – probleeme ei leidnud.",
    summary: findings.length ? `Leitud: ${findings.length}` : "Probleeme pole",
    findings,
  };
}

export function newView(ctx: PromptContext, request: string): NewViewOut {
  const role = ctx.project.context.roles[0]?.name ?? "Külastaja";
  const fake = { action: request.toLowerCase(), code: "UUS" } as Story;
  const mockup = genericMockup({ ...fake, action: request.toLowerCase().slice(0, 60) } as Story);
  mockup.title = capitalize(request.slice(0, 60));
  const els = mockup.sections[1].elements;
  return {
    message: "Koostasin uue vaate mockup'i koos kasutajaloo ja kriteeriumidega.",
    role,
    action: `kasutada vaadet „${request.slice(0, 60)}“`,
    benefit: "saaksin vajaliku toimingu tehtud",
    size: "M",
    criteria: [
      { text: `Vaate pealkiri on „${mockup.title}“.`, element_ids: [els[0].id] },
      { text: `Vaates on element „${els[0].label}“.`, element_ids: [els[0].id] },
      { text: `Vaates on nupp „${els[els.length - 1].label}“.`, element_ids: [els[els.length - 1].id] },
    ],
    mockup,
  };
}

export function interpret(ctx: PromptContext, text: string, pending: string): InterpretOut {
  const t = text.toLowerCase();
  const code = (text.match(/\bL\d+\b/i)?.[0] ?? "").toUpperCase();
  const validCode = ctx.stories.some((s) => s.code === code) ? code : "";
  const base = { story_code: validCode, text, roles: [] as string[] };
  if (/vaata.*üle|groom|ülevaatus/.test(t)) return { ...base, message: "Selge, vaatan backlog'i üle.", intent: "review" };
  if (/järgmi/.test(t)) return { ...base, message: "Liigume järgmise loo juurde.", intent: "next_story" };
  if (/lõpeta|aitab tänaseks/.test(t)) return { ...base, message: "Lõpetame kohtumise.", intent: "end_meeting" };
  if (/uus vaade|uue vaate|lisa vaade|leht, kus/.test(t)) return { ...base, message: "Koostan uue vaate ettepaneku.", intent: "new_view" };
  if (/küsimus/.test(pending)) return { ...base, message: "Sain aru, märgin selle vastuseks.", intent: "answer" };
  if (/teistsugu|veel lugu|muid lugusid/.test(t)) return { ...base, message: "Pakun teistsuguseid lugusid.", intent: "stories_feedback" };
  if (validCode && /alusta|olulisem|vali/.test(t)) return { ...base, message: `Alustame loost ${validCode}.`, intent: "choose_story" };
  if (ctx.project.focusStoryId) {
    const focus = ctx.stories.find((s) => s.id === ctx.project.focusStoryId);
    return { ...base, story_code: validCode || focus?.code || "", message: "Käsitlen seda kliendi täpsustusena.", intent: "refine_story" };
  }
  return { ...base, message: "Sain aru. Soovitan jätkata protsessi järgmise sammuga.", intent: "other" };
}

function nextElementId(m: MockupOut): string {
  const nums = m.sections.flatMap((s) => s.elements.map((e) => Number(e.id.replace(/\D/g, "")) || 0));
  return `e${Math.max(0, ...nums) + 1}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
