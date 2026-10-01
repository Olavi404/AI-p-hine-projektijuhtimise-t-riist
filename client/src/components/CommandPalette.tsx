import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useProject } from "../state.tsx";
import { STAGES, STAGE_LABELS } from "../../../shared/types.ts";
import { stageSteps } from "../../../shared/steps.ts";
import { storyTitle } from "../../../shared/quality.ts";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** Käsupalett (Ctrl+K): kõik peamised tegevused klaviatuurilt. */
export function CommandPalette({ onClose, onTab }: { onClose: () => void; onTab: (t: "backlog" | "prototype") => void }) {
  const { state, run, undo, openStory, showPrototype, busy } = useProject();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (!busy) {
      stageSteps(state.project, state.stories).forEach((s, i) =>
        list.push({ id: `step${i}`, group: "Soovitatud", label: s.label, hint: s.primary ? "AI soovitus" : undefined, run: () => run(s.action, s.label) }),
      );
      if (state.stories.length && state.ai.available) list.push({ id: "review", group: "AI", label: "Vaata backlog üle", run: () => run({ type: "review" }, "Vaata backlog üle") });
    }
    if (state.undo.available) list.push({ id: "undo", group: "Backlog", label: `Võta tagasi: ${state.undo.label}`, hint: "Ctrl Z", run: () => void undo() });
    list.push({ id: "tab-b", group: "Vaade", label: "Ava backlog", run: () => onTab("backlog") });
    list.push({ id: "tab-p", group: "Vaade", label: "Ava prototüüp", run: () => onTab("prototype") });
    list.push({ id: "chat", group: "Vaade", label: "Kirjuta vestlusesse", hint: "/", run: () => window.dispatchEvent(new CustomEvent("focus-chat-input", { detail: "" })) });
    for (const s of state.stories) {
      list.push({ id: `open-${s.id}`, group: "Lood", label: `${s.code} ${storyTitle(s)}`, run: () => openStory(s.id) });
      if (s.mockup) list.push({ id: `proto-${s.id}`, group: "Mockup'id", label: `${s.code} mockup: ${s.mockup.spec.title}`, run: () => showPrototype(s.id) });
    }
    if (!busy) {
      for (const st of STAGES) {
        if (st !== state.project.stage) list.push({ id: `stage-${st}`, group: "Etapid", label: `Liigu etappi „${STAGE_LABELS[st]}“`, run: () => run({ type: "goto_stage", stage: st }, `Liigu etappi „${STAGE_LABELS[st]}“`) });
      }
    }
    list.push({ id: "md", group: "Eksport", label: "Ekspordi Markdown", run: () => window.open(`/api/projects/${state.project.id}/export.md`) });
    list.push({ id: "csv", group: "Eksport", label: "Ekspordi CSV", run: () => window.open(`/api/projects/${state.project.id}/export.csv`) });
    list.push({ id: "home", group: "Vaade", label: "Projektide loend", run: () => (window.location.hash = "#/") });
    return list;
  }, [state, busy, run, undo, openStory, showPrototype, onTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const words = q.split(/\s+/);
    return commands.filter((c) => words.every((w) => `${c.group} ${c.label}`.toLowerCase().includes(w)));
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const exec = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    c.run();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      exec(filtered[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Käsupalett">
        <div className="palette-input">
          <span className="palette-icon">⌘</span>
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder="Otsi tegevust, lugu või etappi…" />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette-list" ref={listRef}>
          {filtered.length === 0 && <li className="palette-empty">Midagi ei leitud</li>}
          {filtered.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <li key={c.id}>
                {header && <div className="palette-group">{header}</div>}
                <button className={`palette-item${i === active ? " active" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => exec(c)}>
                  <span>{c.label}</span>
                  {c.hint && <span className="palette-hint">{c.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="palette-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> liigu
          </span>
          <span>
            <kbd>Enter</kbd> vali
          </span>
          <span>
            <kbd>1–4</kbd> järgmine samm vestluses
          </span>
        </div>
      </div>
    </div>
  );
}
