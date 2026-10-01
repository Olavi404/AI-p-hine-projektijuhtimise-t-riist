// Projekti vaate ühine olek: serveri seis, vestluse tegevused ja backlog'i muudatused.
import { createContext, useContext } from "react";
import type { ChatAction, ProjectState, Story } from "../../shared/types.ts";

export interface ProjectCtx {
  state: ProjectState;
  /** Juhitud vestluse tegevus (nupp või vabatekst). */
  run: (action: ChatAction, userEcho?: string) => Promise<void>;
  /** Backlog'i käsitsi muudatus; tagastab true kui õnnestus. */
  mutate: (fn: () => Promise<ProjectState>) => Promise<boolean>;
  busy: boolean;
  openStory: (id: string | null) => void;
  showPrototype: (storyId: string) => void;
  notify: (msg: string, kind?: "info" | "error") => void;
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
