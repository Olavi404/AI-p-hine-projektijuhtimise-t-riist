import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.ts";
import { Ctx, isTyping, type ProjectCtx, type ToastAction } from "../state.tsx";
import type { ChatAction, ProjectState } from "../../../shared/types.ts";
import { Stepper } from "./Stepper.tsx";
import { Chat } from "./Chat.tsx";
import { Backlog } from "./Backlog.tsx";
import { StoryDrawer } from "./StoryDrawer.tsx";
import { PrototypePanel } from "./PrototypePanel.tsx";
import { CommandPalette } from "./CommandPalette.tsx";
import { Gallery } from "./Gallery.tsx";

export type Tab = "backlog" | "prototype" | "gallery";

interface Toast {
  id: number;
  msg: string;
  kind: "info" | "error";
  action?: ToastAction;
}

export function ProjectView({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [state, setState] = useState<ProjectState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingEcho, setPendingEcho] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ChatAction | null>(null);
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("backlog");
  const [protoStoryId, setProtoStoryId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [palette, setPalette] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    api
      .getProject(projectId)
      .then(setState)
      .catch((e: Error) => setError(e.message));
  }, [projectId]);

  const notify = useCallback((msg: string, kind: "info" | "error" = "info", action?: ToastAction) => {
    setToast({ id: Date.now(), msg, kind, action });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), kind === "error" ? 7000 : action ? 6000 : 3500);
  }, []);

  const undo = useCallback(async () => {
    try {
      const res = await api.undo(projectId);
      setState(res);
      notify(`Tagasi võetud: ${res.undone}`);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  }, [projectId, notify]);

  const run = useCallback(
    async (action: ChatAction, userEcho?: string) => {
      setBusy(true);
      setResumed(true);
      setPendingEcho(userEcho ?? null);
      setPendingAction(action);
      try {
        setState(await api.chat(projectId, action));
      } catch (e) {
        notify((e as Error).message, "error");
      } finally {
        setBusy(false);
        setPendingEcho(null);
        setPendingAction(null);
      }
    },
    [projectId, notify],
  );

  const mutate = useCallback(
    async (fn: () => Promise<ProjectState>) => {
      try {
        const next = await fn();
        setState(next);
        notify(next.undo.label ? `Salvestatud: ${next.undo.label}` : "Salvestatud", "info", next.undo.available ? { label: "Võta tagasi", run: undo } : undefined);
        return true;
      } catch (e) {
        notify((e as Error).message, "error");
        return false;
      }
    },
    [notify, undo],
  );

  // Kiirklahvid: Ctrl+K käsupalett, Ctrl+Z tagasivõtmine, "/" vestluse sisestusväli.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (isTyping(e)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && state?.undo.available) {
        e.preventDefault();
        undo();
      } else if (e.key === "/" && !palette) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("focus-chat-input", { detail: "" }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, state?.undo.available, palette]);

  const showPrototype = useCallback((id: string) => {
    setProtoStoryId(id);
    setTab("prototype");
  }, []);

  const ctx: ProjectCtx | null = useMemo(
    () =>
      state && {
        state,
        run,
        mutate,
        undo,
        busy,
        pendingAction,
        openStory: setOpenStoryId,
        showPrototype,
        notify,
      },
    [state, run, mutate, undo, busy, pendingAction, showPrototype, notify],
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
  if (!ctx || !state) {
    return (
      <div className="loading">
        <span className="spinner" /> Laen projekti…
      </div>
    );
  }

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
            <button className="btn cmdk" onClick={() => setPalette(true)} title="Käsupalett">
              <span>Käsud</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button className="btn" onClick={undo} disabled={!state.undo.available} title={state.undo.label ? `Võta tagasi: ${state.undo.label} (Ctrl+Z)` : "Pole midagi tagasi võtta"}>
              ↶ Võta tagasi{state.undo.label ? `: ${shorten(state.undo.label, 30)}` : ""}
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
                Backlog <span className="count">{state.stories.length}</span>
              </button>
              <button className={tab === "prototype" ? "active" : ""} onClick={() => setTab("prototype")}>
                Prototüüp
              </button>
              <button className={tab === "gallery" ? "active" : ""} onClick={() => setTab("gallery")}>
                Galerii <span className="count">{state.stories.filter((s) => s.mockup).length}</span>
              </button>
            </nav>
            <div className="tab-body" key={tab}>
              {tab === "backlog" && <Backlog />}
              {tab === "prototype" && <PrototypePanel storyId={protoStoryId ?? state.project.focusStoryId} onSelect={setProtoStoryId} />}
              {tab === "gallery" && <Gallery />}
            </div>
          </section>
        </main>
        {openStoryId && state.stories.some((s) => s.id === openStoryId) && <StoryDrawer storyId={openStoryId} onClose={() => setOpenStoryId(null)} />}
        {palette && <CommandPalette onClose={() => setPalette(false)} onTab={setTab} />}
        {toast && (
          <div key={toast.id} className={`toast ${toast.kind}`} role="status">
            <span>{toast.msg}</span>
            {toast.action && (
              <button
                className="toast-action"
                onClick={() => {
                  toast.action!.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <span className="toast-timer" />
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

function shorten(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
