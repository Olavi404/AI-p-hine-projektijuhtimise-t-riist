import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { isTyping, useProject } from "../state.tsx";
import type { ChatAction, ChatMessage, NextStep } from "../../../shared/types.ts";
import { resumeText, stageSteps } from "../../../shared/steps.ts";
import { CardView } from "./cards/CardView.tsx";

export function Chat({ pendingEcho, showResume }: { pendingEcho: string | null; showResume: boolean }) {
  const { state, run, busy, pendingAction } = useProject();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Sõnumid, mis olid olemas juba vaate avamisel, kuvatakse kohe; uued AI sõnumid "trükitakse".
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(state.messages.map((m) => m.id));
  const messages = state.messages;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  useEffect(() => {
    for (const m of messages) seen.current!.add(m.id);
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  useEffect(() => {
    const focus = (e: Event) => {
      const hint = (e as CustomEvent<string>).detail;
      if (hint) setText(hint);
      inputRef.current?.focus();
    };
    window.addEventListener("focus-chat-input", focus);
    return () => window.removeEventListener("focus-chat-input", focus);
  }, []);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    await run({ type: "text", text: t }, t);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  const c = state.project.context;
  const placeholder = !c.idea
    ? "Kirjelda kliendi ideed, nt „Spordiklubi tahab veebi, kus saab treeningutega tutvuda ja liikmeks astuda.“"
    : c.questionIndex < c.questions.length
      ? "Vali vastus nuppudest või kirjuta oma vastus…"
      : state.project.stage === "refinements" || state.project.stage === "criteria"
        ? "Kirjuta kliendi täpsustus (nt „Hinnas peab olema näha, kas see sisaldab käibemaksu“) või küsi midagi…"
        : "Kirjuta vabalt – AI tõlgendab sinu soovi…";

  const showResumeBubble = showResume && messages.length > 1;
  const resumeSteps = stageSteps(state.project, state.stories);

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((m) => (
          <MessageView key={m.id} message={m} isLast={m.id === lastAssistant?.id && !showResumeBubble} fresh={m.role === "assistant" && !seen.current!.has(m.id)} />
        ))}
        {showResumeBubble && (
          <div className="msg assistant resume">
            <div className="bubble">
              <div className="msg-text">{resumeText(state.project, state.stories)}</div>
            </div>
            <NextSteps steps={resumeSteps} hotkeys />
          </div>
        )}
        {busy && pendingEcho && (
          <div className="msg user">
            <div className="bubble">{pendingEcho}</div>
          </div>
        )}
        {busy && <Thinking action={pendingAction} />}
        <div ref={endRef} />
      </div>
      <div className={`composer${busy ? " busy" : ""}`}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          rows={2}
          disabled={busy}
          aria-label="Sõnum"
        />
        <div className="composer-side">
          <button className="btn primary send" onClick={send} disabled={busy || !text.trim()} aria-label="Saada">
            Saada ↵
          </button>
          <span className="composer-hint">
            <kbd>/</kbd> fookus · <kbd>Ctrl K</kbd> käsud
          </span>
        </div>
      </div>
    </div>
  );
}

function MessageView({ message, isLast, fresh }: { message: ChatMessage; isLast: boolean; fresh: boolean }) {
  const [animate] = useState(fresh);
  const typed = useTyped(message.text, animate);
  return (
    <div className={`msg ${message.role}${message.isError ? " error" : ""}${animate ? " fresh" : ""}`}>
      <div className="bubble" onClick={typed.done ? undefined : typed.skip} title={typed.done ? undefined : "Klõpsa, et kuvada kohe"}>
        <div className="msg-text">
          {typed.shown}
          {!typed.done && <span className="caret" />}
        </div>
        {message.card && typed.done && (
          <div className={animate ? "reveal" : undefined}>
            <CardView card={message.card} active={isLast} />
          </div>
        )}
      </div>
      {isLast && typed.done && message.nextSteps.length > 0 && <NextSteps steps={message.nextSteps} hotkeys />}
    </div>
  );
}

/** Teksti järkjärguline kuvamine (u 1 s), klõpsuga saab kohe lõpuni näidata. */
function useTyped(text: string, active: boolean) {
  const [n, setN] = useState(active ? 0 : text.length);
  useEffect(() => {
    if (!active) return;
    const step = Math.max(1, Math.round(text.length / 55));
    const t = window.setInterval(() => {
      setN((x) => {
        const next = Math.min(text.length, x + step);
        if (next >= text.length) window.clearInterval(t);
        return next;
      });
    }, 18);
    return () => window.clearInterval(t);
  }, [text, active]);
  return { shown: text.slice(0, n), done: n >= text.length, skip: () => setN(text.length) };
}

const THINKING: Partial<Record<ChatAction["type"], string[]>> = {
  text: ["Loen sinu sõnumit", "Tõlgendan soovi", "Vaatan backlog'i seisu", "Valmistan vastust"],
  answer: ["Salvestan vastuse", "Analüüsin täpsustusi", "Koostan kasutajarolle"],
  skip_question: ["Liigun edasi", "Koostan kasutajarolle"],
  propose_roles: ["Analüüsin ideed", "Koostan kasutajarolle"],
  confirm_roles: ["Kaardistan põhitöövoogu", "Kirjutan kasutajalugusid", "Sean lood happy path'i järjekorda"],
  propose_stories: ["Kaardistan põhitöövoogu", "Kirjutan kasutajalugusid", "Sean lood happy path'i järjekorda"],
  add_stories: ["Lisan lood backlog'i", "Hindan, mis on kliendile kõige olulisem"],
  recommend_priority: ["Hindan lugude olulisust", "Põhjendan soovitust"],
  choose_focus: ["Sõnastan vastuvõtukriteeriume", "Joonistan vaate kavandit", "Kontrollin kriteeriumide kontrollitavust"],
  propose_criteria: ["Sõnastan vastuvõtukriteeriume", "Joonistan vaate kavandit", "Kontrollin kriteeriumide kontrollitavust"],
  next_story: ["Valin järgmise loo", "Sõnastan vastuvõtukriteeriume", "Joonistan vaate kavandit"],
  refine: ["Loen kliendi täpsustust", "Uuendan mockup'i", "Uuendan kriteeriume", "Kontrollin mõju teistele lugudele"],
  review: ["Loen kogu backlog'i", "Otsin liiga suuri lugusid", "Otsin kattuvusi", "Kontrollin kriteeriume ja mockup'e"],
  new_view: ["Joonistan uut vaadet", "Sõnastan kasutajalugu", "Sõnastan kriteeriume"],
};

function Thinking({ action }: { action: ChatAction | null }) {
  const steps = (action && THINKING[action.type]) ?? ["Töötlen"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 2200);
    return () => window.clearInterval(t);
  }, [steps.length]);
  return (
    <div className="msg assistant">
      <div className="bubble thinking">
        <span className="dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span key={i} className="thinking-text">
          {steps[i]}…
        </span>
        <span className="thinking-bar" aria-hidden />
      </div>
    </div>
  );
}

export function NextSteps({ steps, hotkeys }: { steps: NextStep[]; hotkeys?: boolean }) {
  const { run, busy } = useProject();

  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (busy || isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector(".drawer, .palette")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= steps.length) {
        e.preventDefault();
        run(steps[n - 1].action, steps[n - 1].label);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkeys, steps, run, busy]);

  return (
    <div className="next-steps" role="group" aria-label="Järgmine samm">
      {steps.map((s, i) => (
        <button key={i} className={`btn step-btn ${s.primary ? "primary" : ""}`} disabled={busy} onClick={() => run(s.action, s.label)} style={{ animationDelay: `${i * 60}ms` }}>
          {hotkeys && <kbd>{i + 1}</kbd>}
          {s.label}
        </button>
      ))}
    </div>
  );
}
