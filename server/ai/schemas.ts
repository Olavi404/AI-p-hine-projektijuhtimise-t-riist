// AI vastuste kokkulepitud JSON-skeemid. Sama skeemi kasutatakse nii API-le struktureeritud väljundi nõudmiseks
// kui ka serveris vastuse kontrollimiseks enne kasutajale näitamist.
import { z } from "zod";
import { ELEMENT_TYPES } from "../../shared/types.ts";

const size = z.enum(["S", "M", "L"]);

export const MockupSchema = z.object({
  title: z.string().describe("Vaate pealkiri"),
  sections: z
    .array(
      z.object({
        id: z.string().describe("Sektsiooni lühitunnus, nt s1"),
        heading: z.string().describe("Sektsiooni pealkiri või tühi string"),
        layout: z.enum(["stack", "row", "grid"]),
        elements: z.array(
          z.object({
            id: z.string().describe("Projekti piires unikaalne elemendi tunnus, nt e1, e2"),
            type: z.enum(ELEMENT_TYPES),
            label: z.string().describe("Elemendi nähtav tekst"),
            detail: z.string().describe("Lisatekst (nt 'sh km', kohatäide) või tühi string"),
            items: z.array(z.string()).describe("Loendi/valiku/tabeli/menüü punktid või tühi massiiv"),
          }),
        ),
      }),
    )
    .min(1),
});

const CriterionSchema = z.object({
  text: z.string().describe("Üks jah/ei vastusega kontrollitav tingimus"),
  element_ids: z.array(z.string()).describe("Mockup'i elementide id-d, kus kriteerium on nähtav; vaadet mittepuudutaval kriteeriumil tühi"),
});

export const ClarifySchema = z.object({
  message: z.string(),
  questions: z
    .array(
      z.object({
        text: z.string(),
        multi: z.boolean().describe("true kui saab valida mitu vastust"),
        options: z.array(z.string()).describe("2–5 valmis vastusevarianti"),
      }),
    )
    .max(3),
});

export const RolesSchema = z.object({
  message: z.string(),
  roles: z.array(z.object({ name: z.string().describe("Roll nimetavas käändes, nt 'Külastaja'"), description: z.string() })).min(1),
});

export const StoriesSchema = z.object({
  message: z.string(),
  stories: z
    .array(
      z.object({
        role: z.string().describe("Roll nimetavas käändes, nt 'Külastaja'"),
        action: z.string().describe("Tegevus ilma sõnata 'soovin', nt 'näha liikmepakette ja hindu'"),
        benefit: z.string().describe("Kasu ilma sõnata 'et', nt 'valida endale sobiv pakett'"),
        size: size,
        is_view: z.boolean().describe("Kas lugu puudutab kasutajaliidese vaadet"),
        note: z.string().describe("Lühike märkus, miks lugu on selles kohas, või tühi string"),
      }),
    )
    .min(1),
});

export const PrioritySchema = z.object({
  message: z.string(),
  story_code: z.string().describe("Soovitatud loo tunnus, nt L3"),
  reason: z.string(),
});

export const CriteriaMockupSchema = z.object({
  message: z.string(),
  criteria: z.array(CriterionSchema).min(1),
  mockup: MockupSchema,
});

export const RefineSchema = z.object({
  message: z.string(),
  summary: z.string().describe("Muudatuse lühikokkuvõte: mis muutub mockup'is, sõnastuses ja kriteeriumides"),
  role: z.string(),
  action: z.string(),
  benefit: z.string(),
  criteria: z.array(CriterionSchema).describe("Loo kriteeriumide TÄIELIK uus loend"),
  mockup_changed: z.boolean(),
  mockup: MockupSchema.describe("Loo mockup'i TÄIELIK uus versioon (kui ei muutu, korda olemasolevat)"),
  other_stories: z
    .array(z.object({ story_code: z.string(), reason: z.string() }))
    .describe("Teised lood, mida täpsustus võib mõjutada. Neid EI muudeta, ainult soovitatakse eraldi ettepanekuna."),
});

export const ReviewSchema = z.object({
  message: z.string(),
  summary: z.string(),
  findings: z.array(
    z.object({
      type: z.enum(["too_large", "duplicate", "untestable_criteria", "missing_mockup", "not_connextra", "other"]),
      story_codes: z.array(z.string()).min(1),
      problem: z.string(),
      reason: z.string(),
      fix_kind: z.enum(["split", "merge", "rewrite", "generate_mockup", "none"]),
      new_stories: z
        .array(
          z.object({
            role: z.string(),
            action: z.string(),
            benefit: z.string(),
            size: size,
            is_view: z.boolean(),
            criteria: z.array(z.string()),
          }),
        )
        .describe("split: 2+ uut lugu koos jaotatud kriteeriumidega; merge: 1 ühendatud lugu ilma korduvate kriteeriumideta; rewrite: 1 parandatud lugu; muidu tühi"),
    }),
  ),
});

export const NewViewSchema = z.object({
  message: z.string(),
  role: z.string(),
  action: z.string(),
  benefit: z.string(),
  size: size,
  criteria: z.array(CriterionSchema).min(1),
  mockup: MockupSchema,
});

export const INTENTS = [
  "answer",
  "set_roles",
  "stories_feedback",
  "choose_story",
  "refine_story",
  "new_view",
  "review",
  "next_story",
  "end_meeting",
  "other",
] as const;

export const InterpretSchema = z.object({
  message: z.string().describe("Lühike vastus kasutajale eesti keeles"),
  intent: z.enum(INTENTS),
  story_code: z.string().describe("Asjakohase loo tunnus (nt L2) või tühi string"),
  text: z.string().describe("Kasutaja soov puhastatud kujul (vastus, tagasiside, täpsustus või vaate kirjeldus) või tühi string"),
  roles: z.array(z.string()).describe("set_roles korral rollide nimed, muidu tühi"),
});

export type ClarifyOut = z.infer<typeof ClarifySchema>;
export type RolesOut = z.infer<typeof RolesSchema>;
export type StoriesOut = z.infer<typeof StoriesSchema>;
export type PriorityOut = z.infer<typeof PrioritySchema>;
export type CriteriaMockupOut = z.infer<typeof CriteriaMockupSchema>;
export type RefineOut = z.infer<typeof RefineSchema>;
export type ReviewOut = z.infer<typeof ReviewSchema>;
export type NewViewOut = z.infer<typeof NewViewSchema>;
export type InterpretOut = z.infer<typeof InterpretSchema>;
export type MockupOut = z.infer<typeof MockupSchema>;
