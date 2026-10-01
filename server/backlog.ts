// Backlog'i toimingud, mida kasutavad nii käsitsi haldus kui ka kinnitatud AI ettepanekud.
// Kõik muudatused käivad läbi repo.mutate (transaktsioon + tagasivõtmise hetkeseis).
import { Repo, ValidationError, type StoryPatch } from "./repo.ts";
import { definitionOfReady, mergeCriteriaTexts } from "../shared/quality.ts";
import type { CriterionDraft, Story, StoryDraft } from "../shared/types.ts";

/** Uuendab lugu; staatust "Valmis arenduseks" lubatakse ainult siis, kui valmisoleku definitsioon on täidetud. */
export function updateStory(repo: Repo, projectId: string, storyId: string, patch: StoryPatch & { criteria?: CriterionDraft[] }, label = "Loo muutmine"): Story {
  const story = repo.getProjectStory(projectId, storyId);
  return repo.mutate(projectId, `${label} (${story.code})`, () => {
    const { criteria, ...rest } = patch;
    if (criteria) repo.setCriteria(storyId, criteria);
    let updated = repo.updateStory(storyId, rest);
    if (updated.status === "ready") {
      const dor = definitionOfReady(updated);
      if (!dor.ready) {
        const missing = dor.items.filter((i) => !i.ok).map((i) => i.label);
        if (patch.status === "ready") {
          throw new ValidationError(`Lugu ${updated.code} ei vasta valmisoleku definitsioonile: ${missing.join("; ")}.`);
        }
        // Muudatus rikkus valmisoleku: lugu liigub tagasi läbivaadatuks.
        updated = repo.updateStory(storyId, { status: "reviewed" });
      }
    }
    return updated;
  });
}

/** Jagab liiga suure loo mitmeks väiksemaks; uued lood tulevad algse loo kohale. */
export function splitStory(repo: Repo, projectId: string, storyId: string, parts: StoryDraft[], origin: "ai" | "manual"): Story[] {
  if (parts.length < 2) throw new ValidationError("Jagamiseks on vaja vähemalt kahte uut lugu.");
  const original = repo.getProjectStory(projectId, storyId);
  const index = repo.listStories(projectId).findIndex((s) => s.id === storyId);
  return repo.mutate(projectId, `Loo ${original.code} jagamine`, () => {
    const created = parts.map((p, i) => {
      const s = repo.createStory(
        projectId,
        { role: p.role, action: p.action, benefit: p.benefit, size: p.size, isView: p.isView, origin, openQuestions: original.openQuestions },
        index + i,
      );
      repo.setCriteria(s.id, keepElementLinks(original, p.criteria));
      if (original.mockup && p.isView) repo.addMockupVersion(s.id, original.mockup.spec, `Kopeeritud loost ${original.code}`);
      return s.id;
    });
    if (repo.getProject(projectId).focusStoryId === storyId) repo.updateProject(projectId, { focusStoryId: created[0] });
    repo.deleteStory(storyId);
    return created.map((id) => repo.getStory(id));
  });
}

/** Ühendab kattuvad lood üheks; kriteeriumid ühendatakse ilma korduseta. */
export function mergeStories(repo: Repo, projectId: string, storyIds: string[], merged: StoryDraft, origin: "ai" | "manual"): Story {
  const unique = [...new Set(storyIds)];
  if (unique.length < 2) throw new ValidationError("Ühendamiseks vali vähemalt kaks lugu.");
  const originals = unique.map((id) => repo.getProjectStory(projectId, id));
  const all = repo.listStories(projectId);
  const index = Math.min(...originals.map((o) => all.findIndex((s) => s.id === o.id)));
  return repo.mutate(projectId, `Lugude ${originals.map((o) => o.code).join(" + ")} ühendamine`, () => {
    const s = repo.createStory(
      projectId,
      {
        role: merged.role,
        action: merged.action,
        benefit: merged.benefit,
        size: merged.size,
        isView: merged.isView,
        origin,
        openQuestions: originals.flatMap((o) => o.openQuestions),
      },
      index,
    );
    const withMockup = originals.find((o) => o.mockup);
    repo.setCriteria(s.id, keepElementLinks(withMockup ?? originals[0], mergeCriteriaTexts([merged.criteria])));
    if (withMockup?.mockup) repo.addMockupVersion(s.id, withMockup.mockup.spec, `Kopeeritud loost ${withMockup.code}`);
    const focus = repo.getProject(projectId).focusStoryId;
    for (const o of originals) repo.deleteStory(o.id);
    if (focus && unique.includes(focus)) repo.updateProject(projectId, { focusStoryId: s.id });
    return repo.getStory(s.id);
  });
}

/** Säilitab kriteeriumi seose mockup'i elemendiga, kui sama sõnastusega kriteerium oli olemas. */
export function keepElementLinks(source: Story, texts: string[]): CriterionDraft[] {
  const ids = new Set(source.mockup?.spec.sections.flatMap((s) => s.elements.map((e) => e.id)) ?? []);
  return texts.map((text) => {
    const match = source.criteria.find((c) => c.text.trim().toLowerCase() === text.trim().toLowerCase());
    return { text, elementIds: (match?.elementIds ?? []).filter((id) => ids.has(id)) };
  });
}
