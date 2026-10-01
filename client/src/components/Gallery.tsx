import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type GalleryData } from "../api.ts";
import { storyById, useProject } from "../state.tsx";
import type { MockupVersion, Story } from "../../../shared/types.ts";
import { STATUS_LABELS } from "../../../shared/types.ts";
import { storyTitle } from "../../../shared/quality.ts";
import { MockupView } from "./MockupView.tsx";

interface Tile {
  key: string;
  story: Story;
  version: MockupVersion;
  versions: MockupVersion[];
}

/** Kõigi projekti mockup'ide galerii: kaardid, suurendamine, versioonid ja eksport kausta. */
export function Gallery() {
  const { state, run, busy, openStory, showPrototype, notify } = useProject();
  const pid = state.project.id;
  const [data, setData] = useState<GalleryData | null>(null);
  const [query, setQuery] = useState("");
  const [allVersions, setAllVersions] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Laeb galerii uuesti, kui mõni lugu või mockup muutub.
  const signature = state.stories.map((s) => `${s.id}:${s.mockup?.id ?? ""}:${s.updatedAt}`).join("|");
  useEffect(() => {
    api
      .gallery(pid)
      .then(setData)
      .catch((e: Error) => notify(e.message, "error"));
  }, [pid, signature, notify]);

  const tiles = useMemo<Tile[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.items
      .filter(({ story }) => !q || `${story.code} ${storyTitle(story)}`.toLowerCase().includes(q))
      .flatMap(({ story, versions }) => {
        const shown = allVersions ? versions : versions.filter((v) => v.isCurrent).slice(0, 1);
        return shown.map((version) => ({ key: version.id, story, version, versions }));
      });
  }, [data, query, allVersions]);

  const missing = (data?.missingIds ?? []).map((id) => storyById(state, id)).filter((s): s is Story => !!s);

  const saveFolder = async () => {
    setSaving(true);
    try {
      const res = await api.exportGallery(pid);
      notify(`Galerii salvestatud kausta: ${res.dir} (${res.count} mockup'iga lugu)`);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gallery">
      <div className="toolbar">
        <div className="search">
          <span aria-hidden>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Otsi mockup'e…" aria-label="Otsi mockup'e" />
        </div>
        <label className="toggle">
          <input type="checkbox" checked={allVersions} onChange={(e) => setAllVersions(e.target.checked)} /> Kõik versioonid
        </label>
        <a className="btn small" href={`/api/projects/${pid}/export/gallery.html`} download title="Laadi galerii alla ühe HTML-failina">
          ⤓ HTML
        </a>
        <button className="btn small primary" onClick={saveFolder} disabled={saving || !data?.items.length} title="Salvesta galerii projekti kausta exports/">
          {saving ? <span className="spinner" /> : "▤"} Salvesta kausta
        </button>
      </div>

      {data === null && (
        <div className="gallery-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="g-card skeleton" />
          ))}
        </div>
      )}
      {data && data.items.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">◫</div>
          <p>Mockup'e veel pole.</p>
          <p className="muted small">Lase AI-l loole kriteeriumid ja mockup pakkuda või kirjelda prototüübi vahelehel uus vaade.</p>
        </div>
      )}

      <div className="gallery-grid">
        {tiles.map((t, i) => (
          <button key={t.key} className="g-card" onClick={() => setOpen(i)} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
            <div className="g-thumb">
              <MockupView spec={t.version.spec} compact />
            </div>
            <div className="g-info">
              <span className="g-title">
                <strong>{t.story.code}</strong> {t.version.spec.title}
              </span>
              <span className="tags">
                <span className={`tag status-${t.story.status}`}>{STATUS_LABELS[t.story.status]}</span>
                <span className={`tag ${t.version.isCurrent ? "info" : "subtle"}`}>v{t.version.version}{t.version.isCurrent ? " · praegune" : ""}</span>
                <span className="tag subtle">☑ {t.story.criteria.length}</span>
              </span>
            </div>
          </button>
        ))}
      </div>

      {missing.length > 0 && (
        <div className="g-missing">
          <h5>Vaadet puudutavad lood ilma mockup'ita ({missing.length})</h5>
          <ul>
            {missing.map((s) => (
              <li key={s.id}>
                <span className="story-title">
                  <strong>{s.code}</strong> {storyTitle(s)}
                </span>
                <button className="btn small" disabled={busy || !state.ai.available} onClick={() => run({ type: "propose_criteria", storyId: s.id }, `Paku kriteeriumid ja mockup loole ${s.code}`)}>
                  ✨ Loo mockup
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open !== null && tiles[open] && (
        <Lightbox
          tiles={tiles}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          onOpenStory={(id) => {
            setOpen(null);
            openStory(id);
          }}
          onPrototype={(id) => {
            setOpen(null);
            showPrototype(id);
          }}
        />
      )}
    </div>
  );
}

function Lightbox({
  tiles,
  index,
  onIndex,
  onClose,
  onOpenStory,
  onPrototype,
}: {
  tiles: Tile[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onOpenStory: (id: string) => void;
  onPrototype: (id: string) => void;
}) {
  const tile = tiles[index];
  const [versionId, setVersionId] = useState(tile.version.id);
  const [hover, setHover] = useState<string[]>([]);
  const [hoverEl, setHoverEl] = useState<string | null>(null);
  useEffect(() => setVersionId(tile.version.id), [tile.version.id]);
  const version = tile.versions.find((v) => v.id === versionId) ?? tile.version;

  const go = useCallback((d: number) => onIndex((index + d + tiles.length) % tiles.length), [index, tiles.length, onIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Mockup ${tile.story.code}`}>
        <header className="lb-head">
          <div>
            <span className="story-title">
              <strong>{tile.story.code}</strong> {storyTitle(tile.story)}
            </span>
            <div className="versions">
              {[...tile.versions].reverse().map((v) => (
                <button key={v.id} className={`chip small${v.id === version.id ? " selected" : ""}`} onClick={() => setVersionId(v.id)} title={v.note}>
                  v{v.version}
                  {v.isCurrent ? " · praegune" : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="lb-actions">
            <span className="muted small">
              {index + 1} / {tiles.length}
            </span>
            <button className="icon-btn" onClick={() => go(-1)} aria-label="Eelmine">
              ←
            </button>
            <button className="icon-btn" onClick={() => go(1)} aria-label="Järgmine">
              →
            </button>
            <button className="icon-btn" onClick={onClose} aria-label="Sulge">
              ✕
            </button>
          </div>
        </header>
        <div className="lb-body">
          <div className="lb-mockup">
            <MockupView spec={version.spec} highlight={hoverEl ? [hoverEl] : hover} onHover={setHoverEl} />
            {version.note && <p className="muted small">Versiooni märkus: {version.note}</p>}
          </div>
          <aside className="lb-side">
            <h5>Vastuvõtukriteeriumid</h5>
            <ol className="criteria-list">
              {tile.story.criteria.map((c) => (
                <li
                  key={c.id}
                  className={`crit${c.elementIds.length ? " linked" : ""}${hoverEl && c.elementIds.includes(hoverEl) ? " hl" : ""}`}
                  onMouseEnter={() => setHover(c.elementIds)}
                  onMouseLeave={() => setHover([])}
                >
                  <span className="crit-text">{c.text}</span>
                </li>
              ))}
              {tile.story.criteria.length === 0 && <li className="muted">Kriteeriume pole.</li>}
            </ol>
            <div className="preview-actions">
              <button className="btn small" onClick={() => onOpenStory(tile.story.id)}>
                ✎ Ava lugu
              </button>
              <button className="btn small" onClick={() => onPrototype(tile.story.id)}>
                ◫ Prototüüp
              </button>
            </div>
            <p className="muted small lb-hint">
              <kbd>←</kbd> <kbd>→</kbd> liigu · <kbd>Esc</kbd> sulge
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
