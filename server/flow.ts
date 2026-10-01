// Juhitud vestluse voog: iga kasutaja tegevus (nupuvajutus või vabatekst) viib protsessi edasi.
// AI ettepanekud salvestatakse ootel ettepanekutena; backlog muutub alles kasutaja kinnituse järel.
import { Repo, ValidationError } from "./repo.ts";
import { AiService } from "./ai/service.ts";
import { AiError } from "./ai/provider.ts";
import type { PromptContext } from "./ai/prompts.ts";
import type { CriteriaMockupOut, MockupOut } from "./ai/schemas.ts";
import { keepElementLinks, mergeStories, splitStory } from "./backlog.ts";
import { stageSteps } from "../shared/steps.ts";
import { definitionOfReady, storyTitle } from "../shared/quality.ts";
import type {
  ChangeAfter,
  ChatAction,
  ChatCard,
  CriterionDraft,
  Finding,
  NextStep,
  Proposal,
  Stage,
  Story,
  StoryDraft,
} from "../shared/types.ts";
import { STAGE_LABELS } from "../shared/types.ts";

export class Flow {
  /** Projekti kaupa: AI samm, mida "Proovi uuesti" peab kordama (mitte kasutaja algne tegevus, mis võis juba salvestuda). */
  private retries = new Map<string, ChatAction>();

  constructor(
    private repo: Repo,
    private ai: AiService,
  ) {}

  /** Käsitleb ühe tegevuse. AI vea korral lisatakse arusaadav veateade koos "Proovi uuesti" valikuga. */
  async handle(projectId: string, action: ChatAction): Promise<void> {
    this.retries.delete(projectId);
    try {
      await this.dispatch(projectId, action);
    } catch (err) {
      if (err instanceof AiError) {
        const again = this.retries.get(projectId) ?? action;
        const retry: NextStep[] = err.retryable ? [{ label: "Proovi uuesti", action: again, primary: true }] : [];
        this.say(projectId, err.message, { isError: true, nextSteps: [...retry, ...this.steps(projectId)].slice(0, 4) });
        return;
      }
      throw err;
    }
  }

  private async dispatch(projectId: string, a: ChatAction): Promise<void> {
    switch (a.type) {
      case "text":
        return this.onText(projectId, a.text);
      case "answer":
        return this.onAnswer(projectId, a.questionId, a.values.join(", "));
      case "skip_question":
        return this.onAnswer(projectId, a.questionId, null);
      case "propose_roles":
        this.user(projectId, "Paku rollid");
        return this.proposeRoles(projectId);
      case "confirm_roles":
        return this.confirmRoles(projectId, a.proposalId, a.roles);
      case "propose_stories":
        this.user(projectId, a.feedback ? `Paku teistsuguseid lugusid: ${a.feedback}` : "Paku lugusid");
        return this.proposeStories(projectId, a.feedback);
      case "add_stories":
        return this.addStories(projectId, a.proposalId, a.indices);
      case "recommend_priority":
        this.user(projectId, "Millest alustada?");
        return this.recommendPriority(projectId);
      case "pick_focus":
        this.user(projectId, "Valin ise loo");
        this.setStage(projectId, "priorities");
        this.say(projectId, "Vali backlog'ist lugu, millega alustame.", { card: { kind: "pick_story", purpose: "focus" } });
        return;
      case "choose_focus":
        return this.chooseFocus(projectId, a.storyId, a.moveToTop ?? false);
      case "propose_criteria": {
        const story = this.repo.getProjectStory(projectId, a.storyId);
        this.user(projectId, `Paku kriteeriumid ja mockup loole ${story.code}`);
        return this.proposeCriteria(projectId, story.id);
      }
      case "apply_criteria":
        return this.applyCriteria(projectId, a.proposalId, a.criteria, a.includeMockup);
      case "refine": {
        const story = this.repo.getProjectStory(projectId, a.storyId);
        this.user(projectId, `Täpsustus loole ${story.code}: ${a.text}`);
        return this.refine(projectId, story.id, a.text);
      }
      case "apply_change":
        return this.applyChange(projectId, a.proposalId, a.edited);
      case "reject_proposal":
        return this.rejectProposal(projectId, a.proposalId);
      case "next_story":
        this.user(projectId, "Järgmine lugu");
        return this.nextStory(projectId);
      case "review":
        this.user(projectId, "Vaata backlog üle");
        return this.review(projectId);
      case "apply_finding":
        return this.applyFinding(projectId, a.proposalId, a.index, a.edited);
      case "ignore_finding":
        return this.ignoreFinding(projectId, a.proposalId, a.index);
      case "new_view":
        this.user(projectId, `Uus vaade: ${a.text}`);
        return this.newView(projectId, a.text);
      case "apply_new_view":
        return this.applyNewView(projectId, a.proposalId);
      case "goto_stage":
        return this.gotoStage(projectId, a.stage);
      case "end_meeting":
        this.user(projectId, "Lõpetame kohtumise");
        return this.endMeeting(projectId);
      case "resume":
        return;
    }
  }

  // ---------- Abifunktsioonid ----------

  private ctx(projectId: string): PromptContext {
    return {
      project: this.repo.getProject(projectId),
      stories: this.repo.listStories(projectId),
      messages: this.repo.listMessages(projectId),
    };
  }

  private steps(projectId: string, stage?: Stage): NextStep[] {
    const project = this.repo.getProject(projectId);
    return stageSteps(project, this.repo.listStories(projectId), stage);
  }

  private user(projectId: string, text: string): void {
    this.repo.addMessage(projectId, { role: "user", text });
  }

  private say(projectId: string, text: string, opts: { card?: ChatCard; nextSteps?: NextStep[]; isError?: boolean } = {}): void {
    this.repo.addMessage(projectId, {
      role: "assistant",
      text,
      card: opts.card ?? null,
      nextSteps: opts.nextSteps ?? (opts.card ? [] : this.steps(projectId)),
      isError: opts.isError,
    });
  }

  private setStage(projectId: string, stage: Stage): void {
    this.repo.updateProject(projectId, { stage });
  }

  private storyByCode(projectId: string, code: string): Story | undefined {
    return this.repo.listStories(projectId).find((s) => s.code.toLowerCase() === code.trim().toLowerCase());
  }

  private pendingProposal(projectId: string, proposalId: string, kind: Proposal["payload"]["kind"]): Proposal {
    const p = this.repo.getProposal(projectId, proposalId);
    if (p.payload.kind !== kind) throw new ValidationError("Vale ettepaneku tüüp.");
    if (p.status !== "pending") throw new ValidationError("See ettepanek on juba käsitletud.");
    return p;
  }

  /** Mida rakendus hetkel ootab (AI-le vabateksti tõlgendamiseks). */
  private pendingDescription(projectId: string): string {
    const project = this.repo.getProject(projectId);
    const c = project.context;
    if (c.questionIndex < c.questions.length) return `vastust täpsustavale küsimusele: "${c.questions[c.questionIndex].text}"`;
    const pending = this.repo.listProposals(projectId).filter((p) => p.status === "pending");
    const focus = project.focusStoryId ? this.repo.getStory(project.focusStoryId) : null;
    const parts = [`etapp ${STAGE_LABELS[project.stage]}`];
    if (focus) parts.push(`valitud lugu ${focus.code} ("${storyTitle(focus)}") – vabatekst on tõenäoliselt kliendi täpsustus selle loo kohta`);
    if (pending.length) parts.push(`ootel ettepanekud: ${pending.map((p) => p.payload.kind).join(", ")}`);
    return parts.join("; ");
  }

  // ---------- Idee ja täpsustused ----------

  private async onText(projectId: string, text: string): Promise<void> {
    const project = this.repo.getProject(projectId);
    const c = project.context;
    if (!c.idea) {
      this.user(projectId, text);
      this.repo.updateProject(projectId, { context: { ...c, idea: text }, stage: "idea" });
      let out;
      try {
        out = await this.ai.clarify(this.ctx(projectId));
      } catch (err) {
        // Idee jääb salvestamata, et "Proovi uuesti" alustaks uuesti täpsustavatest küsimustest.
        this.repo.updateProject(projectId, { context: { ...this.repo.getProject(projectId).context, idea: "" } });
        throw err;
      }
      const questions = out.questions.map((q, i) => ({ id: `q${i + 1}`, text: q.text, multi: q.multi, options: q.options }));
      const fresh = this.repo.getProject(projectId);
      this.repo.updateProject(projectId, { context: { ...fresh.context, questions, questionIndex: 0 } });
      this.askQuestion(projectId, out.message);
      return;
    }
    if (c.questionIndex < c.questions.length) {
      // Vabatekst ootel küsimuse ajal = "Muu (kirjutan ise)" vastus.
      return this.onAnswer(projectId, c.questions[c.questionIndex].id, text);
    }

    this.user(projectId, text);
    const out = await this.ai.interpret(this.ctx(projectId), text, this.pendingDescription(projectId));
    const focus = this.repo.getProject(projectId).focusStoryId;
    const story = out.story_code ? this.storyByCode(projectId, out.story_code) : undefined;
    switch (out.intent) {
      case "set_roles": {
        const roles = out.roles.length ? out.roles.map((name) => ({ name, description: "" })) : [];
        if (roles.length === 0) break;
        this.setStage(projectId, "roles");
        const p = this.repo.createProposal(projectId, null, { kind: "roles", roles });
        this.say(projectId, out.message || "Kas kinnitame need rollid?", { card: { kind: "proposal", proposalId: p.id } });
        return;
      }
      case "stories_feedback":
        return this.proposeStories(projectId, out.text || text);
      case "choose_story":
        if (story) return this.chooseFocus(projectId, story.id, false, false);
        break;
      case "refine_story": {
        const target = story?.id ?? focus;
        if (target) return this.refine(projectId, target, out.text || text);
        break;
      }
      case "new_view":
        return this.newView(projectId, out.text || text);
      case "review":
        return this.review(projectId);
      case "next_story":
        return this.nextStory(projectId);
      case "end_meeting":
        return this.endMeeting(projectId);
      case "answer":
      case "other":
        break;
    }
    this.say(projectId, out.message);
  }

  private askQuestion(projectId: string, intro?: string): void {
    const c = this.repo.getProject(projectId).context;
    const q = c.questions[c.questionIndex];
    const text = intro ? `${intro}\n\n${q.text}` : q.text;
    this.say(projectId, text, { card: { kind: "question", question: q, index: c.questionIndex, total: c.questions.length } });
  }

  private async onAnswer(projectId: string, questionId: string, answer: string | null): Promise<void> {
    const project = this.repo.getProject(projectId);
    const c = project.context;
    const q = c.questions[c.questionIndex];
    if (!q || q.id !== questionId) throw new ValidationError("See küsimus on juba vastatud.");
    this.user(projectId, answer ?? "Jäta vahele");
    const answers = answer ? [...c.answers, { questionId: q.id, question: q.text, answer }] : c.answers;
    this.repo.updateProject(projectId, { context: { ...c, answers, questionIndex: c.questionIndex + 1 } });
    if (c.questionIndex + 1 < c.questions.length) {
      this.askQuestion(projectId);
      return;
    }
    return this.proposeRoles(projectId);
  }

  // ---------- Rollid ja lood ----------

  private async proposeRoles(projectId: string): Promise<void> {
    this.retries.set(projectId, { type: "propose_roles" });
    this.setStage(projectId, "roles");
    const out = await this.ai.roles(this.ctx(projectId));
    const p = this.repo.createProposal(projectId, null, { kind: "roles", roles: out.roles });
    this.say(projectId, out.message, { card: { kind: "proposal", proposalId: p.id } });
  }

  private async confirmRoles(projectId: string, proposalId: string, roles: { name: string; description: string }[]): Promise<void> {
    this.pendingProposal(projectId, proposalId, "roles");
    this.repo.updateProposal(projectId, proposalId, { status: "applied", payload: { kind: "roles", roles } });
    const project = this.repo.getProject(projectId);
    this.repo.updateProject(projectId, { context: { ...project.context, roles } });
    this.user(projectId, `Kinnitan rollid: ${roles.map((r) => r.name).join(", ")}`);
    return this.proposeStories(projectId);
  }

  private async proposeStories(projectId: string, feedback?: string): Promise<void> {
    this.retries.set(projectId, { type: "propose_stories", feedback });
    this.setStage(projectId, "stories");
    const out = await this.ai.stories(this.ctx(projectId), feedback);
    const p = this.repo.createProposal(projectId, null, {
      kind: "stories",
      stories: out.stories.map((s) => ({ role: s.role, action: s.action, benefit: s.benefit, size: s.size, isView: s.is_view, note: s.note })),
    });
    this.say(projectId, out.message, { card: { kind: "proposal", proposalId: p.id } });
  }

  private async addStories(projectId: string, proposalId: string, indices: number[]): Promise<void> {
    const p = this.pendingProposal(projectId, proposalId, "stories");
    if (p.payload.kind !== "stories") return;
    const proposed = p.payload.stories;
    const chosen = [...new Set(indices)].filter((i) => i < proposed.length).sort((a, b) => a - b);
    if (chosen.length === 0) throw new ValidationError("Vali vähemalt üks lugu.");
    this.repo.mutate(projectId, `${chosen.length} loo lisamine backlog'i`, () => {
      for (const i of chosen) {
        const s = proposed[i];
        this.repo.createStory(projectId, { role: s.role, action: s.action, benefit: s.benefit, size: s.size, isView: s.isView, origin: "ai" });
      }
    });
    this.repo.updateProposal(projectId, proposalId, { status: "applied" });
    this.user(projectId, chosen.length === proposed.length ? `Lisa kõik backlog'i (${chosen.length})` : `Lisa valitud backlog'i (${chosen.length}/${proposed.length})`);
    return this.recommendPriority(projectId);
  }

  private async recommendPriority(projectId: string): Promise<void> {
    this.retries.set(projectId, { type: "recommend_priority" });
    if (this.repo.listStories(projectId).length === 0) {
      this.say(projectId, "Backlog on veel tühi. Lisame esmalt lood.");
      return;
    }
    this.setStage(projectId, "priorities");
    const out = await this.ai.priority(this.ctx(projectId));
    const story = this.storyByCode(projectId, out.story_code)!;
    this.say(projectId, `${out.message}\n\nSoovitan alustada loost ${story.code}: „${storyTitle(story)}“`, {
      card: { kind: "priority", storyId: story.id, reason: out.reason },
      nextSteps: [
        { label: "Nõus, alustame sellest", action: { type: "choose_focus", storyId: story.id, moveToTop: true }, primary: true },
        { label: "Valin ise teise", action: { type: "pick_focus" } },
      ],
    });
  }

  private async chooseFocus(projectId: string, storyId: string, moveToTop: boolean, recordUser = true): Promise<void> {
    const story = this.repo.getProjectStory(projectId, storyId);
    if (recordUser) this.user(projectId, moveToTop ? `Nõus, alustame loost ${story.code}` : `Alustame loost ${story.code}`);
    const ids = this.repo.listStories(projectId).map((s) => s.id);
    if (moveToTop && ids[0] !== storyId) {
      this.repo.mutate(projectId, `Loo ${story.code} tõstmine backlog'i algusesse`, () => {
        this.repo.reorder(projectId, [storyId, ...ids.filter((id) => id !== storyId)]);
      });
    }
    return this.proposeCriteria(projectId, storyId);
  }

  // ---------- Kriteeriumid ja mockup ----------

  private async proposeCriteria(projectId: string, storyId: string): Promise<void> {
    this.retries.set(projectId, { type: "propose_criteria", storyId });
    this.repo.updateProject(projectId, { focusStoryId: storyId, stage: "criteria" });
    const story = this.repo.getStory(storyId);
    const out: CriteriaMockupOut = await this.ai.criteriaMockup(this.ctx(projectId), story);
    const p = this.repo.createProposal(projectId, storyId, {
      kind: "criteria_mockup",
      storyId,
      criteria: out.criteria.map((c) => ({ text: c.text, elementIds: c.element_ids })),
      mockup: out.mockup,
    });
    this.say(projectId, out.message, { card: { kind: "proposal", proposalId: p.id } });
  }

  private async applyCriteria(projectId: string, proposalId: string, criteria: CriterionDraft[], includeMockup: boolean): Promise<void> {
    const p = this.pendingProposal(projectId, proposalId, "criteria_mockup");
    if (p.payload.kind !== "criteria_mockup") return;
    const story = this.repo.getProjectStory(projectId, p.payload.storyId);
    const mockup = includeMockup ? p.payload.mockup : (story.mockup?.spec ?? null);
    const known = new Set(mockup?.sections.flatMap((s) => s.elements.map((e) => e.id)) ?? []);
    const cleaned = criteria
      .filter((c) => c.text.trim())
      .map((c) => ({ text: c.text.trim(), elementIds: c.elementIds.filter((id) => known.has(id)) }));
    this.repo.mutate(projectId, `Kriteeriumid${includeMockup ? " ja mockup" : ""} loole ${story.code}`, () => {
      this.repo.setCriteria(story.id, cleaned);
      if (includeMockup && p.payload.kind === "criteria_mockup" && p.payload.mockup) {
        this.repo.addMockupVersion(story.id, p.payload.mockup, "AI ettepanek");
      }
    });
    this.repo.updateProposal(projectId, proposalId, { status: "applied", payload: { ...p.payload, criteria: cleaned } });
    this.user(projectId, `Kinnitan ${cleaned.length} kriteeriumi${includeMockup ? " ja mockup'i" : ""}`);
    this.setStage(projectId, "refinements");
    this.say(
      projectId,
      `Lool ${story.code} on nüüd ${cleaned.length} kriteeriumi${includeMockup ? " ja mockup" : ""}. Kui klient soovib midagi täpsustada, kirjuta täpsustus siia (nt „Paketi hinnas peab olema näha, kas see sisaldab käibemaksu“). Mida teeme edasi?`,
    );
  }

  // ---------- Kliendi täpsustus ----------

  private async refine(projectId: string, storyId: string, request: string): Promise<void> {
    this.retries.set(projectId, { type: "refine", storyId, text: request });
    const story = this.repo.getProjectStory(projectId, storyId);
    this.repo.updateProject(projectId, { focusStoryId: storyId, stage: "refinements" });
    const out = await this.ai.refine(this.ctx(projectId), story, request);
    const before: ChangeAfter = {
      role: story.role,
      action: story.action,
      benefit: story.benefit,
      criteria: story.criteria.map((c) => ({ text: c.text, elementIds: c.elementIds })),
      mockup: story.mockup?.spec ?? null,
    };
    const after: ChangeAfter = {
      role: out.role,
      action: out.action,
      benefit: out.benefit,
      criteria: out.criteria.map((c) => ({ text: c.text, elementIds: c.element_ids })),
      mockup: out.mockup_changed || !story.mockup ? (out.mockup as MockupOut) : story.mockup.spec,
    };
    const otherStories = out.other_stories
      .map((o) => ({ story: this.storyByCode(projectId, o.story_code), reason: o.reason }))
      .filter((o) => o.story && o.story.id !== storyId)
      .map((o) => ({ storyId: o.story!.id, reason: o.reason }));
    const unchanged =
      before.role === after.role &&
      before.action === after.action &&
      before.benefit === after.benefit &&
      JSON.stringify(before.criteria.map((c) => c.text)) === JSON.stringify(after.criteria.map((c) => c.text)) &&
      JSON.stringify(before.mockup) === JSON.stringify(after.mockup);
    if (unchanged) {
      // Täpsustus on loos juba kaetud: tühja muudatusettepanekut ei näidata.
      this.say(projectId, `Loos ${story.code} pole vaja midagi muuta: ${out.summary}`, { nextSteps: otherStories.length ? [] : this.steps(projectId) });
      for (const o of otherStories) {
        const other = this.repo.getStory(o.storyId);
        this.say(projectId, `Ettepanek loole ${other.code}: ${o.reason}`, {
          card: { kind: "suggestion", storyId: o.storyId, reason: o.reason },
          nextSteps: [{ label: `Koosta muudatusettepanek loole ${other.code}`, action: { type: "refine", storyId: o.storyId, text: `${request} (${o.reason})` } }],
        });
      }
      if (otherStories.length) this.say(projectId, "Mida teeme edasi?");
      return;
    }
    const p = this.repo.createProposal(projectId, storyId, { kind: "change", storyId, request, summary: out.summary, before, after, otherStories });
    this.say(projectId, `Muudatusettepanek loole ${story.code}: ${out.summary}`, { card: { kind: "proposal", proposalId: p.id } });
  }

  /** Rakendab muudatusettepaneku. Muudetakse AINULT ettepanekuga seotud lugu (storyId tuleb salvestatud ettepanekust, mitte päringust). */
  private async applyChange(projectId: string, proposalId: string, edited?: ChangeAfter): Promise<void> {
    const p = this.pendingProposal(projectId, proposalId, "change");
    if (p.payload.kind !== "change") return;
    const payload = p.payload;
    const story = this.repo.getProjectStory(projectId, payload.storyId);
    const after = edited ?? payload.after;
    const mockupChanged = after.mockup !== null && JSON.stringify(after.mockup) !== JSON.stringify(story.mockup?.spec ?? null);
    const known = new Set((after.mockup ?? story.mockup?.spec)?.sections.flatMap((s) => s.elements.map((e) => e.id)) ?? []);
    this.repo.mutate(projectId, `Täpsustuse rakendamine loole ${story.code}`, () => {
      this.repo.updateStory(story.id, { role: after.role, action: after.action, benefit: after.benefit });
      this.repo.setCriteria(
        story.id,
        after.criteria.map((c) => ({ text: c.text, elementIds: c.elementIds.filter((id) => known.has(id)) })),
      );
      if (mockupChanged && after.mockup) this.repo.addMockupVersion(story.id, after.mockup, `Täpsustus: ${payload.request.slice(0, 120)}`);
      const updated = this.repo.getStory(story.id);
      if (updated.status === "ready" && !definitionOfReady(updated).ready) this.repo.updateStory(story.id, { status: "reviewed" });
    });
    this.repo.updateProposal(projectId, proposalId, { status: "applied", payload: { ...payload, after } });
    this.user(projectId, edited ? "Rakenda (muudetud kujul)" : "Rakenda");
    const updated = this.repo.getStory(story.id);
    this.say(
      projectId,
      `Muudatus on rakendatud loole ${story.code}${mockupChanged ? ` (mockup v${updated.mockup?.version})` : ""}. Teisi lugusid ei muudetud.${payload.otherStories.length ? " Täpsustus võib mõjutada ka teisi lugusid – pakun nende muutmist eraldi:" : ""}`,
      { nextSteps: payload.otherStories.length ? [] : this.steps(projectId) },
    );
    for (const o of payload.otherStories) {
      this.say(projectId, `Ettepanek: ${o.reason}`, {
        card: { kind: "suggestion", storyId: o.storyId, reason: o.reason },
        nextSteps: [{ label: "Koosta muudatusettepanek", action: { type: "refine", storyId: o.storyId, text: `${payload.request} (${o.reason})` } }],
      });
    }
    if (payload.otherStories.length) this.say(projectId, "Mida teeme edasi?");
  }

  private async rejectProposal(projectId: string, proposalId: string): Promise<void> {
    const p = this.repo.getProposal(projectId, proposalId);
    if (p.status !== "pending") throw new ValidationError("See ettepanek on juba käsitletud.");
    this.repo.updateProposal(projectId, proposalId, { status: "rejected" });
    this.user(projectId, "Loobu");
    const next: NextStep[] = [];
    if (p.payload.kind === "stories") next.push({ label: "Paku teistsuguseid", action: { type: "propose_stories", feedback: "Eelmised ettepanekud ei sobinud." }, primary: true });
    if (p.payload.kind === "criteria_mockup") next.push({ label: "Paku uuesti", action: { type: "propose_criteria", storyId: p.payload.storyId }, primary: true });
    if (p.payload.kind === "roles") next.push({ label: "Paku rollid uuesti", action: { type: "propose_roles" }, primary: true });
    this.say(projectId, "Selge, jätsin ettepaneku kõrvale. Backlog'i ei muudetud.", { nextSteps: [...next, ...this.steps(projectId)].slice(0, 4) });
  }

  private async nextStory(projectId: string): Promise<void> {
    const project = this.repo.getProject(projectId);
    const stories = this.repo.listStories(projectId);
    const start = Math.max(0, stories.findIndex((s) => s.id === project.focusStoryId) + 1);
    const ordered = [...stories.slice(start), ...stories.slice(0, start)];
    const next = ordered.find((s) => s.id !== project.focusStoryId && (s.criteria.length < 3 || (s.isView && !s.mockup)));
    if (!next) {
      this.setStage(projectId, "grooming");
      this.say(projectId, "Kõigil lugudel on juba kriteeriumid ja vajalikud mockup'id. Soovitan backlog'i üle vaadata.");
      return;
    }
    return this.proposeCriteria(projectId, next.id);
  }

  // ---------- Groomimine ----------

  private async review(projectId: string): Promise<void> {
    this.retries.set(projectId, { type: "review" });
    this.setStage(projectId, "grooming");
    if (this.repo.listStories(projectId).length === 0) {
      this.say(projectId, "Backlog on tühi – pole midagi üle vaadata.");
      return;
    }
    const out = await this.ai.review(this.ctx(projectId));
    const findings: Finding[] = out.findings.map((f) => ({
      type: f.type,
      storyIds: f.story_codes.map((c) => this.storyByCode(projectId, c)!.id),
      problem: f.problem,
      reason: f.reason,
      fixKind: f.fix_kind,
      newStories: f.new_stories.map((s) => ({ role: s.role, action: s.action, benefit: s.benefit, size: s.size, isView: s.is_view, criteria: s.criteria })),
      status: "pending",
    }));
    // Uus ülevaatus asendab varasemad ootel ülevaatused (need põhinesid vanemal seisul).
    for (const old of this.repo.listProposals(projectId)) {
      if (old.status === "pending" && old.payload.kind === "review") this.repo.updateProposal(projectId, old.id, { status: "rejected" });
    }
    if (findings.length === 0) {
      this.say(projectId, out.message || "Backlog'ist probleeme ei leitud.");
      return;
    }
    const p = this.repo.createProposal(projectId, null, { kind: "review", summary: out.summary, findings });
    this.say(projectId, out.message, { card: { kind: "proposal", proposalId: p.id } });
  }

  private async applyFinding(projectId: string, proposalId: string, index: number, edited?: StoryDraft[]): Promise<void> {
    const p = this.pendingProposal(projectId, proposalId, "review");
    if (p.payload.kind !== "review") return;
    const finding = p.payload.findings[index];
    if (!finding || finding.status !== "pending") throw new ValidationError("See leid on juba käsitletud.");
    const stories = finding.storyIds.map((id) => this.repo.getProjectStory(projectId, id));
    const drafts = edited ?? finding.newStories;
    let result = "";
    let follow: (() => Promise<void>) | null = null;
    switch (finding.fixKind) {
      case "split": {
        const created = splitStory(this.repo, projectId, stories[0].id, drafts, "ai");
        result = `Lugu ${stories[0].code} jagati lugudeks ${created.map((s) => s.code).join(", ")}.`;
        break;
      }
      case "merge": {
        const merged = mergeStories(this.repo, projectId, stories.map((s) => s.id), drafts[0], "ai");
        result = `Lood ${stories.map((s) => s.code).join(", ")} ühendati looks ${merged.code}.`;
        break;
      }
      case "rewrite": {
        const d = drafts[0];
        const s = stories[0];
        this.repo.mutate(projectId, `Loo ${s.code} parandamine ülevaatuse põhjal`, () => {
          this.repo.updateStory(s.id, { role: d.role, action: d.action, benefit: d.benefit, size: d.size, isView: d.isView });
          this.repo.setCriteria(s.id, keepElementLinks(s, d.criteria));
          const updated = this.repo.getStory(s.id);
          if (updated.status === "ready" && !definitionOfReady(updated).ready) this.repo.updateStory(s.id, { status: "reviewed" });
        });
        result = `Lugu ${s.code} on parandatud.`;
        break;
      }
      case "generate_mockup":
        result = `Koostan loole ${stories[0].code} mockup'i ettepaneku.`;
        follow = () => this.proposeCriteria(projectId, stories[0].id);
        break;
      case "none":
        result = "Leid on märgitud käsitletuks.";
        break;
    }
    this.markFinding(projectId, proposalId, index, "applied");
    this.user(projectId, `Rakenda: ${finding.problem}`);
    if (follow) {
      this.say(projectId, result, { nextSteps: [] });
      return follow();
    }
    this.say(projectId, result, { nextSteps: this.remainingFindingSteps(projectId, proposalId) });
  }

  private async ignoreFinding(projectId: string, proposalId: string, index: number): Promise<void> {
    const p = this.pendingProposal(projectId, proposalId, "review");
    if (p.payload.kind !== "review" || !p.payload.findings[index] || p.payload.findings[index].status !== "pending") {
      throw new ValidationError("See leid on juba käsitletud.");
    }
    this.markFinding(projectId, proposalId, index, "ignored");
  }

  private markFinding(projectId: string, proposalId: string, index: number, status: Finding["status"]): void {
    const p = this.repo.getProposal(projectId, proposalId);
    if (p.payload.kind !== "review") return;
    const findings = p.payload.findings.map((f, i) => (i === index ? { ...f, status } : f));
    const done = findings.every((f) => f.status !== "pending");
    this.repo.updateProposal(projectId, proposalId, { status: done ? "applied" : "pending", payload: { ...p.payload, findings } });
  }

  private remainingFindingSteps(projectId: string, proposalId: string): NextStep[] {
    const p = this.repo.getProposal(projectId, proposalId);
    return p.status === "pending" ? [] : this.steps(projectId);
  }

  // ---------- Uus vaade promptist ----------

  private async newView(projectId: string, request: string): Promise<void> {
    this.retries.set(projectId, { type: "new_view", text: request });
    const out = await this.ai.newView(this.ctx(projectId), request);
    const p = this.repo.createProposal(projectId, null, {
      kind: "new_view",
      request,
      story: { role: out.role, action: out.action, benefit: out.benefit, size: out.size, isView: true },
      criteria: out.criteria.map((c) => ({ text: c.text, elementIds: c.element_ids })),
      mockup: out.mockup,
    });
    this.say(projectId, out.message, { card: { kind: "proposal", proposalId: p.id } });
  }

  private async applyNewView(projectId: string, proposalId: string): Promise<void> {
    const p = this.pendingProposal(projectId, proposalId, "new_view");
    if (p.payload.kind !== "new_view") return;
    const payload = p.payload;
    const story = this.repo.mutate(projectId, "Uue vaate loo lisamine", () => {
      const s = this.repo.createStory(projectId, { ...payload.story, origin: "ai" });
      this.repo.setCriteria(s.id, payload.criteria);
      this.repo.addMockupVersion(s.id, payload.mockup, "Loodud vaate kirjeldusest");
      return this.repo.getStory(s.id);
    });
    this.repo.updateProposal(projectId, proposalId, { status: "applied" });
    this.repo.updateProject(projectId, { focusStoryId: story.id, stage: "refinements" });
    this.user(projectId, "Lisa backlog'i");
    this.say(projectId, `Lisasin backlog'i loo ${story.code} koos ${story.criteria.length} kriteeriumi ja mockup'iga. Kliendi täpsustused saad kirjutada siia.`);
  }

  // ---------- Navigeerimine ----------

  private async gotoStage(projectId: string, stage: Stage): Promise<void> {
    this.setStage(projectId, stage);
    this.user(projectId, `Liigu etappi „${STAGE_LABELS[stage]}“`);
    const intro: Record<Stage, string> = {
      idea: "Idee etapp: kirjelda vabas vormis, mida klient soovib. Saad ideed alati täiendada.",
      roles: "Rollide etapp: vaatame üle, kes rakendust kasutavad.",
      stories: "Lugude etapp: pakun lugusid põhitöövoo järjekorras.",
      priorities: "Prioriteetide etapp: otsustame, millest alustada. Järjekorda saad muuta ka backlog'is lohistades.",
      criteria: "Kriteeriumide ja mockup'i etapp: valitud loole pakun vastuvõtukriteeriumid ja vaate kavandi.",
      refinements: "Täpsustuste etapp: kirjuta kliendi täpsustus ja ma koostan muudatusettepaneku koos eelvaatega.",
      grooming: "Groomimise etapp: vaatame backlog'i üle – liiga suured, kattuvad ja ebaselged lood.",
    };
    this.say(projectId, intro[stage]);
  }

  private async endMeeting(projectId: string): Promise<void> {
    const project = this.repo.getProject(projectId);
    const stories = this.repo.listStories(projectId);
    const ready = stories.filter((s) => s.status === "ready").length;
    const withCriteria = stories.filter((s) => s.criteria.length >= 3).length;
    const open = stories.reduce((n, s) => n + s.openQuestions.length, 0);
    const mvp = project.mvpLine === null ? "MVP joont pole veel määratud" : `MVP-s on ${Math.min(project.mvpLine, stories.length)} lugu`;
    this.say(
      projectId,
      `Kohtumise kokkuvõte: backlog'is on ${stories.length} lugu, neist ${withCriteria} on kriteeriumidega ja ${ready} valmis arenduseks. ${mvp}. Avatud küsimusi: ${open}. Kõik on salvestatud – järgmisel korral jätkame samast kohast.`,
      {
        nextSteps: [
          { label: "Vaatame backlog'i üle", action: { type: "review" }, primary: true },
          { label: "Järgmine lugu", action: { type: "next_story" } },
        ],
      },
    );
  }
}
