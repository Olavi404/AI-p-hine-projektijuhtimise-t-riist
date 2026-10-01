import { useState } from "react";
import { storyById, useProject } from "../../state.tsx";
import type { CriterionDraft, Proposal } from "../../../../shared/types.ts";
import { storyTitle } from "../../../../shared/quality.ts";
import { MockupView } from "../MockupView.tsx";
import { CriterionWarnings } from "../CriterionWarnings.tsx";
import { ProposalStatus } from "./StoryCards.tsx";

type Decision = "pending" | "accepted" | "rejected";
interface Row extends CriterionDraft {
  decision: Decision;
  edited: boolean;
}

/** Kriteeriumide ja mockup'i ettepanek: iga kriteeriumi juures ✓ Nõus, ✎ Muuda, ✗ Eemalda. */
export function CriteriaMockupCard({ proposal }: { proposal: Proposal }) {
  const { state, run, busy } = useProject();
  const payload = proposal.payload.kind === "criteria_mockup" ? proposal.payload : null;
  const [rows, setRows] = useState<Row[]>(() => (payload?.criteria ?? []).map((c) => ({ ...c, decision: "pending", edited: false })));
  const [editing, setEditing] = useState<number | null>(null);
  const [hover, setHover] = useState<string[]>([]);
  const [includeMockup, setIncludeMockup] = useState(true);
  if (!payload) return null;
  const story = storyById(state, payload.storyId);
  const pending = proposal.status === "pending";
  const shown = pending ? rows : payload.criteria.map((c) => ({ ...c, decision: "accepted" as Decision, edited: false }));

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const apply = (onlyAccepted: boolean) => {
    const chosen = rows.filter((r) => (onlyAccepted ? r.decision === "accepted" : r.decision !== "rejected"));
    run(
      { type: "apply_criteria", proposalId: proposal.id, criteria: chosen.map(({ text, elementIds }) => ({ text, elementIds })), includeMockup: includeMockup && !!payload.mockup },
      onlyAccepted ? `Kinnitan ✓ märgitud kriteeriumid (${chosen.length})` : `Kinnita kõik (${chosen.length})`,
    );
  };
  const accepted = rows.filter((r) => r.decision === "accepted").length;
  const remaining = rows.filter((r) => r.decision !== "rejected").length;

  return (
    <div className="card wide">
      <div className="card-label">
        Kriteeriumid ja mockup {story ? `· ${story.code} ${storyTitle(story)}` : ""}
      </div>
      <div className="split-view">
        <div>
          <ol className="criteria-list">
            {shown.map((c, i) => (
              <li
                key={i}
                className={`crit ${c.decision}`}
                onMouseEnter={() => setHover(c.elementIds)}
                onMouseLeave={() => setHover([])}
              >
                {editing === i && pending ? (
                  <div className="inline-form">
                    <input autoFocus value={c.text} onChange={(e) => update(i, { text: e.target.value, edited: true })} onKeyDown={(e) => e.key === "Enter" && setEditing(null)} />
                    <button className="btn small" onClick={() => { update(i, { decision: "accepted" }); setEditing(null); }}>
                      Salvesta
                    </button>
                  </div>
                ) : (
                  <span className="crit-text">
                    {c.text}
                    {c.edited && <span className="tag subtle">muudetud</span>}
                    {c.elementIds.length > 0 && <span className="tag subtle" title="Seotud mockup'i elemendid">◫ {c.elementIds.join(", ")}</span>}
                  </span>
                )}
                <CriterionWarnings text={c.text} />
                {pending && editing !== i && (
                  <span className="crit-actions">
                    <button className={`icon-btn ok${c.decision === "accepted" ? " on" : ""}`} title="Nõus" onClick={() => update(i, { decision: c.decision === "accepted" ? "pending" : "accepted" })}>
                      ✓ Nõus
                    </button>
                    <button className="icon-btn" title="Muuda" onClick={() => setEditing(i)}>
                      ✎ Muuda
                    </button>
                    <button className={`icon-btn danger${c.decision === "rejected" ? " on" : ""}`} title="Eemalda" onClick={() => update(i, { decision: c.decision === "rejected" ? "pending" : "rejected" })}>
                      ✗ {c.decision === "rejected" ? "Taasta" : "Eemalda"}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
          {pending && (
            <button
              className="btn ghost small"
              onClick={() => {
                setRows((r) => [...r, { text: "", elementIds: [], decision: "accepted", edited: true }]);
                setEditing(rows.length);
              }}
            >
              + Lisa kriteerium
            </button>
          )}
        </div>
        {payload.mockup && (
          <div>
            <MockupView spec={payload.mockup} highlight={hover} compact />
            {pending && (
              <label className="small">
                <input type="checkbox" checked={includeMockup} onChange={(e) => setIncludeMockup(e.target.checked)} /> Lisa mockup loole
              </label>
            )}
          </div>
        )}
      </div>
      {pending && (
        <div className="card-actions">
          <button className="btn primary" disabled={busy || remaining === 0} onClick={() => apply(false)}>
            Kinnita kõik ({remaining})
          </button>
          <button className="btn" disabled={busy || accepted === 0} onClick={() => apply(true)}>
            Kinnita ainult ✓ märgitud ({accepted})
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => run({ type: "reject_proposal", proposalId: proposal.id }, "Loobu")}>
            Loobu
          </button>
        </div>
      )}
      <ProposalStatus proposal={proposal} />
    </div>
  );
}

/** Uue vaate prototüüp: mockup, Connextra pealkiri ja kriteeriumid korraga. */
export function NewViewCard({ proposal }: { proposal: Proposal }) {
  const { run, busy } = useProject();
  const [hover, setHover] = useState<string[]>([]);
  if (proposal.payload.kind !== "new_view") return null;
  const p = proposal.payload;
  const pending = proposal.status === "pending";
  return (
    <div className="card wide">
      <div className="card-label">Uus vaade: {p.request}</div>
      <p className="story-title">{storyTitle(p.story)}</p>
      <div className="split-view">
        <ol className="criteria-list">
          {p.criteria.map((c, i) => (
            <li key={i} className="crit" onMouseEnter={() => setHover(c.elementIds)} onMouseLeave={() => setHover([])}>
              <span className="crit-text">{c.text}</span>
              <CriterionWarnings text={c.text} />
            </li>
          ))}
        </ol>
        <MockupView spec={p.mockup} highlight={hover} compact />
      </div>
      {pending && (
        <div className="card-actions">
          <button className="btn primary" disabled={busy} onClick={() => run({ type: "apply_new_view", proposalId: proposal.id }, "Lisa backlog'i")}>
            Lisa backlog'i
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => run({ type: "reject_proposal", proposalId: proposal.id }, "Loobu")}>
            Loobu
          </button>
        </div>
      )}
      <ProposalStatus proposal={proposal} />
    </div>
  );
}
