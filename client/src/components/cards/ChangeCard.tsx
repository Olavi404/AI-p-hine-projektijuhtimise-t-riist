import { useState } from "react";
import { storyById, useProject } from "../../state.tsx";
import type { ChangeAfter, Proposal } from "../../../../shared/types.ts";
import { storyTitle } from "../../../../shared/quality.ts";
import { MockupView } from "../MockupView.tsx";
import { CriterionWarnings } from "../CriterionWarnings.tsx";
import { ProposalStatus } from "./StoryCards.tsx";

/** Kliendi täpsustusest tulenev muudatusettepanek: eelvaade enne → pärast, [Rakenda] [Muuda] [Loobu]. */
export function ChangeCard({ proposal }: { proposal: Proposal }) {
  const { state, run, busy } = useProject();
  const payload = proposal.payload.kind === "change" ? proposal.payload : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ChangeAfter | null>(payload ? structuredClone(payload.after) : null);
  if (!payload || !draft) return null;
  const story = storyById(state, payload.storyId);
  const pending = proposal.status === "pending";
  const after = editing ? draft : payload.after;
  const before = payload.before;

  const beforeTexts = new Set(before.criteria.map((c) => c.text));
  const afterTexts = new Set(after.criteria.map((c) => c.text));
  const titleChanged = storyTitle(before) !== storyTitle(after);
  const mockupChanged = JSON.stringify(before.mockup) !== JSON.stringify(after.mockup);

  return (
    <div className="card wide change">
      <div className="card-label">
        Muudatusettepanek · ainult lugu {story?.code ?? "?"}
      </div>
      <p className="muted">Kliendi täpsustus: „{payload.request}“</p>
      <p>{payload.summary}</p>

      <div className="diff-block">
        <h5>Loo sõnastus</h5>
        {editing ? (
          <div className="grid-3">
            <label>
              Roll
              <input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
            </label>
            <label>
              Tegevus
              <input value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
            </label>
            <label>
              Kasu
              <input value={draft.benefit} onChange={(e) => setDraft({ ...draft, benefit: e.target.value })} />
            </label>
          </div>
        ) : titleChanged ? (
          <>
            <p className="del">{storyTitle(before)}</p>
            <p className="ins">{storyTitle(after)}</p>
          </>
        ) : (
          <p className="muted">{storyTitle(after)} (ei muutu)</p>
        )}
      </div>

      <div className="diff-block">
        <h5>Vastuvõtukriteeriumid</h5>
        <ul className="diff-list">
          {before.criteria
            .filter((c) => !afterTexts.has(c.text))
            .map((c, i) => (
              <li key={`d${i}`} className="del">
                − {c.text}
              </li>
            ))}
          {after.criteria.map((c, i) =>
            editing ? (
              <li key={i}>
                <div className="inline-form">
                  <input
                    value={c.text}
                    onChange={(e) => setDraft({ ...draft, criteria: draft.criteria.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })}
                  />
                  <button className="icon-btn danger" title="Eemalda" onClick={() => setDraft({ ...draft, criteria: draft.criteria.filter((_, k) => k !== i) })}>
                    ✗
                  </button>
                </div>
                <CriterionWarnings text={c.text} />
              </li>
            ) : (
              <li key={i} className={beforeTexts.has(c.text) ? "" : "ins"}>
                {beforeTexts.has(c.text) ? "  " : "+ "}
                {c.text}
                {!beforeTexts.has(c.text) && <CriterionWarnings text={c.text} />}
              </li>
            ),
          )}
        </ul>
        {editing && (
          <button className="btn ghost small" onClick={() => setDraft({ ...draft, criteria: [...draft.criteria, { text: "", elementIds: [] }] })}>
            + Lisa kriteerium
          </button>
        )}
      </div>

      <div className="diff-block">
        <h5>Mockup {mockupChanged ? "" : "(ei muutu)"}</h5>
        {mockupChanged && (
          <div className="before-after">
            <div>
              <div className="ba-label">Enne</div>
              {before.mockup ? <MockupView spec={before.mockup} compact /> : <p className="muted">Mockup puudus</p>}
            </div>
            <div>
              <div className="ba-label">Pärast</div>
              {after.mockup && <MockupView spec={after.mockup} compareTo={before.mockup} compact />}
            </div>
          </div>
        )}
      </div>

      {payload.otherStories.length > 0 && (
        <p className="muted small">
          Võib mõjutada ka lugusid {payload.otherStories.map((o) => storyById(state, o.storyId)?.code).join(", ")} – neid ei muudeta, vaid pakutakse pärast rakendamist eraldi.
        </p>
      )}

      {pending && (
        <div className="card-actions">
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => run({ type: "apply_change", proposalId: proposal.id, edited: editing ? draft : undefined }, editing ? "Rakenda (muudetud kujul)" : "Rakenda")}
          >
            Rakenda
          </button>
          <button className="btn" disabled={busy} onClick={() => setEditing((v) => !v)}>
            {editing ? "Tühista muutmine" : "Muuda"}
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
