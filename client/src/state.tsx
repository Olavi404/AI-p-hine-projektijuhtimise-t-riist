// Projekti vaate ühine olek: serveri seis, vestluse tegevused ja backlog'i muudatused.
import { createContext, useContext } from "react";
import type { ChatAction, ProjectState, Story } from "../../shared/types.ts";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ProjectCtx {
  state: ProjectState;
  /** Juhitud vestluse tegevus (nupp või vabatekst). */
  run: (action: ChatAction, userEcho?: string) => Promise<void>;
  /** Backlog'i käsitsi muudatus; tagastab true kui õnnestus. */
  mutate: (fn: () => Promise<ProjectState>) => Promise<boolean>;
  undo: () => Promise<void>;
  busy: boolean;
  /** Pooleli olev vestluse tegevus (mõtlemise oleku tekstiks). */
  pendingAction: ChatAction | null;
  openStory: (id: string | null) => void;
  showPrototype: (storyId: string) => void;
  notify: (msg: string, kind?: "info" | "error", action?: ToastAction) => void;
}

export const Ctx = createContext<ProjectCtx | null>(null);

export function useProject(): ProjectCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("ProjectCtx puudub");
  return c;
}

export function storyById(state: ProjectState, id: string | null | undefined): Story | undefined {
  return id ? state.stories.find((s) => s.id === id) : undefined;
}

/** Kas klahvivajutus tuli tekstiväljast (siis kiirklahve ei käsitleta). */
export function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}
