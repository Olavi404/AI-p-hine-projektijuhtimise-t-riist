import { Fragment, useState, type DragEvent, type FormEvent } from "react";
import { api } from "../api.ts";
import { useProject } from "../state.tsx";
import type { Story, StoryDraft } from "../../../shared/types.ts";
import { SIZES, STATUS_LABELS } from "../../../shared/types.ts";
import { definitionOfReady, mergeCriteriaTexts, storyTitle } from "../../../shared/quality.ts";
import { CriterionWarnings } from "./CriterionWarnings.tsx";

export function Backlog() {
  const { state, mutate, run, busy, openStory } = useProject();
  const pid = state.project.id;
  const stories = state.stories;
  const mvp = state.project.mvpLine;
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSel, setMergeSel] = useState<string[]>([]);
  const [mergeDraft, setMergeDraft] = useState<StoryDraft | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= stories.length || from === to) return;
    const ids = stories.map((s) => s.id);
    const [x] = ids.splice(from, 1);
    ids.splice(to, 0, x);
    mutate(() => api.reorder(pid, ids));
  };

  const onDrop = (e: DragEvent, index: number) => {
    e.preventDefault();
    const from = stories.findIndex((s) => s.id === dragId);
    setDragId(null);
    setDropIndex(null);
    if (from < 0) return;
    move(from, from < index ? index - 1 : index);
  };

  const setMvp = (line: number | null) => mutate(() => api.patchProject(pid, { mvpLine: line }));

  const startMerge = () => {
    const chosen = stories.filter((s) => mergeSel.includes(s.id));
    if (chosen.length < 2) return;
    const first = chosen[0];
    setMergeDraft({
      role: first.role,
      action: chosen.map((s) => s.action).sort((a, b) => b.length - a.length)[0],
      benefit: first.benefit,
      size: first.size ?? "M",
      isView: chosen.some((s) => s.isView),
      criteria: mergeCriteriaTexts(chosen.map((s) => s.criteria.map((c) => c.text))),
    });
  };

  const confirmMerge = async () => {
    if (!mergeDraft) return;
    const ok = await mutate(() => api.merge(pid, mergeSel, { ...mergeDraft, criteria: mergeDraft.criteria.filter((c) => c.trim()) }));
    if (ok) {
      setMergeDraft(null);
      setMergeMode(false);
      setMergeSel([]);
    }
  };

  return (
    <div className="backlog">
      <div className="toolbar">
        <button className="btn small" onClick={() => setAdding((v) => !v)}>
          + Lisa lugu
        </button>
        <button className={`btn small${mergeMode ? " active" : ""}`} onClick={() => { setMergeMode((v) => !v); setMergeSel([]); setMergeDraft(null); }} disabled={stories.length < 2}>
          {mergeMode ? "Tühista ühendamine" : "Ühenda kattuvad"}
        </button>
        <button className="btn small primary" disabled={busy || stories.length === 0 || !state.ai.available} onClick={() => run({ type: "review" }, "Vaata backlog üle")} title={state.ai.available ? "AI analüüsib kogu backlog'i" : "AI pole seadistatud"}>
          ✨ Vaata backlog üle
        </button>
        {mvp === null ? (
          <button className="btn small ghost" disabled={stories.length === 0} onClick={() => setMvp(Math.min(3, stories.length))}>
            Määra MVP joon
          </button>
        ) : (
          <button className="btn small ghost" onClick={() => setMvp(null)}>
            Eemalda MVP joon
          </button>
        )}
      </div>

      {adding && <AddStoryForm onDone={() => setAdding(false)} />}

      {mergeMode && (
        <div className="banner info">
          Vali kattuvad lood ({mergeSel.length} valitud).{" "}
          <button className="btn small primary" disabled={mergeSel.length < 2} onClick={startMerge}>
            Näita ühendatud lugu
          </button>
        </div>
      )}
      {mergeDraft && (
        <div className="card wide merge-preview">
          <div className="card-label">Ühendamise eelvaade</div>
          {stories
            .filter((s) => mergeSel.includes(s.id))
            .map((s) => (
              <p key={s.id} className="del">
                {s.code}: {storyTitle(s)}
              </p>
            ))}
          <div className="grid-3">
            <label>
              Roll
              <input value={mergeDraft.role} onChange={(e) => setMergeDraft({ ...mergeDraft, role: e.target.value })} />
            </label>
            <label>
              Tegevus
              <input value={mergeDraft.action} onChange={(e) => setMergeDraft({ ...mergeDraft, action: e.target.value })} />
            </label>
            <label>
              Kasu
              <input value={mergeDraft.benefit} onChange={(e) => setMergeDraft({ ...mergeDraft, benefit: e.target.value })} />
            </label>
          </div>
          <p className="ins">{storyTitle(mergeDraft)}</p>
          <h5>Kriteeriumid (ühendatud, ilma korduseta)</h5>
          <ul className="draft-criteria">
            {mergeDraft.criteria.map((c, i) => (
              <li key={i}>
                <div className="inline-form">
                  <input value={c} onChange={(e) => setMergeDraft({ ...mergeDraft, criteria: mergeDraft.criteria.map((x, k) => (k === i ? e.target.value : x)) })} />
                  <button className="icon-btn danger" onClick={() => setMergeDraft({ ...mergeDraft, criteria: mergeDraft.criteria.filter((_, k) => k !== i) })}>
                    ✗
                  </button>
                </div>
                <CriterionWarnings text={c} />
              </li>
            ))}
          </ul>
          <div className="card-actions">
            <button className="btn primary" onClick={confirmMerge}>
              Ühenda
            </button>
            <button className="btn ghost" onClick={() => setMergeDraft(null)}>
              Loobu
            </button>
          </div>
        </div>
      )}

      {stories.length === 0 && <p className="muted empty">Backlog on tühi. Kirjelda vestluses kliendi ideed või lisa lugu käsitsi.</p>}

      <ol className="story-list" onDragOver={(e) => e.preventDefault()}>
        {stories.map((s, i) => (
          <Fragment key={s.id}>
            {mvp === i && <MvpLine index={i} onMove={setMvp} max={stories.length} />}
            <li
              className={`story-row${dropIndex === i ? " drop-before" : ""}${dragId === s.id ? " dragging" : ""}${state.project.focusStoryId === s.id ? " focus" : ""}${mvp !== null && i >= mvp ? " below-mvp" : ""}`}
              draggable
              onDragStart={(e) => {
                setDragId(s.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragId(null);
                setDropIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDropIndex(i);
              }}
              onDrop={(e) => onDrop(e, i)}
            >
              {mergeMode && (
                <input
                  type="checkbox"
                  aria-label={`Vali ${s.code} ühendamiseks`}
                  checked={mergeSel.includes(s.id)}
                  onChange={() => setMergeSel((m) => (m.includes(s.id) ? m.filter((x) => x !== s.id) : [...m, s.id]))}
                />
              )}
              <span className="drag-handle" title="Lohista järjekorra muutmiseks">
                ⋮⋮
              </span>
              <span className="pos">{i + 1}.</span>
              <button className="story-main" onClick={() => openStory(s.id)}>
                <span className="story-title">
                  <strong>{s.code}</strong> {storyTitle(s)}
                </span>
                <StoryBadges story={s} />
              </button>
              <span className="row-actions">
                <button className="icon-btn" title="Üles" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  ↑
                </button>
                <button className="icon-btn" title="Alla" disabled={i === stories.length - 1} onClick={() => move(i, i + 1)}>
                  ↓
                </button>
                <button className="icon-btn" title="MVP joon selle loo alla" onClick={() => setMvp(i + 1)}>
                  ⤓
                </button>
              </span>
            </li>
          </Fragment>
        ))}
        {stories.length > 0 && (
          <li
            className={`drop-end${dropIndex === stories.length ? " drop-before" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropIndex(stories.length);
            }}
            onDrop={(e) => onDrop(e, stories.length)}
          />
        )}
        {mvp !== null && mvp >= stories.length && stories.length > 0 && <MvpLine index={stories.length} onMove={setMvp} max={stories.length} />}
      </ol>
    </div>
  );
}

function MvpLine({ index, onMove, max }: { index: number; onMove: (n: number | null) => void; max: number }) {
  return (
    <li className="mvp-line" aria-label="MVP joon">
      <span>MVP joon · {index} lugu esimeses versioonis</span>
      <span className="row-actions">
        <button className="icon-btn" title="Liiguta joont üles" disabled={index === 0} onClick={() => onMove(index - 1)}>
          ↑
        </button>
        <button className="icon-btn" title="Liiguta joont alla" disabled={index >= max} onClick={() => onMove(index + 1)}>
          ↓
        </button>
      </span>
    </li>
  );
}

export function StoryBadges({ story }: { story: Story }) {
  const dor = definitionOfReady(story);
  const missing = dor.items.filter((i) => !i.ok);
  return (
    <span className="tags">
      <span className={`tag status-${story.status}`}>{STATUS_LABELS[story.status]}</span>
      {story.size && <span className="tag">{story.size}</span>}
      <span className="tag subtle" title="Vastuvõtukriteeriume">
        ☑ {story.criteria.length}
      </span>
      {story.isView && <span className={`tag ${story.mockup ? "subtle" : "warn"}`}>{story.mockup ? `◫ v${story.mockup.version}` : "◫ mockup puudub"}</span>}
      {story.openQuestions.length > 0 && <span className="tag warn">? {story.openQuestions.length}</span>}
      <span className={`tag ${dor.ready ? "ok" : "subtle"}`} title={dor.ready ? "Vastab valmisoleku definitsioonile" : missing.map((m) => m.label).join("\n")}>
        DoR {dor.ready ? "✓" : `${dor.items.length - missing.length}/${dor.items.length}`}
      </span>
      <span className="tag subtle">{story.origin === "ai" ? "AI" : "käsitsi"}</span>
    </span>
  );
}

function AddStoryForm({ onDone }: { onDone: () => void }) {
  const { state, mutate } = useProject();
  const [role, setRole] = useState(state.project.context.roles[0]?.name ?? "");
  const [action, setAction] = useState("");
  const [benefit, setBenefit] = useState("");
  const [size, setSize] = useState<string>("M");
  const [isView, setIsView] = useState(true);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await mutate(() => api.addStory(state.project.id, { role, action, benefit, size: size as "S" | "M" | "L", isView }));
    if (ok) onDone();
  };

  return (
    <form className="card wide add-story" onSubmit={submit}>
      <div className="card-label">Uus lugu (Connextra vorm)</div>
      <div className="grid-3">
        <label>
          Rollina…
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Külastaja" required list="roles-list" />
          <datalist id="roles-list">
            {state.project.context.roles.map((r) => (
              <option key={r.name} value={r.name} />
            ))}
          </datalist>
        </label>
        <label>
          …soovin…
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="näha liikmepakette ja hindu" required />
        </label>
        <label>
          …et…
          <input value={benefit} onChange={(e) => setBenefit(e.target.value)} placeholder="valida endale sobiv pakett" required />
        </label>
      </div>
      <p className="muted small">{storyTitle({ role, action, benefit })}</p>
      <div className="inline-form">
        <label>
          Suurus{" "}
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            {SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={isView} onChange={(e) => setIsView(e.target.checked)} /> Puudutab vaadet
        </label>
        <button className="btn primary small" type="submit">
          Lisa backlog'i
        </button>
        <button className="btn ghost small" type="button" onClick={onDone}>
          Loobu
        </button>
      </div>
    </form>
  );
}
