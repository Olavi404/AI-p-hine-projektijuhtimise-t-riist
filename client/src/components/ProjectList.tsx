import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api } from "../api.ts";
import type { ProjectSummary } from "../../../shared/types.ts";
import { STAGES, STAGE_LABELS } from "../../../shared/types.ts";

const EXAMPLES = [
  { name: "Spordiklubi veeb", description: "Treeningutega tutvumine ja liikmeks astumine veebis" },
  { name: "Autopesula broneerimine", description: "Pesuaja broneerimine ja pesupaketi valik" },
  { name: "Raamatukogu e-laenutus", description: "Raamatute otsing, broneerimine ja laenutuse pikendamine" },
];

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Claude API",
  "claude-code": "Claude Code · tellimus",
  mock: "Näidis-AI",
};

export function ProjectList({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<{ available: boolean; provider: string } | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api
      .listProjects()
      .then(setProjects)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setAi(d.ai))
      .catch(() => setAi(null));
  }, []);

  // "N" klahv avab uue projekti vormi.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        nameRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const state = await api.createProject(name.trim(), description.trim());
      onOpen(state.project.id);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  };

  const remove = async (p: ProjectSummary) => {
    if (!confirm(`Kustutada projekt „${p.name}“ koos backlog'i ja vestlusega?`)) return;
    await api.deleteProject(p.id).catch((e: Error) => setError(e.message));
    load();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? []).filter((p) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q));
  }, [projects, query]);

  const totalStories = (projects ?? []).reduce((n, p) => n + p.storyCount, 0);

  return (
    <div className="home">
      <header className="hero">
        <div className="hero-text">
          <div className="hero-logo" aria-hidden>
            ▲
          </div>
          <div>
            <h1>KickOff AI</h1>
            <p className="muted">Kliendi ideest kasutajalugude backlog'iks. AI juhib protsessi, inimene otsustab.</p>
          </div>
        </div>
        <div className="hero-side">
          {ai && (
            <span className={`ai-chip${ai.available ? " on" : " off"}`}>
              <span className="pulse" aria-hidden />
              {ai.available ? PROVIDER_LABEL[ai.provider] ?? ai.provider : "AI pole seadistatud"}
            </span>
          )}
          {projects && projects.length > 0 && (
            <span className="hero-stats">
              <b>{projects.length}</b> projekti · <b>{totalStories}</b> lugu
            </span>
          )}
        </div>
      </header>
      {ai && !ai.available && <p className="banner warn">AI teenus pole seadistatud. Backlog'i käsitsi haldus töötab; vaata README-st, kuidas AI ühendada.</p>}

      <div className="home-grid">
        <form className="panel new-project" onSubmit={create}>
          <div className="panel-head">
            <h2>Uus projekt</h2>
            <kbd title="Kiirklahv">N</kbd>
          </div>
          <label>
            Nimi
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="nt Spordiklubi veeb" required maxLength={200} />
          </label>
          <label>
            Lühikirjeldus
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Klient, eesmärk, tähtaeg…" maxLength={2000} />
          </label>
          <div className="examples">
            <span className="muted small">Kiirstart:</span>
            {EXAMPLES.map((x) => (
              <button
                type="button"
                key={x.name}
                className="chip small"
                onClick={() => {
                  setName(x.name);
                  setDescription(x.description);
                }}
              >
                {x.name}
              </button>
            ))}
          </div>
          <button className="btn primary big" type="submit" disabled={!name.trim() || creating}>
            {creating ? (
              <>
                <span className="spinner" /> Loon…
              </>
            ) : (
              "Loo projekt ja alusta →"
            )}
          </button>
          <ol className="how">
            <li>Kirjelda kliendi ideed ühe lausega</li>
            <li>Vasta AI täpsustavatele küsimustele</li>
            <li>Vali lood, kriteeriumid ja mockup'id</li>
          </ol>
        </form>

        <section className="projects">
          <div className="panel-head">
            <h2>Minu projektid</h2>
            {projects && projects.length > 3 && (
              <div className="search small-search">
                <span aria-hidden>⌕</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Otsi projekti…" aria-label="Otsi projekti" />
              </div>
            )}
          </div>
          {error && <p className="banner error">{error}</p>}
          {projects === null && (
            <div className="project-grid">
              {[0, 1].map((i) => (
                <div key={i} className="project-card skeleton" />
              ))}
            </div>
          )}
          {projects?.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">▲</div>
              <p>Projekte veel pole.</p>
              <p className="muted small">Loo esimene projekt vasakul või vali kiirstardi näide.</p>
            </div>
          )}
          <div className="project-grid">
            {filtered.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} onOpen={() => onOpen(p.id)} onDelete={() => remove(p)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProjectCard({ project: p, index, onOpen, onDelete }: { project: ProjectSummary; index: number; onOpen: () => void; onDelete: () => void }) {
  const stage = STAGES.indexOf(p.stage);
  return (
    <div className="project-card" style={{ animationDelay: `${index * 50}ms` }}>
      <button className="project-open" onClick={onOpen}>
        <span className="project-name">{p.name}</span>
        {p.description && <span className="project-desc">{p.description}</span>}
        <span className="stage-track" aria-label={`Etapp: ${STAGE_LABELS[p.stage]}`}>
          {STAGES.map((s, k) => (
            <span key={s} className={k < stage ? "done" : k === stage ? "now" : ""} title={STAGE_LABELS[s]} />
          ))}
        </span>
        <span className="project-meta">
          <span className="tag info">{STAGE_LABELS[p.stage]}</span>
          <span className="muted">{p.storyCount} lugu</span>
          <span className="muted">· {timeAgo(p.updatedAt)}</span>
        </span>
        <span className="open-arrow" aria-hidden>
          →
        </span>
      </button>
      <button className="icon-btn danger card-delete" title="Kustuta projekt" onClick={onDelete}>
        ✕
      </button>
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just praegu";
  if (s < 3600) return `${Math.floor(s / 60)} min tagasi`;
  if (s < 86400) return `${Math.floor(s / 3600)} h tagasi`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} p tagasi`;
  return new Date(iso).toLocaleDateString("et-EE");
}
