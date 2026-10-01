import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.ts";
import { Ctx, type ProjectCtx } from "../state.tsx";
import type { ChatAction, ProjectState } from "../../../shared/types.ts";
import { Stepper } from "./Stepper.tsx";
import { Chat } from "./Chat.tsx";
import { Backlog } from "./Backlog.tsx";
import { StoryDrawer } from "./StoryDrawer.tsx";
import { PrototypePanel } from "./PrototypePanel.tsx";

type Tab = "backlog" | "prototype";

export function ProjectView({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [state, setState] = useState<ProjectState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingEcho, setPendingEcho] = useState<string | null>(null);
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("backlog");
  const [protoStoryId, setProtoStoryId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "info" | "error" } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    api
      .getProject(projectId)
      .then(setState)
      .catch((e: Error) => setError(e.message));
  }, [projectId]);

  const notify = useCallback((msg: string, kind: "info" | "error" = "info") => {
    setToast({ msg, kind });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), kind === "error" ? 7000 : 3500);
  }, []);

  const run = useCallback(
    async (action: ChatAction, userEcho?: string) => {
      setBusy(true);
      setResumed(true);
      setPendingEcho(userEcho ?? null);
      try {
        setState(await api.chat(projectId, action));
      } catch (e) {
        notify((e as Error).message, "error");
      } finally {
        setBusy(false);
        setPendingEcho(null);
      }
    },
    [projectId, notify],
  );

  const mutate = useCallback(
    async (fn: () => Promise<ProjectState>) => {
      try {
        setState(await fn());
        return true;
      } catch (e) {
        notify((e as Error).message, "error");
        return false;
      }
    },
    [notify],
  );

  const ctx: ProjectCtx | null = useMemo(
    () =>
      state && {
        state,
        run,
        mutate,
        busy,
        openStory: setOpenStoryId,
        showPrototype: (id: string) => {
          setProtoStoryId(id);
          setTab("prototype");
        },
        notify,
      },
    [state, run, mutate, busy, notify],
  );

  if (error) {
    return (
      <div className="home">
        <p className="banner error">{error}</p>
        <button className="btn" onClick={onClose}>
          ← Projektid
        </button>
      </div>
    );
  }
  if (!ctx || !state) return <div className="loading">Laen projekti…</div>;

  const undo = async () => {
    try {
      const res = await api.undo(projectId);
      setState(res);
      notify(`Tagasi võetud: ${res.undone}`);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  };

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <header className="topbar">
          <button className="btn ghost" onClick={onClose} title="Tagasi projektide loendisse">
            ← Projektid
          </button>
          <div className="topbar-title">
            <h1>{state.project.name}</h1>
            {state.project.description && <span className="muted">{state.project.description}</span>}
          </div>
          <div className="topbar-actions">
            {!state.ai.available && <span className="tag warn">AI pole seadistatud</span>}
            {state.ai.provider === "mock" && <span className="tag info">Näidis-AI</span>}
            <button className="btn" onClick={undo} disabled={!state.undo.available} title={state.undo.label ? `Võta tagasi: ${state.undo.label}` : "Pole midagi tagasi võtta"}>
              ↶ Võta tagasi{state.undo.label ? `: ${shorten(state.undo.label, 36)}` : ""}
            </button>
            <a className="btn ghost" href={`/api/projects/${projectId}/export.md`} download>
              Markdown
            </a>
            <a className="btn ghost" href={`/api/projects/${projectId}/export.csv`} download>
              CSV
            </a>
          </div>
        </header>
        <Stepper />
        <main className="workspace">
          <section className="chat-col">
            <Chat pendingEcho={pendingEcho} showResume={!resumed} />
          </section>
          <section className="side-col">
            <nav className="tabs">
              <button className={tab === "backlog" ? "active" : ""} onClick={() => setTab("backlog")}>
                Backlog ({state.stories.length})
              </button>
              <button className={tab === "prototype" ? "active" : ""} onClick={() => setTab("prototype")}>
                Prototüüp
              </button>
            </nav>
            {tab === "backlog" ? <Backlog /> : <PrototypePanel storyId={protoStoryId ?? state.project.focusStoryId} onSelect={setProtoStoryId} />}
          </section>
        </main>
        {openStoryId && state.stories.some((s) => s.id === openStoryId) && <StoryDrawer storyId={openStoryId} onClose={() => setOpenStoryId(null)} />}
        {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
      </div>
    </Ctx.Provider>
  );
}

function shorten(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
