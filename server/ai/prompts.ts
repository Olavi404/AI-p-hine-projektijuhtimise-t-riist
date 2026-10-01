// Süsteemiviip ja projekti hetkeseisu kirjeldus. AI saab igal sammul backlog'i tegeliku seisu andmebaasist,
// mitte ainult vestluse ajaloo põhjal.
import type { ChatMessage, Project, Story } from "../../shared/types.ts";
import { STAGE_LABELS, STATUS_LABELS } from "../../shared/types.ts";
import { storyTitle } from "../../shared/quality.ts";

export const SYSTEM_PROMPT = `Sa oled kogenud tarkvaraprojekti juhi abiline, kes aitab projektijuhil kliendiga avakohtumisel muuta umbmäärase idee kasutajalugude backlog'iks.

Põhimõte: sina juhid protsessi, inimene otsustab. Sinu ettepanekud ei muuda midagi enne, kui kasutaja need kinnitab.

Protsessi etapid: Idee → Rollid → Lood → Prioriteedid → Kriteeriumid ja mockup → Täpsustused → Groomimine.

Kirjuta kogu kasutajale nähtav tekst eesti keeles. Väljad "message" on lühikesed (1–3 lauset), sõbralikud ja konkreetsed; lõpeta need soovitusega, mida järgmisena teha.

Kasutajalood on Connextra vormis: "[Rollina] soovin [tegevust], et [kasu]." Salvesta osad eraldi:
- role: roll nimetavas käändes ("Külastaja", "Klubi liige", "Administraator");
- action: tegevus ilma sõnata "soovin" ("näha liikmepakette ja hindu");
- benefit: kasu ilma sõnata "et" ("valida endale sobiv pakett").
Üks lugu = üks roll ja üks tegevus. Ära pane ühte lukku mitut eraldiseisvat tegevust.

Vastuvõtukriteeriumi reegel: iga kriteerium on ÜKS lihtne tingimus, mille kohta saab kontrollimisel vastata jah või ei.
- Kontrollitav: "Paketi hinna juures on märge, kas hind sisaldab käibemaksu."
- Mittekontrollitav: "Hinnad on selgelt näha." (hinnanguline). "Vorm kontrollib andmeid ja saadab meili." (kaks tingimust).
- Ära kasuta hinnangulisi sõnu: kasutajasõbralik, kiire, lihtne, mugav, intuitiivne, selge, ilus, sujuv, hea.
- Ära ühenda tingimusi sõnadega "ja", "ning" kui need on eraldi kontrollitavad.
Kontrolli iga pakutud kriteeriumi enne vastamist selle reegli järgi ise üle.

Mockup on lihtne vaate kavand (wireframe) komponentide loendina: sektsioonid ja nende elemendid. Iga vaadet puudutav kriteerium peab mockup'is nähtav olema: seo see element_ids kaudu vastava(te) elemendiga. Elementide id-d on mockup'i piires unikaalsed (e1, e2, …).

Vasta alati ainult nõutud JSON-struktuuriga.`;

export interface PromptContext {
  project: Project;
  stories: Story[];
  messages: ChatMessage[];
}

/** Projekti tegelik hetkeseis tekstina: AI näeb ka kasutaja käsitsi tehtud muudatusi. */
export function describeState(ctx: PromptContext, opts: { includeMockups?: boolean } = {}): string {
  const { project, stories } = ctx;
  const c = project.context;
  const lines: string[] = [];
  lines.push(`# Projekt: ${project.name}`);
  if (project.description) lines.push(`Kirjeldus: ${project.description}`);
  lines.push(`Praegune etapp: ${STAGE_LABELS[project.stage]}`);
  if (c.idea) lines.push(`Kliendi algne idee: "${c.idea}"`);
  if (c.answers.length > 0) {
    lines.push(`\n## Täpsustused`);
    for (const a of c.answers) lines.push(`- ${a.question} → ${a.answer}`);
  }
  if (c.roles.length > 0) {
    lines.push(`\n## Kinnitatud rollid`);
    for (const r of c.roles) lines.push(`- ${r.name}: ${r.description}`);
  }
  lines.push(`\n## Backlog (${stories.length} lugu, järjekorras)`);
  if (stories.length === 0) lines.push("(tühi)");
  stories.forEach((s, i) => {
    if (project.mvpLine !== null && i === project.mvpLine) lines.push("----- MVP joon (allpool olevad lood ei kuulu esimesse versiooni) -----");
    const focus = s.id === project.focusStoryId ? " [VALITUD LUGU]" : "";
    lines.push(
      `### ${s.code}${focus}: ${storyTitle(s)}\n  roll="${s.role}", tegevus="${s.action}", kasu="${s.benefit}"; staatus: ${STATUS_LABELS[s.status]}; suurus: ${s.size ?? "-"}; vaade: ${s.isView ? "jah" : "ei"}; mockup: ${s.mockup ? `v${s.mockup.version}` : "puudub"}`,
    );
    if (s.criteria.length > 0) {
      lines.push(`  Kriteeriumid:`);
      for (const cr of s.criteria) lines.push(`  - ${cr.text}${cr.elementIds.length ? ` [${cr.elementIds.join(", ")}]` : ""}`);
    } else lines.push(`  Kriteeriumid: puuduvad`);
    if (s.openQuestions.length > 0) lines.push(`  Avatud küsimused: ${s.openQuestions.map((q) => q.text).join(" | ")}`);
    if (opts.includeMockups && s.mockup) lines.push(`  Mockup: ${describeMockup(s)}`);
  });
  if (project.mvpLine !== null && project.mvpLine >= stories.length) lines.push("----- MVP joon (kõik lood on MVP-s) -----");
  return lines.join("\n");
}

function describeMockup(s: Story): string {
  if (!s.mockup) return "-";
  return s.mockup.spec.sections
    .map((sec) => `${sec.heading || sec.id}: ${sec.elements.map((e) => `${e.id}=${e.type}("${e.label}")`).join(", ")}`)
    .join(" / ");
}

/** Viimased vestluse sõnumid lühidalt (ainult kontekstiks; tõeallikas on backlog'i seis). */
export function recentConversation(messages: ChatMessage[], limit = 8): string {
  const recent = messages.slice(-limit);
  if (recent.length === 0) return "(vestlus alles algab)";
  return recent.map((m) => `${m.role === "user" ? "Kasutaja" : "AI"}: ${m.text.slice(0, 300)}`).join("\n");
}
