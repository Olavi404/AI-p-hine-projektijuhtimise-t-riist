// Etapipõhised järgmise sammu valikud. Kasutaja ei tohi jääda olukorda, kus ta ei tea, mida edasi teha.
import type { NextStep, Project, Stage, Story } from "./types.ts";
import { STAGE_LABELS } from "./types.ts";

export function stageSteps(project: Project, stories: Story[], stage: Stage = project.stage): NextStep[] {
  const focus = stories.find((s) => s.id === project.focusStoryId) ?? null;
  const hasStories = stories.length > 0;
  const steps: NextStep[] = [];
  switch (stage) {
    case "idea":
      if (project.context.idea) steps.push({ label: "Paku rollid", action: { type: "propose_roles" }, primary: true });
      break;
    case "roles":
      steps.push({ label: "Paku rollid", action: { type: "propose_roles" }, primary: true });
      if (project.context.roles.length > 0) steps.push({ label: "Paku lugusid", action: { type: "propose_stories" } });
      break;
    case "stories":
      steps.push({ label: hasStories ? "Paku veel lugusid" : "Paku lugusid", action: { type: "propose_stories" }, primary: !hasStories });
      if (hasStories) steps.push({ label: "Soovita, millest alustada", action: { type: "recommend_priority" }, primary: true });
      break;
    case "priorities":
      if (hasStories) {
        steps.push({ label: "Soovita, millest alustada", action: { type: "recommend_priority" }, primary: true });
        steps.push({ label: "Valin ise loo", action: { type: "pick_focus" } });
      }
      break;
    case "criteria":
      if (focus) steps.push({ label: `Paku kriteeriumid ja mockup loole ${focus.code}`, action: { type: "propose_criteria", storyId: focus.id }, primary: true });
      if (hasStories) steps.push({ label: focus ? "Vali teine lugu" : "Vali lugu", action: { type: "pick_focus" }, primary: !focus });
      break;
    case "refinements":
      if (hasStories) steps.push({ label: "Järgmine lugu", action: { type: "next_story" }, primary: true });
      if (hasStories) steps.push({ label: "Vaatame backlog'i üle", action: { type: "review" } });
      steps.push({ label: "Lõpetame kohtumise", action: { type: "end_meeting" } });
      break;
    case "grooming":
      if (hasStories) steps.push({ label: "Vaata backlog üle", action: { type: "review" }, primary: true });
      if (hasStories) steps.push({ label: "Järgmine lugu", action: { type: "next_story" } });
      steps.push({ label: "Lõpetame kohtumise", action: { type: "end_meeting" } });
      break;
  }
  if (!hasStories && stage !== "idea" && stage !== "roles" && stage !== "stories") {
    steps.unshift({ label: "Paku lugusid", action: { type: "propose_stories" }, primary: true });
  }
  return steps.slice(0, 4);
}

/** Tekst, millega AI tervitab projekti uuesti avamisel ja pakub jätkamiseks sobivat sammu. */
export function resumeText(project: Project, stories: Story[]): string {
  const focus = stories.find((s) => s.id === project.focusStoryId);
  const base = `Jätkame projektiga „${project.name}“. Pooleli jäi etapp „${STAGE_LABELS[project.stage]}“.`;
  switch (project.stage) {
    case "idea":
      if (!project.context.idea) return `${base} Kirjelda alustuseks ühe-kahe lausega, mida klient soovib.`;
      if (project.context.questionIndex < project.context.questions.length) return `${base} Vasta ootel täpsustavale küsimusele või jäta see vahele.`;
      return `${base} Soovitan järgmisena paika panna kasutajarollid.`;
    case "roles":
      return `${base} Soovitan rollid üle vaadata ja kinnitada.`;
    case "stories":
      return `${base} Backlog'is on ${stories.length} lugu. ${stories.length ? "Soovitan valida, millest alustada." : "Soovitan lasta pakkuda esimesed lood."}`;
    case "priorities":
      return `${base} Soovitan otsustada, milline lugu on kliendile kõige olulisem.`;
    case "criteria":
      return focus ? `${base} Valitud lugu on ${focus.code}. Soovitan sellele kriteeriumid ja mockup'i pakkuda.` : `${base} Vali lugu, millega jätkata.`;
    case "refinements":
      return focus
        ? `${base} Valitud lugu on ${focus.code}. Kirjuta kliendi täpsustus või liigu järgmise loo juurde.`
        : `${base} Liigu järgmise loo juurde või vaata backlog üle.`;
    case "grooming":
      return `${base} Soovitan käivitada backlog'i ülevaatuse.`;
  }
}
