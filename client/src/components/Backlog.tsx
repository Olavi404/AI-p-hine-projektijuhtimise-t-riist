import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { api } from "../api.ts";
import { useProject } from "../state.tsx";
import type { Story, StoryDraft, StoryStatus } from "../../../shared/types.ts";
import { SIZES, STATUSES, STATUS_LABELS } from "../../../shared/types.ts";
import { checkCriterion, definitionOfReady, mergeCriteriaTexts, storyTitle } from "../../../shared/quality.ts";
import { CriterionWarnings } from "./CriterionWarnings.tsx";

export function Backlog() {
  const { state, mutate, run, busy, openStory, showPrototype } = useProject();
  const pid = state.project.id;
  const stories = state.stories;
  const mvp = state.project.mvpLine;
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSel, setMergeSel] = useState<string[]>([]);
  const [mergeDraft, setMergeDraft] = useState<StoryDraft | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StoryStatus | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const flash = useFlash(stories);

  const filtering = query.trim() !== "" || statusFilter !== null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stories.filter(
      (s) =>
        (!statusFilter || s.status === statusFilter) &&
        (!q || `${s.code} ${storyTitle(s)} ${s.criteria.map((c) => c.text).join(" ")}`.toLowerCase().includes(q)),
    );
  }, [stories, query, statusFilter]);

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

  const toggle = (id: string) =>
    setExpanded((e) => {
      const n = new Set(e);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

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
      <BacklogStats active={statusFilter} onFilter={setStatusFilter} />

      <div className="toolbar">
        <div className="search">
          <span aria-hidden>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Otsi lugusid ja kriteeriume…" aria-label="Otsi" />
          {query && (
            <button className="icon-btn" onClick={() => setQuery("")} aria-label="Tühjenda otsing">
              ✕
            </button>
          )}
        </div>
        <button className="btn small" onClick={() => setAdding((v) => !v)}>
          + Lugu
        </button>
        <button
          className={`btn small${mergeMode ? " active" : ""}`}
          onClick={() => {
            setMergeMode((v) => !v);
            setMergeSel([]);
            setMergeDraft(null);
          }}
          disabled={stories.length < 2}
        >
          {mergeMode ? "Tühista" : "Ühenda"}
        </button>
        <button className="btn small primary glow" disabled={busy || stories.length === 0 || !state.ai.available} onClick={() => run({ type: "review" }, "Vaata backlog üle")} title={state.ai.available ? "AI analüüsib kogu backlog'i" : "AI pole seadistatud"}>
          ✨ Vaata üle
        </button>
        {mvp === null ? (
          <button className="btn small ghost" disabled={stories.length === 0} onClick={() => setMvp(Math.min(3, stories.length))}>
            + MVP joon
          </button>
        ) : (
          <button className="btn small ghost" onClick={() => setMvp(null)}>
            − MVP joon
          </button>
        )}
      </div>

      {adding && <AddStoryForm onDone={() => setAdding(false)} />}

      {mergeMode && (
        <div className="banner info slide-down">
          Vali kattuvad lood ({mergeSel.length} valitud).{" "}
          <button className="btn small primary" disabled={mergeSel.length < 2} onClick={startMerge}>
            Näita ühendatud lugu
          </button>
        </div>
      )}
      {mergeDraft && (
        <div className="card wide merge-preview slide-down">
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

      {stories.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">▲</div>
          <p>Backlog on tühi.</p>
          <p className="muted small">Kirjelda vestluses kliendi ideed või lisa lugu käsitsi.</p>
        </div>
      )}
      {stories.length > 0 && visible.length === 0 && <p className="muted empty">Filtrile vastavaid lugusid pole.</p>}
      {filtering && visible.length > 0 && <p className="muted small filter-note">Filtreeritud vaates on järjestamine ja MVP joon peidetud.</p>}

      <ol className="story-list" onDragOver={(e) => e.preventDefault()}>
        {visible.map((s) => {
          const i = stories.indexOf(s);
          const open = expanded.has(s.id);
          return (
            <Fragment key={s.id}>
              {!filtering && mvp === i && <MvpLine index={i} onMove={setMvp} max={stories.length} />}
              <li
                className={`story-row${dropIndex === i ? " drop-before" : ""}${dragId === s.id ? " dragging" : ""}${state.project.focusStoryId === s.id ? " focus" : ""}${!filtering && mvp !== null && i >= mvp ? " below-mvp" : ""}${flash.has(s.id) ? " flash" : ""}${open ? " open" : ""}`}
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                draggable={!filtering}
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
                <div className="story-row-main">
                  {mergeMode && (
                    <input
                      type="checkbox"
                      aria-label={`Vali ${s.code} ühendamiseks`}
                      checked={mergeSel.includes(s.id)}
                      onChange={() => setMergeSel((m) => (m.includes(s.id) ? m.filter((x) => x !== s.id) : [...m, s.id]))}
                    />
                  )}
                  {!filtering && (
                    <span className="drag-handle" title="Lohista järjekorra muutmiseks">
                      ⋮⋮
                    </span>
                  )}
                  <span className="pos">{i + 1}</span>
                  <button className={`chevron${open ? " open" : ""}`} onClick={() => toggle(s.id)} aria-expanded={open} aria-label={open ? "Sulge" : "Ava eelvaade"}>
                    ›
                  </button>
                  <button className="story-main" onClick={() => toggle(s.id)}>
                    <span className="story-title">
                      <strong>{s.code}</strong> {storyTitle(s)}
                    </span>
                    <StoryBadges story={s} />
                  </button>
                  <span className="row-actions">
                    <button className="icon-btn" title="Ava detailvaade" onClick={() => openStory(s.id)}>
                      ✎
                    </button>
                    {!filtering && (
                      <>
                        <button className="icon-btn" title="Üles" disabled={i === 0} onClick={() => move(i, i - 1)}>
                          ↑
                        </button>
                        <button className="icon-btn" title="Alla" disabled={i === stories.length - 1} onClick={() => move(i, i + 1)}>
                          ↓
                        </button>
                        <button className="icon-btn" title="MVP joon selle loo alla" onClick={() => setMvp(i + 1)}>
                          ⤓
                        </button>
                      </>
                    )}
                  </span>
                </div>
                {open && <StoryPreview story={s} onOpen={() => openStory(s.id)} onPrototype={() => showPrototype(s.id)} />}
              </li>
            </Fragment>
          );
        })}
        {!filtering && stories.length > 0 && (
          <li
            className={`drop-end${dropIndex === stories.length ? " drop-before" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropIndex(stories.length);
            }}
            onDrop={(e) => onDrop(e, stories.length)}
          />
        )}
        {!filtering && mvp !== null && mvp >= stories.length && stories.length > 0 && <MvpLine index={stories.length} onMove={setMvp} max={stories.length} />}
      </ol>
    </div>
  );
}

/** Lood, mis lisandusid või muutusid pärast eelmist seisu, tõstetakse hetkeks esile. */
function useFlash(stories: Story[]): Set<string> {
  const prev = useRef<Map<string, string> | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  useEffect(() => {
    const now = new Map(stories.map((s) => [s.id, `${s.updatedAt}|${s.position}`]));
    if (prev.current) {
      const changed = new Set([...now].filter(([id, v]) => prev.current!.get(id) !== v).map(([id]) => id));
      if (changed.size > 0 && changed.size < stories.length) {
        setFlash(changed);
        const t = window.setTimeout(() => setFlash(new Set()), 1800);
        prev.current = now;
        return () => window.clearTimeout(t);
      }
    }
    prev.current = now;
  }, [stories]);
  return flash;
}

/** Staatuste jaotus: riba lõigule klõpsates filtreeritakse backlog selle staatuse järgi. */
function BacklogStats({ active, onFilter }: { active: StoryStatus | null; onFilter: (s: StoryStatus | null) => void }) {
  const { state } = useProject();
  const stories = state.stories;
  if (stories.length === 0) return null;
  const counts = STATUSES.map((s) => ({ status: s, n: stories.filter((x) => x.status === s).length }));
  const dorReady = stories.filter((s) => definitionOfReady(s).ready).length;
  const withCriteria = stories.filter((s) => s.criteria.length >= 3).length;
  const mvp = state.project.mvpLine;
  return (
    <div className="stats">
      <div className="stat-cards">
        <div className="stat">
          <span className="stat-n">{stories.length}</span>
          <span className="stat-l">lugu</span>
        </div>
        <div className="stat">
          <span className="stat-n">{withCriteria}</span>
          <span className="stat-l">kriteeriumidega</span>
        </div>
        <div className="stat">
          <span className="stat-n ok">{dorReady}</span>
          <span className="stat-l">DoR täidetud</span>
        </div>
        <div className="stat">
          <span className="stat-n">{mvp === null ? "–" : Math.min(mvp, stories.length)}</span>
          <span className="stat-l">MVP-s</span>
        </div>
      </div>
      <div className="status-bar" role="group" aria-label="Filtreeri staatuse järgi">
        {counts
          .filter((c) => c.n > 0)
          .map((c) => (
            <button
              key={c.status}
              className={`seg seg-${c.status}${active === c.status ? " active" : ""}${active && active !== c.status ? " dim" : ""}`}
              style={{ flexGrow: c.n }}
              onClick={() => onFilter(active === c.status ? null : c.status)}
              title={`${STATUS_LABELS[c.status]}: ${c.n} – klõpsa filtreerimiseks`}
            />
          ))}
      </div>
      <div className="status-legend">
        {counts.map((c) => (
          <button key={c.status} className={`legend-item${active === c.status ? " active" : ""}`} onClick={() => onFilter(active === c.status ? null : c.status)} disabled={c.n === 0}>
            <span className={`legend-dot seg-${c.status}`} />
            {STATUS_LABELS[c.status]} <span className="muted">{c.n}</span>
          </button>
        ))}
        {active && (
          <button className="legend-item clear" onClick={() => onFilter(null)}>
            ✕ kõik
          </button>
        )}
      </div>
    </div>
  );
}

/** Loo kiire eelvaade backlog'is: kriteeriumid, DoR ja kiirtegevused ilma detailvaadet avamata. */
function StoryPreview({ story, onOpen, onPrototype }: { story: Story; onOpen: () => void; onPrototype: () => void }) {
  const { run, busy, state } = useProject();
  const dor = definitionOfReady(story);
  return (
    <div className="story-preview">
      <div className="preview-cols">
        <div>
          <h5>Kriteeriumid</h5>
          {story.criteria.length === 0 ? (
            <p className="muted small">Kriteeriume pole veel.</p>
          ) : (
            <ul className="preview-criteria">
              {story.criteria.map((c) => (
                <li key={c.id} className={checkCriterion(c.text).length ? "warn" : ""}>
                  {c.text}
                </li>
              ))}
            </ul>
          )}
          {story.openQuestions.length > 0 && (
            <>
              <h5>Avatud küsimused</h5>
              <ul className="preview-criteria">
                {story.openQuestions.map((q) => (
                  <li key={q.id} className="warn">
                    {q.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <h5>Valmisolek</h5>
          <div className="dor-ring" style={{ ["--p" as string]: `${(dor.items.filter((i) => i.ok).length / dor.items.length) * 100}` }}>
            <span>
              {dor.items.filter((i) => i.ok).length}/{dor.items.length}
            </span>
          </div>
          <ul className="dor-mini">
            {dor.items
              .filter((i) => !i.ok)
              .map((i, k) => (
                <li key={k}>✗ {i.label}</li>
              ))}
            {dor.ready && <li className="ok">✓ Valmis arenduseks sobiv</li>}
          </ul>
        </div>
      </div>
      <div className="preview-actions">
        <button className="btn small" onClick={onOpen}>
          ✎ Ava ja muuda
        </button>
        {story.mockup && (
          <button className="btn small" onClick={onPrototype}>
            ◫ Mockup v{story.mockup.version}
          </button>
        )}
        <button className="btn small" disabled={busy || !state.ai.available} onClick={() => run({ type: "propose_criteria", storyId: story.id }, `Paku kriteeriumid ja mockup loole ${story.code}`)}>
          ✨ {story.criteria.length ? "Täienda AI-ga" : "Kriteeriumid ja mockup"}
        </button>
      </div>
    </div>
  );
}

function MvpLine({ index, onMove, max }: { index: number; onMove: (n: number | null) => void; max: number }) {
  return (
    <li className="mvp-line" aria-label="MVP joon">
      <span>MVP · {index} lugu esimeses versioonis</span>
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
      {story.isView && <span className={`tag ${story.mockup ? "subtle" : "warn"}`}>{story.mockup ? `◫ v${story.mockup.version}` : "◫ puudub"}</span>}
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
    <form className="card wide add-story slide-down" onSubmit={submit}>
      <div className="card-label">Uus lugu (Connextra vorm)</div>
      <div className="grid-3">
        <label>
          Rollina…
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Külastaja" required list="roles-list" autoFocus />
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
      <p className="live-title">{storyTitle({ role, action, benefit })}</p>
      <div className="inline-form">
        <div className="segmented" role="radiogroup" aria-label="Suurus">
          {SIZES.map((s) => (
            <button type="button" key={s} className={size === s ? "on" : ""} onClick={() => setSize(s)} aria-pressed={size === s}>
              {s}
            </button>
          ))}
        </div>
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
