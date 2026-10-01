import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { storyById, useProject } from "../state.tsx";
import type { Criterion, MockupVersion, OpenQuestion, StoryDraft, StorySize, StoryStatus } from "../../../shared/types.ts";
import { SIZES, STATUSES, STATUS_LABELS } from "../../../shared/types.ts";
import { checkConnextra, definitionOfReady, storyTitle } from "../../../shared/quality.ts";
import { CriterionWarnings } from "./CriterionWarnings.tsx";
import { MockupView } from "./MockupView.tsx";

const newId = () => Math.random().toString(36).slice(2, 10);

/** Loo detailvaade: käsitsi muutmine, valmisoleku kontroll, avatud küsimused, mockup'i versioonid, jagamine. */
export function StoryDrawer({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const { state, mutate, run, busy, notify, showPrototype } = useProject();
  const story = storyById(state, storyId)!;
  const pid = state.project.id;

  const [role, setRole] = useState(story.role);
  const [action, setAction] = useState(story.action);
  const [benefit, setBenefit] = useState(story.benefit);
  const [size, setSize] = useState<StorySize | null>(story.size);
  const [isView, setIsView] = useState(story.isView);
  const [criteria, setCriteria] = useState<Criterion[]>(story.criteria);
  const [question, setQuestion] = useState("");
  const [hover, setHover] = useState<string[]>([]);
  const [versions, setVersions] = useState<MockupVersion[]>([]);
  const [splitting, setSplitting] = useState(false);
  const [refineText, setRefineText] = useState("");

  // Serveri seisu muutudes (nt AI ettepaneku rakendamine) laetakse väljad uuesti.
  useEffect(() => {
    setRole(story.role);
    setAction(story.action);
    setBenefit(story.benefit);
    setSize(story.size);
    setIsView(story.isView);
    setCriteria(story.criteria);
  }, [story.updatedAt, story.id]);

  useEffect(() => {
    api.mockupVersions(pid, storyId).then(setVersions).catch(() => setVersions([]));
  }, [pid, storyId, story.mockup?.id, story.mockupVersionCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const draft = { ...story, role, action, benefit, size, isView, criteria };
  const dor = definitionOfReady(draft);
  const dirty =
    role !== story.role ||
    action !== story.action ||
    benefit !== story.benefit ||
    size !== story.size ||
    isView !== story.isView ||
    JSON.stringify(criteria) !== JSON.stringify(story.criteria);

  const save = () =>
    mutate(() =>
      api.patchStory(pid, storyId, {
        role,
        action,
        benefit,
        size,
        isView,
        criteria: criteria.filter((c) => c.text.trim()).map((c) => ({ text: c.text, elementIds: c.elementIds })),
      }),
    );

  const setStatus = async (status: StoryStatus) => {
    if (dirty) {
      notify("Salvesta esmalt muudatused.", "error");
      return;
    }
    if (status === "ready" && !dor.ready) {
      notify(`Lugu ei vasta valmisoleku definitsioonile: ${dor.items.filter((i) => !i.ok).map((i) => i.label).join("; ")}`, "error");
      return;
    }
    await mutate(() => api.patchStory(pid, storyId, { status }));
  };

  const setQuestions = (openQuestions: OpenQuestion[], status?: StoryStatus) => mutate(() => api.patchStory(pid, storyId, { openQuestions, ...(status ? { status } : {}) }));

  const markNeedsClarification = async () => {
    const text = question.trim() || prompt("Mis vajab täpsustamist? (avatud küsimus)")?.trim();
    if (!text) return;
    const ok = await setQuestions([...story.openQuestions, { id: newId(), text }], "needs_clarification");
    if (ok) setQuestion("");
  };

  const remove = async () => {
    if (!confirm(`Kustutada lugu ${story.code}? (Saad tagasi võtta.)`)) return;
    const ok = await mutate(() => api.deleteStory(pid, storyId));
    if (ok) onClose();
  };

  const connextra = checkConnextra({ role, action, benefit });

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label={`Lugu ${story.code}`}>
        <header className="drawer-head">
          <h2>
            {story.code} <span className="muted small">{story.origin === "ai" ? "AI ettepanek" : "käsitsi lisatud"}</span>
          </h2>
          <button className="icon-btn" onClick={onClose} title="Sulge (Esc)">
            ✕
          </button>
        </header>

        <section>
          <p className="story-title big">{storyTitle({ role, action, benefit })}</p>
          <div className="grid-3">
            <label>
              Roll
              <input value={role} onChange={(e) => setRole(e.target.value)} />
            </label>
            <label>
              Tegevus (soovin…)
              <input value={action} onChange={(e) => setAction(e.target.value)} />
            </label>
            <label>
              Kasu (et…)
              <input value={benefit} onChange={(e) => setBenefit(e.target.value)} />
            </label>
          </div>
          {connextra.length > 0 && (
            <ul className="warnings">
              {connextra.map((c, i) => (
                <li key={i}>⚠ {c.message}</li>
              ))}
            </ul>
          )}
          <div className="inline-form">
            <label>
              Suurus{" "}
              <select value={size ?? ""} onChange={(e) => setSize((e.target.value || null) as StorySize | null)}>
                <option value="">–</option>
                {SIZES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <input type="checkbox" checked={isView} onChange={(e) => setIsView(e.target.checked)} /> Puudutab vaadet (mockup nõutav)
            </label>
          </div>
        </section>

        <section>
          <h3>Vastuvõtukriteeriumid</h3>
          <ol className="criteria-list">
            {criteria.map((c, i) => (
              <li key={c.id} className="crit" onMouseEnter={() => setHover(c.elementIds)} onMouseLeave={() => setHover([])}>
                <div className="inline-form">
                  <input value={c.text} onChange={(e) => setCriteria((all) => all.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} />
                  {c.elementIds.length > 0 && <span className="tag subtle">◫ {c.elementIds.join(", ")}</span>}
                  <button className="icon-btn" title="Üles" disabled={i === 0} onClick={() => setCriteria((all) => swap(all, i, i - 1))}>
                    ↑
                  </button>
                  <button className="icon-btn danger" title="Eemalda" onClick={() => setCriteria((all) => all.filter((_, k) => k !== i))}>
                    ✗
                  </button>
                </div>
                <CriterionWarnings text={c.text} />
              </li>
            ))}
          </ol>
          <button className="btn ghost small" onClick={() => setCriteria((all) => [...all, { id: newId(), text: "", elementIds: [] }])}>
            + Lisa kriteerium
          </button>
        </section>

        <div className="drawer-save">
          <button className="btn primary" disabled={!dirty} onClick={save}>
            Salvesta muudatused
          </button>
          {dirty && (
            <button className="btn ghost" onClick={() => { setRole(story.role); setAction(story.action); setBenefit(story.benefit); setSize(story.size); setIsView(story.isView); setCriteria(story.criteria); }}>
              Tühista
            </button>
          )}
        </div>

        <section>
          <h3>Staatus</h3>
          <div className="status-buttons">
            {STATUSES.map((s) => (
              <button key={s} className={`chip${story.status === s ? " selected" : ""}`} onClick={() => setStatus(s)} disabled={story.status === s}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="dor">
            <strong>Valmisoleku definitsioon {dor.ready ? "✓ täidetud" : "– puudu:"}</strong>
            <ul>
              {dor.items.map((i, k) => (
                <li key={k} className={i.ok ? "ok" : "missing"}>
                  {i.ok ? "✓" : "✗"} {i.label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h3>Avatud küsimused</h3>
          <ul className="questions">
            {story.openQuestions.map((q) => (
              <li key={q.id}>
                {q.text}
                <button className="icon-btn" title="Märgi vastatuks" onClick={() => setQuestions(story.openQuestions.filter((x) => x.id !== q.id))}>
                  ✓ vastatud
                </button>
              </li>
            ))}
            {story.openQuestions.length === 0 && <li className="muted">Avatud küsimusi pole.</li>}
          </ul>
          <div className="inline-form">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="nt Klient täpsustab maksevõimalused" />
            <button className="btn small" disabled={!question.trim()} onClick={() => setQuestions([...story.openQuestions, { id: newId(), text: question.trim() }]).then(() => setQuestion(""))}>
              Lisa küsimus
            </button>
            <button className="btn small warn" onClick={markNeedsClarification}>
              Märgi täpsustamist vajavaks
            </button>
          </div>
        </section>

        <section>
          <h3>Mockup</h3>
          {story.mockup ? (
            <>
              <MockupView spec={story.mockup.spec} highlight={hover} compact />
              <div className="versions">
                <span className="muted small">Versioonid:</span>
                {versions.map((v) => (
                  <button
                    key={v.id}
                    className={`chip small${v.isCurrent ? " selected" : ""}`}
                    title={`${v.note} · ${new Date(v.createdAt).toLocaleString("et-EE")}`}
                    disabled={v.isCurrent}
                    onClick={() => mutate(() => api.restoreMockup(pid, storyId, v.id))}
                  >
                    v{v.version}
                    {v.isCurrent ? " (praegune)" : " – taasta"}
                  </button>
                ))}
                <button className="btn ghost small" onClick={() => { showPrototype(storyId); onClose(); }}>
                  Ava prototüübi vaates
                </button>
              </div>
            </>
          ) : (
            <p className="muted">{isView ? "Mockup puudub." : "Lugu ei puuduta vaadet."}</p>
          )}
          <div className="ai-actions">
            <button className="btn small" disabled={busy || !state.ai.available} onClick={() => { run({ type: "propose_criteria", storyId }, `Paku kriteeriumid ja mockup loole ${story.code}`); onClose(); }}>
              ✨ Paku kriteeriumid ja mockup (AI)
            </button>
          </div>
          <div className="inline-form">
            <input value={refineText} onChange={(e) => setRefineText(e.target.value)} placeholder="Kliendi täpsustus selle loo kohta…" />
            <button
              className="btn small"
              disabled={busy || !refineText.trim() || !state.ai.available}
              onClick={() => {
                run({ type: "refine", storyId, text: refineText.trim() }, `Täpsustus loole ${story.code}: ${refineText.trim()}`);
                onClose();
              }}
            >
              ✨ Koosta muudatusettepanek
            </button>
          </div>
        </section>

        <section>
          <h3>Groomimine</h3>
          {splitting ? (
            <SplitEditor onDone={() => setSplitting(false)} storyId={storyId} />
          ) : (
            <div className="inline-form">
              <button className="btn small" onClick={() => setSplitting(true)}>
                Jaga väiksemateks lugudeks
              </button>
              <button className="btn small danger" onClick={remove}>
                Kustuta lugu
              </button>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function SplitEditor({ storyId, onDone }: { storyId: string; onDone: () => void }) {
  const { state, mutate } = useProject();
  const story = storyById(state, storyId)!;
  const [parts, setParts] = useState<Omit<StoryDraft, "criteria">[]>(() => {
    const pieces = story.action.split(/\s(?:ja|ning)\s|,\s/).filter((p) => p.trim().length > 2);
    const actions = pieces.length >= 2 ? pieces : [story.action, ""];
    return actions.map((a) => ({ role: story.role, action: a.trim(), benefit: story.benefit, size: "S" as const, isView: story.isView }));
  });
  // Iga kriteerium määratakse ühele uuele loole.
  const [assign, setAssign] = useState<number[]>(story.criteria.map((_, i) => i % Math.max(2, parts.length)));

  const submit = async () => {
    const drafts: StoryDraft[] = parts.map((p, i) => ({ ...p, criteria: story.criteria.filter((_, k) => assign[k] === i).map((c) => c.text) }));
    if (drafts.some((d) => !d.role.trim() || !d.action.trim() || !d.benefit.trim())) return alert("Igal uuel lool peab olema roll, tegevus ja kasu.");
    const ok = await mutate(() => api.split(state.project.id, storyId, drafts));
    if (ok) onDone();
  };

  return (
    <div className="split-editor">
      {parts.map((p, i) => (
        <div key={i} className="draft">
          <strong>Uus lugu {i + 1}</strong>
          <div className="grid-3">
            <label>
              Roll
              <input value={p.role} onChange={(e) => setParts((all) => all.map((x, k) => (k === i ? { ...x, role: e.target.value } : x)))} />
            </label>
            <label>
              Tegevus
              <input value={p.action} onChange={(e) => setParts((all) => all.map((x, k) => (k === i ? { ...x, action: e.target.value } : x)))} />
            </label>
            <label>
              Kasu
              <input value={p.benefit} onChange={(e) => setParts((all) => all.map((x, k) => (k === i ? { ...x, benefit: e.target.value } : x)))} />
            </label>
          </div>
        </div>
      ))}
      <button className="btn ghost small" onClick={() => setParts((all) => [...all, { role: story.role, action: "", benefit: story.benefit, size: "S", isView: story.isView }])}>
        + Veel üks lugu
      </button>
      {story.criteria.length > 0 && (
        <>
          <h5>Kriteeriumide jaotus</h5>
          <ul className="assign">
            {story.criteria.map((c, k) => (
              <li key={c.id}>
                <select value={assign[k]} onChange={(e) => setAssign((a) => a.map((x, j) => (j === k ? Number(e.target.value) : x)))}>
                  {parts.map((_, i) => (
                    <option key={i} value={i}>
                      Lugu {i + 1}
                    </option>
                  ))}
                </select>{" "}
                {c.text}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="card-actions">
        <button className="btn primary small" onClick={submit}>
          Jaga lugu
        </button>
        <button className="btn ghost small" onClick={onDone}>
          Loobu
        </button>
      </div>
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const copy = [...arr];
  [copy[a], copy[b]] = [copy[b], copy[a]];
  return copy;
}
