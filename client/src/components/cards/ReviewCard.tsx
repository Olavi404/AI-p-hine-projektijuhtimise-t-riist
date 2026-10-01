import { useState } from "react";
import { storyById, useProject } from "../../state.tsx";
import type { Finding, Proposal, StoryDraft } from "../../../../shared/types.ts";
import { FINDING_LABELS, SIZES } from "../../../../shared/types.ts";
import { storyTitle } from "../../../../shared/quality.ts";
import { CriterionWarnings } from "../CriterionWarnings.tsx";

/** AI ülevaatuse leiud: probleem, põhjendus ja konkreetne ettepanek valikutega [Rakenda] [Muuda] [Ignoreeri]. */
export function ReviewCard({ proposal }: { proposal: Proposal }) {
  if (proposal.payload.kind !== "review") return null;
  const findings = proposal.payload.findings;
  const open = findings.filter((f) => f.status === "pending").length;
  return (
    <div className="card wide">
      <div className="card-label">
        Backlog'i ülevaatus · {findings.length} leidu{open ? `, ${open} ootel` : ", kõik käsitletud"}
      </div>
      {proposal.status === "rejected" && <div className="card-status">Asendatud uuema ülevaatusega.</div>}
      {findings.map((f, i) => (
        <FindingView key={i} finding={f} index={i} proposalId={proposal.id} closed={proposal.status === "rejected"} />
      ))}
    </div>
  );
}

function FindingView({ finding, index, proposalId, closed }: { finding: Finding; index: number; proposalId: string; closed: boolean }) {
  const { state, run, busy } = useProject();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<StoryDraft[]>(() => structuredClone(finding.newStories));
  const stories = finding.storyIds.map((id) => storyById(state, id));
  const pending = finding.status === "pending" && !closed;
  const shown = editing ? drafts : finding.newStories;
  const setDraft = (i: number, patch: Partial<StoryDraft>) => setDrafts((d) => d.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <div className={`finding ${finding.status}`}>
      <div className="finding-head">
        <span className={`tag type-${finding.type}`}>{FINDING_LABELS[finding.type]}</span>
        {stories.map((s, i) => (
          <span key={i} className="tag subtle">
            {s?.code ?? "kustutatud"}
          </span>
        ))}
        {finding.status === "applied" && <span className="tag ok">✓ Rakendatud</span>}
        {finding.status === "ignored" && <span className="tag subtle">Ignoreeritud</span>}
      </div>
      <p>
        <strong>Probleem:</strong> {finding.problem}
      </p>
      <p className="muted">
        <strong>Põhjendus:</strong> {finding.reason}
      </p>

      {finding.fixKind !== "none" && finding.fixKind !== "generate_mockup" && (
        <div className="fix-preview">
          <h5>
            {finding.fixKind === "split" && "Ettepanek: jaga lugudeks"}
            {finding.fixKind === "merge" && "Ettepanek: ühendatud lugu (kriteeriumid ilma korduseta)"}
            {finding.fixKind === "rewrite" && "Ettepanek: parandatud lugu"}
          </h5>
          {finding.fixKind === "rewrite" && stories[0] && <p className="del">{storyTitle(stories[0])}</p>}
          {finding.fixKind === "merge" &&
            stories.map((s, i) => s && (
              <p key={i} className="del">
                {s.code}: {storyTitle(s)}
              </p>
            ))}
          {shown.map((d, i) => (
            <div key={i} className="draft">
              {editing ? (
                <div className="grid-3">
                  <label>
                    Roll
                    <input value={d.role} onChange={(e) => setDraft(i, { role: e.target.value })} />
                  </label>
                  <label>
                    Tegevus
                    <input value={d.action} onChange={(e) => setDraft(i, { action: e.target.value })} />
                  </label>
                  <label>
                    Kasu
                    <input value={d.benefit} onChange={(e) => setDraft(i, { benefit: e.target.value })} />
                  </label>
                  <label>
                    Suurus
                    <select value={d.size} onChange={(e) => setDraft(i, { size: e.target.value as StoryDraft["size"] })}>
                      {SIZES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <p className="ins">
                  {finding.fixKind === "split" && `${i + 1}. `}
                  {storyTitle(d)} <span className="tag">{d.size}</span>
                </p>
              )}
              <ul className="draft-criteria">
                {d.criteria.map((c, k) => (
                  <li key={k}>
                    {editing ? (
                      <div className="inline-form">
                        <input value={c} onChange={(e) => setDraft(i, { criteria: d.criteria.map((x, j) => (j === k ? e.target.value : x)) })} />
                        <button className="icon-btn danger" onClick={() => setDraft(i, { criteria: d.criteria.filter((_, j) => j !== k) })}>
                          ✗
                        </button>
                      </div>
                    ) : (
                      c
                    )}
                    <CriterionWarnings text={c} />
                  </li>
                ))}
                {d.criteria.length === 0 && <li className="muted">kriteeriumid puuduvad</li>}
              </ul>
              {editing && (
                <button className="btn ghost small" onClick={() => setDraft(i, { criteria: [...d.criteria, ""] })}>
                  + Kriteerium
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {finding.fixKind === "generate_mockup" && <p className="muted">Ettepanek: koostan loole mockup'i ja kriteeriumid (eraldi eelvaatega).</p>}

      {pending && (
        <div className="card-actions">
          <button
            className="btn primary small"
            disabled={busy || stories.some((s) => !s)}
            onClick={() =>
              run(
                { type: "apply_finding", proposalId, index, edited: editing ? drafts.map((d) => ({ ...d, criteria: d.criteria.filter((c) => c.trim()) })) : undefined },
                `Rakenda: ${finding.problem}`,
              )
            }
          >
            Rakenda
          </button>
          {finding.newStories.length > 0 && (
            <button className="btn small" disabled={busy} onClick={() => setEditing((v) => !v)}>
              {editing ? "Tühista muutmine" : "Muuda"}
            </button>
          )}
          <button className="btn ghost small" disabled={busy} onClick={() => run({ type: "ignore_finding", proposalId, index })}>
            Ignoreeri
          </button>
        </div>
      )}
    </div>
  );
}
