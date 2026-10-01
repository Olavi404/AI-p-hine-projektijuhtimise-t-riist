import { useState } from "react";
import { storyById, useProject } from "../state.tsx";
import { storyTitle } from "../../../shared/quality.ts";
import { MockupView } from "./MockupView.tsx";
import { CriterionWarnings } from "./CriterionWarnings.tsx";

/** Kiire visuaalne prototüüpimine: vali backlog'ist lugu või kirjelda uus vaade. */
export function PrototypePanel({ storyId, onSelect }: { storyId: string | null; onSelect: (id: string) => void }) {
  const { state, run, busy, openStory } = useProject();
  const story = storyById(state, storyId) ?? null;
  const [hover, setHover] = useState<string[]>([]);
  const [viewText, setViewText] = useState("");
  const [refineText, setRefineText] = useState("");
  const aiOff = !state.ai.available;

  return (
    <div className="prototype">
      <div className="toolbar">
        <select value={story?.id ?? ""} onChange={(e) => onSelect(e.target.value)} aria-label="Vali lugu">
          <option value="" disabled>
            Vali backlog'ist lugu…
          </option>
          {state.stories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} {storyTitle(s).slice(0, 70)}
            </option>
          ))}
        </select>
        {story && (
          <button className="btn small ghost" onClick={() => openStory(story.id)}>
            Ava lugu
          </button>
        )}
      </div>

      {story ? (
        <>
          <p className="story-title">
            <strong>{story.code}</strong> {storyTitle(story)}
          </p>
          <div className="proto-grid">
            <div>
              {story.mockup ? (
                <>
                  <MockupView spec={story.mockup.spec} highlight={hover} />
                  <p className="muted small">
                    Mockup v{story.mockup.version} ({story.mockupVersionCount} versiooni) · {story.mockup.note}
                  </p>
                </>
              ) : (
                <p className="muted empty">Sellel lool pole veel mockup'i.</p>
              )}
              <button className="btn small" disabled={busy || aiOff} onClick={() => run({ type: "propose_criteria", storyId: story.id }, `Paku kriteeriumid ja mockup loole ${story.code}`)}>
                ✨ {story.mockup ? "Paku täiendatud mockup ja kriteeriumid" : "Paku mockup ja kriteeriumid"}
              </button>
            </div>
            <div>
              <h4>Vastuvõtukriteeriumid</h4>
              <p className="muted small">Osuta kriteeriumile – mockup'is tõstetakse esile vastav element.</p>
              <ol className="criteria-list">
                {story.criteria.map((c) => (
                  <li key={c.id} className={`crit${c.elementIds.length ? " linked" : ""}`} onMouseEnter={() => setHover(c.elementIds)} onMouseLeave={() => setHover([])}>
                    <span className="crit-text">{c.text}</span>
                    <CriterionWarnings text={c.text} />
                  </li>
                ))}
                {story.criteria.length === 0 && <li className="muted">Kriteeriume pole.</li>}
              </ol>
              <h4>Kliendi täpsustus</h4>
              <textarea value={refineText} onChange={(e) => setRefineText(e.target.value)} rows={2} placeholder="nt Paketi hinnas peab olema näha, kas see sisaldab käibemaksu" />
              <button
                className="btn small primary"
                disabled={busy || aiOff || !refineText.trim()}
                onClick={() => {
                  run({ type: "refine", storyId: story.id, text: refineText.trim() }, `Täpsustus loole ${story.code}: ${refineText.trim()}`);
                  setRefineText("");
                }}
              >
                ✨ Koosta muudatusettepanek (eelvaade vestluses)
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="muted empty">Vali lugu või kirjelda allpool uus vaade.</p>
      )}

      <div className="card wide new-view">
        <div className="card-label">Uus vaade promptist</div>
        <p className="muted small">AI loob korraga mockup'i, Connextra vormis loo ja vastuvõtukriteeriumid. Ettepanek ilmub vestlusesse kinnitamiseks.</p>
        <textarea value={viewText} onChange={(e) => setViewText(e.target.value)} rows={2} placeholder="nt Treeneri vaade, kus on tänased treeningud ja osalejate arv" />
        <button
          className="btn small primary"
          disabled={busy || aiOff || !viewText.trim()}
          onClick={() => {
            run({ type: "new_view", text: viewText.trim() }, `Uus vaade: ${viewText.trim()}`);
            setViewText("");
          }}
        >
          ✨ Loo vaade
        </button>
      </div>
    </div>
  );
}
