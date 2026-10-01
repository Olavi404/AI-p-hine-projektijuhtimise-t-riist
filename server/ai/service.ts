// AI sammud: iga samm koostab viiba projekti hetkeseisust, nõuab kindla skeemiga vastust ja kontrollib selle sisu.
import type { AiProvider } from "./provider.ts";
import {
  ClarifySchema,
  CriteriaMockupSchema,
  InterpretSchema,
  NewViewSchema,
  PrioritySchema,
  RefineSchema,
  ReviewSchema,
  RolesSchema,
  StoriesSchema,
  type ClarifyOut,
  type CriteriaMockupOut,
  type InterpretOut,
  type MockupOut,
  type NewViewOut,
  type PriorityOut,
  type RefineOut,
  type ReviewOut,
  type RolesOut,
  type StoriesOut,
} from "./schemas.ts";
import { SYSTEM_PROMPT, describeState, recentConversation, type PromptContext } from "./prompts.ts";
import * as mock from "./mock.ts";
import { checkCriterion, checkConnextra, storyTitle } from "../../shared/quality.ts";
import type { Story } from "../../shared/types.ts";

export class AiService {
  constructor(private provider: AiProvider) {}

  get available(): boolean {
    return this.provider.available;
  }

  get providerName(): string {
    return this.provider.name;
  }

  clarify(ctx: PromptContext): Promise<ClarifyOut> {
    return this.provider.generate({
      step: "clarify",
      system: SYSTEM_PROMPT,
      user: `${describeState(ctx)}

Ülesanne: kasutaja kirjeldas just oma idee. Enne lugude pakkumist esita 1–3 täpsustavat küsimust, mis mõjutavad kõige rohkem seda, milliseid lugusid ja töövooge on vaja (nt kes on kasutajad, kas makstakse veebis, mis on peamine eesmärk).
Igal küsimusel on 2–5 lühikest valmis vastusevarianti (nupud). Ära lisa variante "Muu" ega "Jäta vahele" – need lisab rakendus ise.
Kui küsimus on kasutajarollide kohta, märgi multi=true.
Kui idee on juba väga täpne, võid esitada ainult ühe küsimuse.
"message": lühike sissejuhatus, nt "Enne lugude pakkumist täpsustan paari asja."`,
      schema: ClarifySchema,
      validate: (out) => {
        const p: string[] = [];
        if (out.questions.length === 0) p.push("Esita vähemalt üks täpsustav küsimus.");
        out.questions.forEach((q, i) => {
          if (q.options.length < 2) p.push(`Küsimusel ${i + 1} peab olema vähemalt 2 vastusevarianti.`);
        });
        return p;
      },
      mock: () => mock.clarify(ctx),
    });
  }

  roles(ctx: PromptContext): Promise<RolesOut> {
    return this.provider.generate({
      step: "roles",
      system: SYSTEM_PROMPT,
      user: `${describeState(ctx)}

Ülesanne: paku idee ja täpsustuste põhjal rakenduse kasutajarollid (tavaliselt 2–5). Kui kasutaja on täpsustustes rollid juba valinud, lähtu neist ja lisa ainult hädavajalikud. Esimene roll on see, kelle põhitöövoog (happy path) on kõige olulisem.
"message": nt "Pakun need rollid. Vali, millised jäävad, või lisa oma."`,
      schema: RolesSchema,
      mock: () => mock.roles(ctx),
    });
  }

  stories(ctx: PromptContext, feedback?: string): Promise<StoriesOut> {
    return this.provider.generate({
      step: "stories",
      system: SYSTEM_PROMPT,
      user: `${describeState(ctx)}

Viimane vestlus:
${recentConversation(ctx.messages)}

Ülesanne: paku 5–8 kasutajalugu peamise rolli põhitöövoo (happy path) järjekorras: tüüpilise kasutaja edukas teekond algusest lõpuni, ilma vigade ja erijuhtudeta. Lisa vajaduse korral lõppu 1–2 teiste rollide lugu, mis on töövoo toimimiseks vältimatud.
Ära paku lugusid, mis juba on backlog'is (vaata ülal).${feedback ? `\n\nKasutaja soovib teistsuguseid ettepanekuid. Tagasiside: "${feedback}"` : ""}
"message": nt "Pakun külastaja põhitöövoo põhjal 7 lugu. Need on happy path'i järjekorras."`,
      schema: StoriesSchema,
      validate: (out) => {
        const p: string[] = [];
        if (out.stories.length < 5) p.push(`Paku vähemalt 5 lugu (pakkusid ${out.stories.length}).`);
        out.stories.forEach((s, i) => {
          const issues = checkConnextra(s);
          if (issues.some((x) => x.field !== "action")) p.push(`Lugu ${i + 1} pole Connextra vormis: ${issues.map((x) => x.message).join(" ")}`);
        });
        return p;
      },
      mock: () => mock.stories(ctx, feedback),
    });
  }

  priority(ctx: PromptContext): Promise<PriorityOut> {
    return this.provider.generate({
      step: "priority",
      system: SYSTEM_PROMPT,
      user: `${describeState(ctx)}

Ülesanne: soovita, millisest backlog'i loost alustada (kliendi jaoks kõige olulisem). Põhjenda ühe-kahe lausega, miks just see (nt ilma selleta pole ülejäänud töövool mõtet). Viita loole tunnusega (story_code, nt "L2").
"message": küsi, milline lugu on kliendile kõige olulisem, ja too välja oma soovitus.`,
      schema: PrioritySchema,
      validate: (out) => (codeExists(ctx, out.story_code) ? [] : [`Lugu tunnusega "${out.story_code}" pole backlog'is.`]),
      mock: () => mock.priority(ctx),
    });
  }

  criteriaMockup(ctx: PromptContext, story: Story): Promise<CriteriaMockupOut> {
    return this.provider.generate({
      step: "criteria_mockup",
      system: SYSTEM_PROMPT,
      user: `${describeState(ctx, { includeMockups: true })}

Ülesanne: paku loole ${story.code} ("${storyTitle(story)}") 4–6 vastuvõtukriteeriumi ja ${story.isView ? "vaate mockup" : "lihtne mockup (lugu ei pruugi olla vaade, kuid näita, kus tulemus kasutajale paistab)"}.
${story.criteria.length > 0 ? `Loo olemasolevad kriteeriumid on ülal; säilita need, mis on kontrollitavad, ja täienda.` : ""}
${story.mockup ? "Lool on juba mockup (vt ülal); paranda ja täienda seda, ära alusta nullist." : ""}
Mockup näitab sisu, paigutust ja kasutaja tegevusi (nupud, vormiväljad). Iga vaadet puudutav kriteerium viitab element_ids kaudu elemendile, kus see on nähtav.
"message": nt "Pakun sellele loole 5 vastuvõtukriteeriumi ja mockup'i."`,
      schema: CriteriaMockupSchema,
      validate: (out) => validateCriteriaAndMockup(out.criteria, out.mockup, story.isView),
      soft: (out) => criteriaQuality(out.criteria, 3),
      mock: () => mock.criteriaMockup(ctx, story),
    });
  }

  refine(ctx: PromptContext, story: Story, request: string): Promise<RefineOut> {
    return this.provider.generate({
      step: "refine",
      system: SYSTEM_PROMPT,
      user: `${describeState(ctx, { includeMockups: true })}

Loo ${story.code} praegune mockup (JSON):
${JSON.stringify(story.mockup?.spec ?? null)}

Kliendi täpsustus loo ${story.code} kohta: "${request}"

Ülesanne: koosta muudatusettepanek AINULT loole ${story.code}. Tagasta loo uus sõnastus (role, action, benefit), kriteeriumide TÄIELIK uus loend ja mockup'i TÄIELIK uus versioon (muuda olemasolevat minimaalselt, säilita elementide id-d; uued elemendid saavad uued id-d).
Muuda ainult seda, mida täpsustus nõuab. Kui täpsustus mõjutab ka teisi lugusid, ÄRA neid muuda – loetle need other_stories all koos põhjendusega.
"summary": nt 'Mockup'is lisandub hinna alla märge "sh km" ja kriteeriumide hulka lisandub üks kriteerium. Teisi lugusid see ei mõjuta.'`,
      schema: RefineSchema,
      validate: (out) => {
        const p = validateCriteriaAndMockup(out.criteria, out.mockup, story.isView);
        for (const o of out.other_stories) {
          if (o.story_code === story.code) p.push("other_stories ei tohi sisaldada muudetavat lugu ennast.");
          else if (!codeExists(ctx, o.story_code)) p.push(`other_stories: lugu "${o.story_code}" pole backlog'is.`);
        }
        return p;
      },
      soft: (out) => criteriaQuality(out.criteria, 1),
      mock: () => mock.refine(ctx, story, request),
    });
  }

  review(ctx: PromptContext): Promise<ReviewOut> {
    return this.provider.generate({
      step: "review",
      system: SYSTEM_PROMPT,
      user: `${describeState(ctx, { includeMockups: true })}

Ülesanne: vaata kogu backlog üle (groomimine) ja leia probleemid. Otsi vähemalt:
- liiga suured lood (mitu rolli või mitu eraldi tegevust ühes loos, väga palju kriteeriume) → fix_kind "split", new_stories: 2+ väiksemat lugu, mille vahel on algse loo kriteeriumid jaotatud;
- sisuliselt kattuvad lood → fix_kind "merge", story_codes: kõik kattuvad lood, new_stories: 1 ühendatud lugu ja kriteeriumide ühendatud loend ilma korduseta;
- mittekontrollitavad või puuduvad kriteeriumid → fix_kind "rewrite", new_stories: 1 sama lugu parandatud/lisatud kriteeriumidega (kogu loend);
- vaadet puudutavad lood, millel pole mockup'i → fix_kind "generate_mockup", new_stories tühi;
- lood, mis pole Connextra vormis → fix_kind "rewrite".
Iga leiu kohta: problem (mis on valesti), reason (miks see on probleem), konkreetne ettepanek new_stories kaudu.
Kui probleeme pole, tagasta tühi findings ja ütle seda message'is.`,
      schema: ReviewSchema,
      validate: (out) => {
        const p: string[] = [];
        out.findings.forEach((f, i) => {
          const missing = f.story_codes.filter((c) => !codeExists(ctx, c));
          if (missing.length) p.push(`Leid ${i + 1}: lugusid ${missing.join(", ")} pole backlog'is.`);
          if (f.fix_kind === "split" && f.new_stories.length < 2) p.push(`Leid ${i + 1}: jagamisel peab olema vähemalt 2 uut lugu.`);
          if (f.fix_kind === "merge" && (f.story_codes.length < 2 || f.new_stories.length !== 1))
            p.push(`Leid ${i + 1}: ühendamisel peab olema 2+ algset lugu ja täpselt 1 ühendatud lugu.`);
          if (f.fix_kind === "rewrite" && (f.story_codes.length !== 1 || f.new_stories.length !== 1))
            p.push(`Leid ${i + 1}: ümbersõnastamisel peab olema täpselt 1 lugu ja 1 parandatud lugu.`);
        });
        return p;
      },
      mock: () => mock.review(ctx),
    });
  }

  newView(ctx: PromptContext, request: string): Promise<NewViewOut> {
    return this.provider.generate({
      step: "new_view",
      system: SYSTEM_PROMPT,
      user: `${describeState(ctx)}

Kasutaja kirjeldab uut vaadet: "${request}"

Ülesanne: loo selle vaate kohta korraga mockup, Connextra vormis kasutajaloo osad (role, action, benefit) ja 3–6 vastuvõtukriteeriumi, mis on mockup'iga kooskõlas.
"message": lühike kokkuvõte, mida pakud.`,
      schema: NewViewSchema,
      validate: (out) => [...validateCriteriaAndMockup(out.criteria, out.mockup, true), ...checkConnextra(out).filter((x) => x.field !== "action").map((x) => x.message)],
      soft: (out) => criteriaQuality(out.criteria, 3),
      mock: () => mock.newView(ctx, request),
    });
  }

  interpret(ctx: PromptContext, text: string, pending: string): Promise<InterpretOut> {
    return this.provider.generate({
      step: "interpret",
      system: SYSTEM_PROMPT,
      user: `${describeState(ctx)}

Viimane vestlus:
${recentConversation(ctx.messages)}

Rakendus ootab praegu: ${pending}

Kasutaja kirjutas vabalt: "${text}"

Ülesanne: tõlgenda, mida kasutaja soovib, ja vali intent:
- answer: vastus ootel küsimusele (text = vastus);
- set_roles: rollide määramine (roles = rollide nimed);
- stories_feedback: soovib teistsuguseid/lisa lugusid (text = tagasiside);
- choose_story: tahab alustada kindlast loost või valib loo (story_code);
- refine_story: kliendi täpsustus olemasoleva loo kohta (story_code, text = täpsustus);
- new_view: kirjeldab uut vaadet, mida backlog'is pole (text = kirjeldus);
- review: soovib backlog'i ülevaatust;
- next_story: soovib järgmise looga jätkata;
- end_meeting: soovib kohtumise lõpetada;
- other: muu küsimus või kommentaar (vasta message'is lühidalt ja suuna protsessi juurde tagasi).
"message": lühike vastus, mis näitab, kuidas sa soovist aru said.`,
      schema: InterpretSchema,
      validate: (out) => (out.story_code && !codeExists(ctx, out.story_code) ? [`Lugu "${out.story_code}" pole backlog'is.`] : []),
      mock: () => mock.interpret(ctx, text, pending),
    });
  }
}

function codeExists(ctx: PromptContext, code: string): boolean {
  return ctx.stories.some((s) => s.code.toLowerCase() === code.trim().toLowerCase());
}

/** Mockup'i struktuur ja kriteeriumide kooskõla mockup'iga (kõvad nõuded). */
export function validateCriteriaAndMockup(criteria: { text: string; element_ids: string[] }[], mockup: MockupOut, isView: boolean): string[] {
  const p: string[] = [];
  const ids = mockup.sections.flatMap((s) => s.elements.map((e) => e.id));
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) p.push(`Mockup'i elementide id-d peavad olema unikaalsed (korduvad: ${[...new Set(dupes)].join(", ")}).`);
  if (mockup.sections.some((s) => s.elements.length === 0)) p.push("Mockup'i igas sektsioonis peab olema vähemalt üks element.");
  const known = new Set(ids);
  criteria.forEach((c, i) => {
    const bad = c.element_ids.filter((id) => !known.has(id));
    if (bad.length) p.push(`Kriteerium ${i + 1} viitab elementidele, mida mockup'is pole: ${bad.join(", ")}.`);
  });
  if (isView && criteria.length > 0 && criteria.every((c) => c.element_ids.length === 0)) {
    p.push("Vaadet puudutavad kriteeriumid peavad olema seotud mockup'i elementidega (element_ids).");
  }
  return p;
}

/** Kriteeriumide kvaliteet reeglipõhise kontrolli järgi (pehmed nõuded: AI saab võimaluse parandada). */
export function criteriaQuality(criteria: { text: string }[], min: number): string[] {
  const p: string[] = [];
  if (criteria.length < min) p.push(`Paku vähemalt ${min} kriteeriumi.`);
  criteria.forEach((c, i) => {
    const issues = checkCriterion(c.text);
    if (issues.length) p.push(`Kriteerium ${i + 1} ("${c.text}") ei ole kontrollitav: ${issues.map((x) => x.message).join(" ")}`);
  });
  return p;
}
