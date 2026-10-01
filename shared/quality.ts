// Reeglipõhised kvaliteedikontrollid: kriteeriumide kontrollitavus, Connextra vorm ja valmisoleku definitsioon (DoR).
import type { Story } from "./types.ts";

/** Hinnangulised sõnad (tüvede algused), mida ei saa jah/ei vastusega kontrollida. */
const SUBJECTIVE_STEMS = [
  "kasutajasõbralik",
  "kiire",
  "kiiresti",
  "lihtne",
  "lihtsa",
  "lihtsalt",
  "mugav",
  "intuitiiv",
  "selge",
  "selgelt",
  "selgesti",
  "ilus",
  "kaunis",
  "kaasaegne",
  "moodne",
  "sujuv",
  "atraktiiv",
  "efektiiv",
  "optimaal",
  "paindlik",
  "meeldiv",
  "professionaal",
  "arusaadav",
  "loogiline",
  "piisav",
  "hästi",
  "korralik",
  "user-friendly",
  "intuitive",
  "fast",
  "easy",
  "simple",
  "clear",
];

/** Üksikud sõnad, mis on tõlgendatavad ainult terviksõnana (et vältida valepositiivseid). */
const SUBJECTIVE_WORDS = ["hea", "head", "hääd", "parem", "parim", "mõistlik", "mõistlikult", "vajadusel"];

const CONJUNCTIONS = /\s(?:ja|ning|samuti|and)\s|;/i;

/** Tegusõnad, mis tähistavad eraldi tingimust (3. pööre olevikus või umbisikuline). */
const VERB_WORDS = new Set(["on", "ei", "saab", "peab", "näeb", "näha", "teha", "olla", "saada", "käia", "viia", "tuua", "is", "can", "shows"]);
const NOT_VERBS = new Set(["veeb", "klubi", "web", "job", "tab", "sub", "pub", "lab", "hub"]);

function isVerbLike(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-zõäöüšž-]/g, "");
  if (!w) return false;
  if (VERB_WORDS.has(w)) return true;
  if (NOT_VERBS.has(w)) return false;
  if (/(takse|dakse|akse|tud|ti)$/.test(w) && w.length > 5) return true;
  // da-tegevusnimi (broneerida, tühistada, maksta)
  if (/(da|ta)$/.test(w) && w.length >= 6) return true;
  return w.length >= 5 && w.endsWith("b");
}

function hasVerb(part: string): boolean {
  return part.split(/\s+/).some(isVerbLike);
}

export interface CriterionIssue {
  code: "subjective" | "multiple" | "too_short" | "question";
  message: string;
}

export function checkCriterion(text: string): CriterionIssue[] {
  const issues: CriterionIssue[] = [];
  const clean = text.trim();
  const lower = clean.toLowerCase();
  const words = lower.split(/[^a-zõäöüšž0-9-]+/).filter(Boolean);

  const subjective = new Set<string>();
  for (const word of words) {
    if (SUBJECTIVE_WORDS.includes(word)) subjective.add(word);
    for (const stem of SUBJECTIVE_STEMS) {
      if (word.startsWith(stem)) subjective.add(word);
    }
  }
  if (subjective.size > 0) {
    issues.push({
      code: "subjective",
      message: `Sisaldab hinnangulist sõna (${[...subjective].join(", ")}), mida ei saa jah/ei vastusega kontrollida.`,
    });
  }

  const parts = clean.split(CONJUNCTIONS).filter((p) => p.trim().length > 0);
  const sentences = clean.split(/[.!?]\s+\S/).length;
  if (sentences > 1 || (parts.length > 1 && parts.filter(hasVerb).length > 1)) {
    issues.push({
      code: "multiple",
      message: "Ühendab tõenäoliselt mitu tingimust. Jaga see eraldi kriteeriumideks.",
    });
  }

  if (words.length < 3) {
    issues.push({ code: "too_short", message: "Liiga lühike, et seda kontrollida." });
  }
  if (clean.endsWith("?")) {
    issues.push({ code: "question", message: "Kriteerium peab olema väide, mitte küsimus." });
  }
  return issues;
}

export function isTestable(text: string): boolean {
  return checkCriterion(text).length === 0;
}

export interface ConnextraIssue {
  field: "role" | "action" | "benefit";
  message: string;
}

export function checkConnextra(story: Pick<Story, "role" | "action" | "benefit">): ConnextraIssue[] {
  const issues: ConnextraIssue[] = [];
  if (story.role.trim().length < 3) issues.push({ field: "role", message: "Roll puudub." });
  if (story.action.trim().length < 5) issues.push({ field: "action", message: "Tegevus puudub või on liiga lühike." });
  if (story.benefit.trim().length < 5) issues.push({ field: "benefit", message: "Kasu (\"et …\") puudub." });
  if (/\s(ja|ning)\s/i.test(story.action) && story.action.split(/\s(?:ja|ning)\s/i).filter(hasVerb).length > 1) {
    issues.push({ field: "action", message: "Tegevuses on mitu eraldi tegevust – lugu võib olla liiga suur." });
  }
  return issues;
}

/** Connextra pealkiri ühe lausena. Roll on salvestatud nimetavas ("Külastaja"), lauses kasutatakse olevat ("Külastajana"). */
export function storyTitle(story: Pick<Story, "role" | "action" | "benefit">): string {
  const role = story.role.trim();
  const roleForm = role ? `${capitalize(roleEssive(role))}` : "[Rollina]";
  const action = story.action.trim() || "[tegevus]";
  const benefit = story.benefit.trim() || "[kasu]";
  return `${roleForm} soovin ${action}, et ${benefit}.`;
}

/** Lihtne olevaline kääne: "külastaja" -> "külastajana", "klubi liige" -> "klubi liikmena". */
export function roleEssive(role: string): string {
  const r = role.trim();
  if (/na$/i.test(r)) return r;
  const lower = r.toLowerCase();
  const special: Record<string, string> = {
    liige: "liikmena",
    treener: "treenerina",
    administraator: "administraatorina",
    klient: "kliendina",
    omanik: "omanikuna",
    kasutaja: "kasutajana",
    külastaja: "külastajana",
    juht: "juhina",
    õpetaja: "õpetajana",
    õpilane: "õpilasena",
  };
  const words = r.split(/\s+/);
  const last = words[words.length - 1].toLowerCase();
  if (special[last]) {
    words[words.length - 1] = special[last];
    return words.join(" ");
  }
  if (special[lower]) return special[lower];
  if (/[aeiouõäöü]$/i.test(r)) return `${r}na`;
  return `${r}ina`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface DorItem {
  ok: boolean;
  label: string;
}

/** Valmisoleku definitsioon (Definition of Ready). */
export function definitionOfReady(story: Story): { ready: boolean; items: DorItem[] } {
  const connextra = checkConnextra(story);
  const untestable = story.criteria.filter((c) => !isTestable(c.text));
  const items: DorItem[] = [
    {
      ok: connextra.length === 0,
      label:
        connextra.length === 0
          ? "Pealkiri on Connextra vormis"
          : `Pealkiri pole Connextra vormis: ${connextra.map((i) => i.message).join(" ")}`,
    },
    {
      ok: story.criteria.length >= 3,
      label: `Vähemalt 3 vastuvõtukriteeriumi (praegu ${story.criteria.length})`,
    },
    {
      ok: story.criteria.length > 0 && untestable.length === 0,
      label:
        untestable.length === 0
          ? "Kõik kriteeriumid on kontrollitavad"
          : `${untestable.length} kriteeriumi ei läbi kontrollitavuse kontrolli`,
    },
    {
      ok: !story.isView || story.mockup !== null,
      label: story.isView ? (story.mockup ? "Vaatel on seotud mockup" : "Vaadet puudutaval lool puudub mockup") : "Lugu ei puuduta vaadet (mockup pole nõutav)",
    },
    {
      ok: story.openQuestions.length === 0,
      label:
        story.openQuestions.length === 0
          ? "Avatud küsimusi pole"
          : `Avatud küsimusi: ${story.openQuestions.length}`,
    },
  ];
  return { ready: items.every((i) => i.ok), items };
}

/** Kriteeriumid, mis viitavad mockup'i elementidele, mida mockup'is pole (kooskõla kontroll). */
export function missingMockupLinks(story: Story): string[] {
  if (!story.mockup) return [];
  const ids = new Set(story.mockup.spec.sections.flatMap((s) => s.elements.map((e) => e.id)));
  return story.criteria.filter((c) => c.elementIds.some((id) => !ids.has(id))).map((c) => c.id);
}

/** Lihtne tekstide sarnasus (Jaccard sõnade põhjal) kattuvate lugude/kriteeriumide leidmiseks. */
export function similarity(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/[^a-zõäöüšž0-9]+/).filter((w) => w.length > 2));
  const wb = new Set(b.toLowerCase().split(/[^a-zõäöüšž0-9]+/).filter((w) => w.length > 2));
  if (wa.size < 3 || wb.size < 3) return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / (wa.size + wb.size - common);
}

/** Ühendab kriteeriumide loendid ilma korduseta (sama või peaaegu sama sõnastus loetakse korduseks). */
export function mergeCriteriaTexts(lists: string[][]): string[] {
  const result: string[] = [];
  for (const text of lists.flat()) {
    const t = text.trim();
    if (!t) continue;
    if (result.some((r) => r.toLowerCase() === t.toLowerCase() || similarity(r, t) > 0.8)) continue;
    result.push(t);
  }
  return result;
}
