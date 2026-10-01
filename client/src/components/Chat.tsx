import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useProject } from "../state.tsx";
import type { ChatMessage, NextStep } from "../../../shared/types.ts";
import { resumeText, stageSteps } from "../../../shared/steps.ts";
import { CardView } from "./cards/CardView.tsx";

export function Chat({ pendingEcho, showResume }: { pendingEcho: string | null; showResume: boolean }) {
  const { state, run, busy } = useProject();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = state.messages;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  // "Muu (kirjutan ise)" ja muud kohad saavad sisestusvälja fookusesse panna.
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

  const resumeSteps = stageSteps(state.project, state.stories);
  const showResumeBubble = showResume && messages.length > 1;

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((m) => (
          <MessageView key={m.id} message={m} isLast={m.id === lastAssistant?.id && !showResumeBubble} />
        ))}
        {showResumeBubble && (
          <div className="msg assistant resume">
            <div className="bubble">
              <div className="msg-text">{resumeText(state.project, state.stories)}</div>
            </div>
            <NextSteps steps={resumeSteps} />
          </div>
        )}
        {busy && pendingEcho && (
          <div className="msg user">
            <div className="bubble">{pendingEcho}</div>
          </div>
        )}
        {busy && (
          <div className="msg assistant">
            <div className="bubble thinking">
              <span className="dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              AI mõtleb…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="composer">
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
        <button className="btn primary" onClick={send} disabled={busy || !text.trim()}>
          Saada
        </button>
      </div>
    </div>
  );
}

function MessageView({ message, isLast }: { message: ChatMessage; isLast: boolean }) {
  return (
    <div className={`msg ${message.role}${message.isError ? " error" : ""}`}>
      <div className="bubble">
        <div className="msg-text">{message.text}</div>
        {message.card && <CardView card={message.card} active={isLast} />}
      </div>
      {isLast && message.nextSteps.length > 0 && <NextSteps steps={message.nextSteps} />}
    </div>
  );
}

export function NextSteps({ steps }: { steps: NextStep[] }) {
  const { run, busy } = useProject();
  return (
    <div className="next-steps" role="group" aria-label="Järgmine samm">
      {steps.map((s, i) => (
        <button key={i} className={`btn ${s.primary ? "primary" : ""}`} disabled={busy} onClick={() => run(s.action, s.label)}>
          {s.label}
        </button>
      ))}
    </div>
  );
}
