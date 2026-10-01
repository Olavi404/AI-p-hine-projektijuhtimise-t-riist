// Backlog'i eksport Markdowni ja CSV-sse.
import { storyTitle } from "../shared/quality.ts";
import type { Project, Story } from "../shared/types.ts";
import { STATUS_LABELS } from "../shared/types.ts";

export function toMarkdown(project: Project, stories: Story[]): string {
  const lines = [`# ${project.name} – backlog`, ""];
  if (project.description) lines.push(project.description, "");
  stories.forEach((s, i) => {
    if (project.mvpLine === i) lines.push("---", "**MVP joon** – allpool olevad lood ei kuulu esimesse versiooni.", "---", "");
    lines.push(`## ${s.code}. ${storyTitle(s)}`, "");
    lines.push(`- Staatus: ${STATUS_LABELS[s.status]}`, `- Suurus: ${s.size ?? "-"}`, `- Päritolu: ${s.origin === "ai" ? "AI ettepanek" : "käsitsi lisatud"}`);
    if (s.mockup) lines.push(`- Mockup: v${s.mockup.version} (${s.mockup.spec.title})`);
    lines.push("", "**Vastuvõtukriteeriumid**", "");
    if (s.criteria.length === 0) lines.push("_puuduvad_");
    for (const c of s.criteria) lines.push(`- [ ] ${c.text}`);
    if (s.openQuestions.length) {
      lines.push("", "**Avatud küsimused**", "");
      for (const q of s.openQuestions) lines.push(`- ${q.text}`);
    }
    lines.push("");
  });
  if (project.mvpLine !== null && project.mvpLine >= stories.length) lines.push("---", "**MVP joon** – kõik lood kuuluvad MVP-sse.");
  return lines.join("\n");
}

export function toCsv(stories: Story[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Tunnus", "Järjekord", "Roll", "Tegevus", "Kasu", "Pealkiri", "Staatus", "Suurus", "Kriteeriumid", "Avatud küsimused", "Päritolu"];
  const rows = stories.map((s, i) =>
    [s.code, String(i + 1), s.role, s.action, s.benefit, storyTitle(s), STATUS_LABELS[s.status], s.size ?? "", s.criteria.map((c) => c.text).join("\n"), s.openQuestions.map((q) => q.text).join("\n"), s.origin]
      .map(esc)
      .join(","),
  );
  return "﻿" + [header.map(esc).join(","), ...rows].join("\r\n");
}
