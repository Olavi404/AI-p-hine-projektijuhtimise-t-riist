// Andmete lugemine ja muutmine. Kõik backlog'i muudatused käivad läbi `mutate`, mis salvestab enne muudatust hetkeseisu (tagasivõtmiseks).
import { randomUUID } from "node:crypto";
import { transaction, type DB } from "./db.ts";
import type {
  ChatCard,
  ChatMessage,
  CriterionDraft,
  MockupSpec,
  MockupVersion,
  NextStep,
  OpenQuestion,
  Project,
  ProjectContext,
  ProjectSummary,
  Proposal,
  ProposalPayload,
  Stage,
  Story,
  StorySize,
  StoryStatus,
} from "../shared/types.ts";

type Row = Record<string, any>;

const now = () => new Date().toISOString();
const MAX_SNAPSHOTS = 50;

export const emptyContext = (): ProjectContext => ({ idea: "", questions: [], answers: [], questionIndex: 0, roles: [] });

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

export interface StoryInput {
  role: string;
  action: string;
  benefit: string;
  size?: StorySize | null;
  isView?: boolean;
  status?: StoryStatus;
  openQuestions?: OpenQuestion[];
  origin: "ai" | "manual";
}

export type StoryPatch = Partial<Pick<Story, "role" | "action" | "benefit" | "status" | "size" | "isView" | "openQuestions">>;

export class Repo {
  constructor(private db: DB) {}

  // ---------- Projektid ----------

  listProjects(): ProjectSummary[] {
    const rows = this.db
      .prepare(
        `SELECT p.*, (SELECT COUNT(*) FROM stories s WHERE s.project_id = p.id) AS story_count
         FROM projects p ORDER BY p.updated_at DESC`,
      )
      .all() as Row[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      stage: r.stage,
      storyCount: Number(r.story_count),
      updatedAt: r.updated_at,
    }));
  }

  createProject(name: string, description: string): Project {
    const id = randomUUID();
    const ts = now();
    this.db
      .prepare(
        `INSERT INTO projects (id, name, description, stage, context, created_at, updated_at) VALUES (?, ?, ?, 'idea', ?, ?, ?)`,
      )
      .run(id, name, description, JSON.stringify(emptyContext()), ts, ts);
    return this.getProject(id);
  }

  getProject(id: string): Project {
    const r = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Row | undefined;
    if (!r) throw new NotFoundError("Projekti ei leitud.");
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      stage: r.stage,
      mvpLine: r.mvp_line === null ? null : Number(r.mvp_line),
      focusStoryId: r.focus_story_id,
      context: { ...emptyContext(), ...JSON.parse(r.context) },
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  updateProject(
    id: string,
    patch: Partial<{ name: string; description: string; stage: Stage; mvpLine: number | null; focusStoryId: string | null; context: ProjectContext }>,
  ): Project {
    const p = this.getProject(id);
    const next = { ...p, ...patch };
    this.db
      .prepare(
        `UPDATE projects SET name = ?, description = ?, stage = ?, mvp_line = ?, focus_story_id = ?, context = ?, updated_at = ? WHERE id = ?`,
      )
      .run(next.name, next.description, next.stage, next.mvpLine, next.focusStoryId, JSON.stringify(next.context), now(), id);
    return this.getProject(id);
  }

  deleteProject(id: string): void {
    this.db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
  }

  // ---------- Lood ----------

  listStories(projectId: string): Story[] {
    const rows = this.db.prepare(`SELECT * FROM stories WHERE project_id = ? ORDER BY position`).all(projectId) as Row[];
    return rows.map((r) => this.hydrateStory(r));
  }

  getStory(id: string): Story {
    const r = this.db.prepare(`SELECT * FROM stories WHERE id = ?`).get(id) as Row | undefined;
    if (!r) throw new NotFoundError("Lugu ei leitud.");
    return this.hydrateStory(r);
  }

  /** Kontrollib, et lugu kuulub projekti (et üks projekt ei saaks teise lugusid muuta). */
  getProjectStory(projectId: string, storyId: string): Story {
    const story = this.getStory(storyId);
    if (story.projectId !== projectId) throw new NotFoundError("Lugu ei kuulu sellesse projekti.");
    return story;
  }

  private hydrateStory(r: Row): Story {
    const criteria = (this.db.prepare(`SELECT * FROM criteria WHERE story_id = ? ORDER BY position`).all(r.id) as Row[]).map((c) => ({
      id: c.id,
      text: c.text,
      elementIds: JSON.parse(c.element_ids),
    }));
    const mockupRow = this.db.prepare(`SELECT * FROM mockups WHERE story_id = ? AND is_current = 1`).get(r.id) as Row | undefined;
    const count = this.db.prepare(`SELECT COUNT(*) AS n FROM mockups WHERE story_id = ?`).get(r.id) as Row;
    return {
      id: r.id,
      projectId: r.project_id,
      code: r.code,
      role: r.role,
      action: r.action,
      benefit: r.benefit,
      status: r.status,
      position: Number(r.position),
      size: r.size,
      isView: Boolean(r.is_view),
      openQuestions: JSON.parse(r.open_questions),
      origin: r.origin,
      criteria,
      mockup: mockupRow ? mapMockup(mockupRow) : null,
      mockupVersionCount: Number(count.n),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  createStory(projectId: string, input: StoryInput, atIndex?: number): Story {
    const id = randomUUID();
    const ts = now();
    this.db.prepare(`UPDATE projects SET story_counter = story_counter + 1 WHERE id = ?`).run(projectId);
    const counter = Number((this.db.prepare(`SELECT story_counter FROM projects WHERE id = ?`).get(projectId) as Row).story_counter);
    const count = Number((this.db.prepare(`SELECT COUNT(*) AS n FROM stories WHERE project_id = ?`).get(projectId) as Row).n);
    this.db
      .prepare(
        `INSERT INTO stories (id, project_id, code, role, action, benefit, status, position, size, is_view, open_questions, origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        projectId,
        `L${counter}`,
        input.role.trim(),
        input.action.trim(),
        input.benefit.trim(),
        input.status ?? "idea",
        count,
        input.size ?? null,
        input.isView === false ? 0 : 1,
        JSON.stringify(input.openQuestions ?? []),
        input.origin,
        ts,
        ts,
      );
    if (atIndex !== undefined && atIndex < count) {
      const ids = this.listStories(projectId).map((s) => s.id);
      ids.splice(ids.indexOf(id), 1);
      ids.splice(atIndex, 0, id);
      this.reorder(projectId, ids);
    }
    return this.getStory(id);
  }

  updateStory(id: string, patch: StoryPatch): Story {
    const s = this.getStory(id);
    const next = { ...s, ...patch };
    this.db
      .prepare(
        `UPDATE stories SET role = ?, action = ?, benefit = ?, status = ?, size = ?, is_view = ?, open_questions = ?, updated_at = ? WHERE id = ?`,
      )
      .run(next.role.trim(), next.action.trim(), next.benefit.trim(), next.status, next.size, next.isView ? 1 : 0, JSON.stringify(next.openQuestions), now(), id);
    return this.getStory(id);
  }

  deleteStory(id: string): void {
    const s = this.getStory(id);
    this.db.prepare(`DELETE FROM stories WHERE id = ?`).run(id);
    this.reorder(
      s.projectId,
      this.listStories(s.projectId).map((x) => x.id),
    );
    const p = this.getProject(s.projectId);
    if (p.focusStoryId === id) this.updateProject(p.id, { focusStoryId: null });
  }

  reorder(projectId: string, orderedIds: string[]): void {
    const existing = this.db.prepare(`SELECT id FROM stories WHERE project_id = ?`).all(projectId) as Row[];
    const known = new Set(existing.map((r) => r.id as string));
    if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id))) {
      throw new ValidationError("Järjestus peab sisaldama täpselt projekti kõiki lugusid.");
    }
    const stmt = this.db.prepare(`UPDATE stories SET position = ? WHERE id = ?`);
    orderedIds.forEach((id, i) => stmt.run(i, id));
  }

  setCriteria(storyId: string, drafts: CriterionDraft[]): void {
    this.db.prepare(`DELETE FROM criteria WHERE story_id = ?`).run(storyId);
    const stmt = this.db.prepare(`INSERT INTO criteria (id, story_id, text, element_ids, position) VALUES (?, ?, ?, ?, ?)`);
    drafts
      .filter((d) => d.text.trim().length > 0)
      .forEach((d, i) => stmt.run(randomUUID(), storyId, d.text.trim(), JSON.stringify(d.elementIds ?? []), i));
    this.db.prepare(`UPDATE stories SET updated_at = ? WHERE id = ?`).run(now(), storyId);
  }

  // ---------- Mockup'id ----------

  addMockupVersion(storyId: string, spec: MockupSpec, note: string): MockupVersion {
    const max = this.db.prepare(`SELECT COALESCE(MAX(version), 0) AS v FROM mockups WHERE story_id = ?`).get(storyId) as Row;
    const id = randomUUID();
    this.db.prepare(`UPDATE mockups SET is_current = 0 WHERE story_id = ?`).run(storyId);
    this.db
      .prepare(`INSERT INTO mockups (id, story_id, version, spec, note, is_current, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)`)
      .run(id, storyId, Number(max.v) + 1, JSON.stringify(spec), note, now());
    this.db.prepare(`UPDATE stories SET updated_at = ? WHERE id = ?`).run(now(), storyId);
    return mapMockup(this.db.prepare(`SELECT * FROM mockups WHERE id = ?`).get(id) as Row);
  }

  listMockupVersions(storyId: string): MockupVersion[] {
    return (this.db.prepare(`SELECT * FROM mockups WHERE story_id = ? ORDER BY version DESC`).all(storyId) as Row[]).map(mapMockup);
  }

  setCurrentMockup(storyId: string, mockupId: string): void {
    const row = this.db.prepare(`SELECT id FROM mockups WHERE id = ? AND story_id = ?`).get(mockupId, storyId);
    if (!row) throw new NotFoundError("Mockup'i versiooni ei leitud.");
    this.db.prepare(`UPDATE mockups SET is_current = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE story_id = ?`).run(mockupId, storyId);
  }

  // ---------- Vestlus ----------

  addMessage(
    projectId: string,
    msg: { role: "user" | "assistant"; text: string; card?: ChatCard | null; nextSteps?: NextStep[]; isError?: boolean },
  ): ChatMessage {
    const id = randomUUID();
    const seq = Number((this.db.prepare(`SELECT COALESCE(MAX(seq), 0) AS s FROM messages WHERE project_id = ?`).get(projectId) as Row).s) + 1;
    this.db
      .prepare(`INSERT INTO messages (id, project_id, seq, role, text, card, next_steps, is_error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, projectId, seq, msg.role, msg.text, msg.card ? JSON.stringify(msg.card) : null, JSON.stringify(msg.nextSteps ?? []), msg.isError ? 1 : 0, now());
    this.db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now(), projectId);
    return this.listMessages(projectId).at(-1)!;
  }

  listMessages(projectId: string): ChatMessage[] {
    return (this.db.prepare(`SELECT * FROM messages WHERE project_id = ? ORDER BY seq`).all(projectId) as Row[]).map((r) => ({
      id: r.id,
      role: r.role,
      text: r.text,
      card: r.card ? JSON.parse(r.card) : null,
      nextSteps: JSON.parse(r.next_steps),
      isError: Boolean(r.is_error),
      createdAt: r.created_at,
    }));
  }

  // ---------- Ettepanekud ----------

  createProposal(projectId: string, storyId: string | null, payload: ProposalPayload): Proposal {
    const id = randomUUID();
    this.db
      .prepare(`INSERT INTO proposals (id, project_id, story_id, payload, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`)
      .run(id, projectId, storyId, JSON.stringify(payload), now());
    return this.getProposal(projectId, id);
  }

  getProposal(projectId: string, id: string): Proposal {
    const r = this.db.prepare(`SELECT * FROM proposals WHERE id = ? AND project_id = ?`).get(id, projectId) as Row | undefined;
    if (!r) throw new NotFoundError("Ettepanekut ei leitud.");
    return mapProposal(r);
  }

  listProposals(projectId: string): Proposal[] {
    return (this.db.prepare(`SELECT * FROM proposals WHERE project_id = ? ORDER BY created_at`).all(projectId) as Row[]).map(mapProposal);
  }

  updateProposal(projectId: string, id: string, patch: Partial<Pick<Proposal, "status" | "payload">>): Proposal {
    const p = this.getProposal(projectId, id);
    const next = { ...p, ...patch };
    this.db.prepare(`UPDATE proposals SET status = ?, payload = ? WHERE id = ?`).run(next.status, JSON.stringify(next.payload), id);
    return this.getProposal(projectId, id);
  }

  // ---------- Tagasivõtmine ----------

  /** Teeb backlog'i muudatuse ühes transaktsioonis ja salvestab eelneva seisu, et seda saaks tagasi võtta. */
  mutate<T>(projectId: string, label: string, fn: () => T): T {
    return transaction(this.db, () => {
      this.pushSnapshot(projectId, label);
      const result = fn();
      this.db.prepare(`UPDATE projects SET updated_at = ? WHERE id = ?`).run(now(), projectId);
      return result;
    });
  }

  private pushSnapshot(projectId: string, label: string): void {
    const project = this.db.prepare(`SELECT mvp_line, focus_story_id, story_counter FROM projects WHERE id = ?`).get(projectId) as Row;
    if (!project) throw new NotFoundError("Projekti ei leitud.");
    const stories = this.db.prepare(`SELECT * FROM stories WHERE project_id = ?`).all(projectId);
    const criteria = this.db.prepare(`SELECT c.* FROM criteria c JOIN stories s ON s.id = c.story_id WHERE s.project_id = ?`).all(projectId);
    const mockups = this.db.prepare(`SELECT m.* FROM mockups m JOIN stories s ON s.id = m.story_id WHERE s.project_id = ?`).all(projectId);
    const data = JSON.stringify({ project, stories, criteria, mockups });
    this.db.prepare(`INSERT INTO snapshots (project_id, label, data, created_at) VALUES (?, ?, ?, ?)`).run(projectId, label, data, now());
    this.db
      .prepare(
        `DELETE FROM snapshots WHERE project_id = ? AND id NOT IN (SELECT id FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT ?)`,
      )
      .run(projectId, projectId, MAX_SNAPSHOTS);
  }

  lastSnapshotLabel(projectId: string): string | null {
    const r = this.db.prepare(`SELECT label FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 1`).get(projectId) as Row | undefined;
    return r ? r.label : null;
  }

  /** Taastab viimase muudatuse eelse seisu. Tagastab tagasi võetud muudatuse nime. */
  undo(projectId: string): string {
    return transaction(this.db, () => {
      const snap = this.db.prepare(`SELECT * FROM snapshots WHERE project_id = ? ORDER BY id DESC LIMIT 1`).get(projectId) as Row | undefined;
      if (!snap) throw new ValidationError("Pole midagi tagasi võtta.");
      const data = JSON.parse(snap.data) as { project: Row; stories: Row[]; criteria: Row[]; mockups: Row[] };
      this.db.prepare(`DELETE FROM stories WHERE project_id = ?`).run(projectId);
      for (const [table, rows] of [
        ["stories", data.stories],
        ["criteria", data.criteria],
        ["mockups", data.mockups],
      ] as const) {
        for (const row of rows) {
          const cols = Object.keys(row);
          this.db
            .prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
            .run(...cols.map((c) => row[c]));
        }
      }
      this.db
        .prepare(`UPDATE projects SET mvp_line = ?, focus_story_id = ?, story_counter = ?, updated_at = ? WHERE id = ?`)
        .run(data.project.mvp_line, data.project.focus_story_id, data.project.story_counter, now(), projectId);
      this.db.prepare(`DELETE FROM snapshots WHERE id = ?`).run(snap.id);
      return snap.label as string;
    });
  }
}

function mapMockup(r: Row): MockupVersion {
  return {
    id: r.id,
    storyId: r.story_id,
    version: Number(r.version),
    spec: JSON.parse(r.spec),
    note: r.note,
    isCurrent: Boolean(r.is_current),
    createdAt: r.created_at,
  };
}

function mapProposal(r: Row): Proposal {
  return {
    id: r.id,
    projectId: r.project_id,
    storyId: r.story_id,
    payload: JSON.parse(r.payload),
    status: r.status,
    createdAt: r.created_at,
  };
}
