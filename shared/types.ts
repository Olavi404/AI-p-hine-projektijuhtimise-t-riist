// Ühised andmetüübid, mida kasutavad nii server kui ka brauser.

export const STAGES = ["idea", "roles", "stories", "priorities", "criteria", "refinements", "grooming"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  idea: "Idee",
  roles: "Rollid",
  stories: "Lood",
  priorities: "Prioriteedid",
  criteria: "Kriteeriumid ja mockup",
  refinements: "Täpsustused",
  grooming: "Groomimine",
};

export const STATUSES = ["idea", "needs_clarification", "reviewed", "ready"] as const;
export type StoryStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<StoryStatus, string> = {
  idea: "Idee",
  needs_clarification: "Vajab täpsustamist",
  reviewed: "Läbivaadatud",
  ready: "Valmis arenduseks",
};

export const SIZES = ["S", "M", "L"] as const;
export type StorySize = (typeof SIZES)[number];

// ---------- Mockup ----------

export const ELEMENT_TYPES = [
  "nav",
  "heading",
  "text",
  "image",
  "button",
  "link",
  "input",
  "select",
  "checkbox",
  "list",
  "card",
  "price",
  "badge",
  "notice",
  "table",
] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

export interface MockupElement {
  id: string;
  type: ElementType;
  label: string;
  /** Lisainfo: nt hinna märge, sisendi kohatäide, kaardi kirjeldus. */
  detail: string;
  /** Loendi, valiku, tabeli veergude või navigatsiooni punktid. */
  items: string[];
}

export interface MockupSection {
  id: string;
  heading: string;
  layout: "stack" | "row" | "grid";
  elements: MockupElement[];
}

export interface MockupSpec {
  title: string;
  sections: MockupSection[];
}

export interface MockupVersion {
  id: string;
  storyId: string;
  version: number;
  spec: MockupSpec;
  note: string;
  isCurrent: boolean;
  createdAt: string;
}

// ---------- Backlog ----------

export interface Criterion {
  id: string;
  text: string;
  /** Mockup'i elemendid, kus see kriteerium on nähtav. */
  elementIds: string[];
}

export interface CriterionDraft {
  text: string;
  elementIds: string[];
}

export interface OpenQuestion {
  id: string;
  text: string;
}

export interface Story {
  id: string;
  projectId: string;
  /** Inimloetav tunnus projektis, nt "L3". */
  code: string;
  role: string;
  action: string;
  benefit: string;
  status: StoryStatus;
  position: number;
  size: StorySize | null;
  /** Kas lugu puudutab kasutajaliidese vaadet (siis on mockup kohustuslik). */
  isView: boolean;
  openQuestions: OpenQuestion[];
  origin: "ai" | "manual";
  criteria: Criterion[];
  mockup: MockupVersion | null;
  mockupVersionCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- Projekt ja vestlus ----------

export interface Role {
  name: string;
  description: string;
}

export interface ClarifyQuestion {
  id: string;
  text: string;
  multi: boolean;
  options: string[];
}

export interface ClarifyAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface ProjectContext {
  idea: string;
  questions: ClarifyQuestion[];
  answers: ClarifyAnswer[];
  questionIndex: number;
  roles: Role[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  stage: Stage;
  /** Mitu lugu (backlog'i järjekorras) on MVP joonest ülalpool; null = joont pole määratud. */
  mvpLine: number | null;
  focusStoryId: string | null;
  context: ProjectContext;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  stage: Stage;
  storyCount: number;
  updatedAt: string;
}

export interface ProposedStory {
  role: string;
  action: string;
  benefit: string;
  size: StorySize;
  isView: boolean;
  note: string;
}

export interface StoryDraft {
  role: string;
  action: string;
  benefit: string;
  size: StorySize;
  isView: boolean;
  criteria: string[];
}

export type FindingType = "too_large" | "duplicate" | "untestable_criteria" | "missing_mockup" | "not_connextra" | "other";
export type FixKind = "split" | "merge" | "rewrite" | "generate_mockup" | "none";

export const FINDING_LABELS: Record<FindingType, string> = {
  too_large: "Liiga suur lugu",
  duplicate: "Kattuvad lood",
  untestable_criteria: "Mittekontrollitavad või puuduvad kriteeriumid",
  missing_mockup: "Mockup puudub",
  not_connextra: "Pole Connextra vormis",
  other: "Muu",
};

export interface Finding {
  type: FindingType;
  storyIds: string[];
  problem: string;
  reason: string;
  fixKind: FixKind;
  /** split: uued lood; merge: üks ühendatud lugu; rewrite: üks parandatud lugu. */
  newStories: StoryDraft[];
  status: "pending" | "applied" | "ignored";
}

export interface ChangeAfter {
  role: string;
  action: string;
  benefit: string;
  criteria: CriterionDraft[];
  mockup: MockupSpec | null;
}

export type ProposalPayload =
  | { kind: "roles"; roles: Role[] }
  | { kind: "stories"; stories: ProposedStory[] }
  | { kind: "criteria_mockup"; storyId: string; criteria: CriterionDraft[]; mockup: MockupSpec | null }
  | {
      kind: "change";
      storyId: string;
      request: string;
      summary: string;
      before: ChangeAfter;
      after: ChangeAfter;
      otherStories: { storyId: string; reason: string }[];
    }
  | { kind: "review"; summary: string; findings: Finding[] }
  | { kind: "new_view"; request: string; story: Omit<StoryDraft, "criteria">; criteria: CriterionDraft[]; mockup: MockupSpec };

export type ProposalKind = ProposalPayload["kind"];

export interface Proposal {
  id: string;
  projectId: string;
  storyId: string | null;
  payload: ProposalPayload;
  status: "pending" | "applied" | "rejected";
  createdAt: string;
}

export type ChatAction =
  | { type: "text"; text: string }
  | { type: "answer"; questionId: string; values: string[] }
  | { type: "skip_question"; questionId: string }
  | { type: "propose_roles" }
  | { type: "confirm_roles"; proposalId: string; roles: Role[] }
  | { type: "propose_stories"; feedback?: string }
  | { type: "add_stories"; proposalId: string; indices: number[] }
  | { type: "recommend_priority" }
  | { type: "choose_focus"; storyId: string; moveToTop?: boolean }
  | { type: "pick_focus" }
  | { type: "propose_criteria"; storyId: string }
  | { type: "apply_criteria"; proposalId: string; criteria: CriterionDraft[]; includeMockup: boolean }
  | { type: "refine"; storyId: string; text: string }
  | { type: "apply_change"; proposalId: string; edited?: ChangeAfter }
  | { type: "reject_proposal"; proposalId: string }
  | { type: "next_story" }
  | { type: "review" }
  | { type: "apply_finding"; proposalId: string; index: number; edited?: StoryDraft[] }
  | { type: "ignore_finding"; proposalId: string; index: number }
  | { type: "new_view"; text: string }
  | { type: "apply_new_view"; proposalId: string }
  | { type: "goto_stage"; stage: Stage }
  | { type: "end_meeting" }
  | { type: "resume" };

export interface NextStep {
  label: string;
  action: ChatAction;
  /** AI soovitatud samm kuvatakse esiletõstetuna. */
  primary?: boolean;
}

export type ChatCard =
  | { kind: "question"; question: ClarifyQuestion; index: number; total: number }
  | { kind: "proposal"; proposalId: string }
  | { kind: "priority"; storyId: string; reason: string }
  | { kind: "pick_story"; purpose: "focus" }
  | { kind: "suggestion"; storyId: string; reason: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  card: ChatCard | null;
  nextSteps: NextStep[];
  isError: boolean;
  createdAt: string;
}

export interface ProjectState {
  project: Project;
  stories: Story[];
  messages: ChatMessage[];
  proposals: Proposal[];
  undo: { available: boolean; label: string | null };
  ai: { available: boolean; provider: string };
}
