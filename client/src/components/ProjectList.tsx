import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api.ts";
import type { ProjectSummary } from "../../../shared/types.ts";
import { STAGE_LABELS } from "../../../shared/types.ts";

export function ProjectList({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<{ available: boolean; provider: string } | null>(null);

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

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const state = await api.createProject(name.trim(), description.trim());
      onOpen(state.project.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (p: ProjectSummary) => {
    if (!confirm(`Kustutada projekt „${p.name}“ koos backlog'i ja vestlusega?`)) return;
    await api.deleteProject(p.id).catch((e: Error) => setError(e.message));
    load();
  };

  return (
    <div className="home">
      <header className="home-header">
        <h1>AI projektijuht</h1>
        <p className="muted">Kliendi ideest kasutajalugude backlog'iks: AI juhib protsessi, inimene otsustab.</p>
        {ai && !ai.available && <p className="banner warn">AI teenus pole seadistatud (ANTHROPIC_API_KEY puudub). Backlog'i käsitsi haldus töötab.</p>}
        {ai?.provider === "mock" && <p className="banner info">Näidis-AI režiim (AI_PROVIDER=mock): vastused on etteantud näited.</p>}
      </header>

      <div className="home-grid">
        <form className="panel new-project" onSubmit={create}>
          <h2>Uus projekt</h2>
          <label>
            Nimi
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="nt Spordiklubi veeb" required maxLength={200} />
          </label>
          <label>
            Lühikirjeldus
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Klient, eesmärk, tähtaeg…" maxLength={2000} />
          </label>
          <button className="btn primary" type="submit" disabled={!name.trim()}>
            Loo projekt ja alusta
          </button>
        </form>

        <section className="panel">
          <h2>Minu projektid</h2>
          {error && <p className="banner error">{error}</p>}
          {projects === null && <p className="muted">Laen…</p>}
          {projects?.length === 0 && <p className="muted">Projekte veel pole. Loo esimene vasakul.</p>}
          <ul className="project-list">
            {projects?.map((p) => (
              <li key={p.id}>
                <button className="project-item" onClick={() => onOpen(p.id)}>
                  <strong>{p.name}</strong>
                  {p.description && <span className="muted">{p.description}</span>}
                  <span className="tags">
                    <span className="tag">{STAGE_LABELS[p.stage]}</span>
                    <span className="tag">{p.storyCount} lugu</span>
                    <span className="tag subtle">{new Date(p.updatedAt).toLocaleString("et-EE")}</span>
                  </span>
                </button>
                <button className="btn ghost small" title="Kustuta projekt" onClick={() => remove(p)}>
                  Kustuta
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
