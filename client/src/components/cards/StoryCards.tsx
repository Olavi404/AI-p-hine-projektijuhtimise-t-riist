import { useState } from "react";
import { useProject } from "../../state.tsx";
import type { Proposal, Role } from "../../../../shared/types.ts";
import { storyTitle } from "../../../../shared/quality.ts";

export function ProposalStatus({ proposal }: { proposal: Proposal }) {
  if (proposal.status === "applied") return <div className="card-status ok">✓ Kinnitatud</div>;
  if (proposal.status === "rejected") return <div className="card-status">✗ Loobutud</div>;
  return null;
}

export function RolesCard({ proposal }: { proposal: Proposal }) {
  const { run, busy } = useProject();
  const initial = proposal.payload.kind === "roles" ? proposal.payload.roles : [];
  const [roles, setRoles] = useState<(Role & { on: boolean })[]>(initial.map((r) => ({ ...r, on: true })));
  const [extra, setExtra] = useState("");
  const pending = proposal.status === "pending";

  const add = () => {
    const name = extra.trim();
    if (!name) return;
    setRoles((r) => [...r, { name, description: "Käsitsi lisatud roll", on: true }]);
    setExtra("");
  };
  const chosen = roles.filter((r) => r.on);

  return (
    <div className="card">
      <div className="card-label">Kasutajarollid</div>
      <ul className="check-list">
        {roles.map((r, i) => (
          <li key={i}>
            <label>
              <input type="checkbox" checked={r.on} disabled={!pending} onChange={() => setRoles((all) => all.map((x, k) => (k === i ? { ...x, on: !x.on } : x)))} />
              <strong>{r.name}</strong>
              {r.description && <span className="muted"> – {r.description}</span>}
            </label>
            {pending && (
              <button className="icon-btn" title="Eemalda roll" onClick={() => setRoles((all) => all.filter((_, k) => k !== i))}>
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {pending && (
        <>
          <div className="inline-form">
            <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Lisa roll, nt Treener" onKeyDown={(e) => e.key === "Enter" && add()} />
            <button className="btn small" onClick={add} disabled={!extra.trim()}>
              Lisa
            </button>
          </div>
          <div className="card-actions">
            <button
              className="btn primary"
              disabled={busy || chosen.length === 0}
              onClick={() =>
                run(
                  { type: "confirm_roles", proposalId: proposal.id, roles: chosen.map(({ name, description }) => ({ name, description })) },
                  `Kinnitan rollid: ${chosen.map((r) => r.name).join(", ")}`,
                )
              }
            >
              Kinnita rollid ({chosen.length})
            </button>
            <button className="btn" disabled={busy} onClick={() => run({ type: "reject_proposal", proposalId: proposal.id }, "Loobu")}>
              Loobu
            </button>
          </div>
        </>
      )}
      <ProposalStatus proposal={proposal} />
    </div>
  );
}

export function StoriesCard({ proposal }: { proposal: Proposal }) {
  const { run, busy } = useProject();
  const stories = proposal.payload.kind === "stories" ? proposal.payload.stories : [];
  const [checked, setChecked] = useState<boolean[]>(stories.map(() => true));
  const [feedback, setFeedback] = useState("");
  const [askFeedback, setAskFeedback] = useState(false);
  const pending = proposal.status === "pending";
  const selected = checked.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);

  return (
    <div className="card">
      <div className="card-label">Kasutajalood happy path'i järjekorras</div>
      <ol className="story-proposals">
        {stories.map((s, i) => (
          <li key={i} className={checked[i] ? "" : "off"}>
            <label>
              <input type="checkbox" checked={checked[i]} disabled={!pending} onChange={() => setChecked((c) => c.map((x, k) => (k === i ? !x : x)))} />
              <span>
                <span className="story-title">{storyTitle(s)}</span>
                <span className="tags">
                  <span className="tag">{s.size}</span>
                  {!s.isView && <span className="tag subtle">pole vaade</span>}
                  {s.note && <span className="muted small">{s.note}</span>}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ol>
      {pending && (
        <div className="card-actions">
          <button className="btn primary" disabled={busy} onClick={() => run({ type: "add_stories", proposalId: proposal.id, indices: stories.map((_, i) => i) }, `Lisa kõik backlog'i (${stories.length})`)}>
            Lisa kõik backlog'i
          </button>
          <button
            className="btn"
            disabled={busy || selected.length === 0 || selected.length === stories.length}
            onClick={() => run({ type: "add_stories", proposalId: proposal.id, indices: selected }, `Lisa valitud (${selected.length})`)}
          >
            Lisa valitud ({selected.length})
          </button>
          <button className="btn ghost" disabled={busy} onClick={() => setAskFeedback((v) => !v)}>
            Paku teistsuguseid
          </button>
        </div>
      )}
      {pending && askFeedback && (
        <div className="inline-form">
          <input value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Mis peaks olema teisiti? (valikuline)" />
          <button
            className="btn small"
            disabled={busy}
            onClick={() => run({ type: "propose_stories", feedback: feedback.trim() || "Paku teistsuguseid lugusid." }, "Paku teistsuguseid")}
          >
            Paku
          </button>
        </div>
      )}
      <ProposalStatus proposal={proposal} />
    </div>
  );
}
