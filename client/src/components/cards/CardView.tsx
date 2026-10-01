import { useState } from "react";
import { storyById, useProject } from "../../state.tsx";
import type { ChatCard, ClarifyQuestion } from "../../../../shared/types.ts";
import { storyTitle } from "../../../../shared/quality.ts";
import { RolesCard, StoriesCard } from "./StoryCards.tsx";
import { CriteriaMockupCard, NewViewCard } from "./CriteriaCards.tsx";
import { ChangeCard } from "./ChangeCard.tsx";
import { ReviewCard } from "./ReviewCard.tsx";

export function CardView({ card, active }: { card: ChatCard; active: boolean }) {
  const { state } = useProject();
  switch (card.kind) {
    case "question":
      return <QuestionCard question={card.question} index={card.index} total={card.total} />;
    case "priority": {
      const s = storyById(state, card.storyId);
      return (
        <div className="card priority">
          <div className="card-label">AI soovitus</div>
          {s ? (
            <p>
              <strong>{s.code}</strong> {storyTitle(s)}
            </p>
          ) : (
            <p className="muted">Lugu on backlog'ist eemaldatud.</p>
          )}
          <p className="muted">Põhjendus: {card.reason}</p>
        </div>
      );
    }
    case "pick_story":
      return <PickStoryCard active={active} />;
    case "suggestion":
      return <SuggestionCard storyId={card.storyId} reason={card.reason} />;
    case "proposal": {
      const p = state.proposals.find((x) => x.id === card.proposalId);
      if (!p) return null;
      switch (p.payload.kind) {
        case "roles":
          return <RolesCard proposal={p} />;
        case "stories":
          return <StoriesCard proposal={p} />;
        case "criteria_mockup":
          return <CriteriaMockupCard proposal={p} />;
        case "change":
          return <ChangeCard proposal={p} />;
        case "review":
          return <ReviewCard proposal={p} />;
        case "new_view":
          return <NewViewCard proposal={p} />;
      }
    }
  }
  return null;
}

function QuestionCard({ question, index, total }: { question: ClarifyQuestion; index: number; total: number }) {
  const { state, run, busy } = useProject();
  const c = state.project.context;
  const active = c.questionIndex === index && c.questions[index]?.id === question.id;
  const answered = c.answers.find((a) => a.questionId === question.id);
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  const answer = (values: string[]) => run({ type: "answer", questionId: question.id, values }, values.join(", "));

  return (
    <div className={`card question${active ? "" : " done"}`}>
      <div className="card-label">
        Täpsustav küsimus {index + 1}/{total}
        {question.multi && " · mitmikvalik"}
      </div>
      <div className="options">
        {question.options.map((o) => (
          <button
            key={o}
            className={`chip${picked.includes(o) || answered?.answer.split(", ").includes(o) ? " selected" : ""}`}
            disabled={!active || busy}
            onClick={() => (question.multi ? toggle(o) : answer([o]))}
            aria-pressed={picked.includes(o)}
          >
            {question.multi && (picked.includes(o) ? "☑ " : "☐ ")}
            {o}
          </button>
        ))}
        <button
          className="chip ghost"
          disabled={!active || busy}
          onClick={() => window.dispatchEvent(new CustomEvent("focus-chat-input", { detail: "" }))}
        >
          Muu (kirjutan ise)
        </button>
        <button className="chip ghost" disabled={!active || busy} onClick={() => run({ type: "skip_question", questionId: question.id }, "Jäta vahele")}>
          Jäta vahele
        </button>
      </div>
      {question.multi && active && (
        <button className="btn primary small" disabled={picked.length === 0 || busy} onClick={() => answer(picked)}>
          Kinnita valik ({picked.length})
        </button>
      )}
      {!active && <div className="card-status">{answered ? `Vastus: ${answered.answer}` : "Vahele jäetud"}</div>}
    </div>
  );
}

function PickStoryCard({ active }: { active: boolean }) {
  const { state, run, busy } = useProject();
  return (
    <div className="card">
      <div className="card-label">Vali lugu</div>
      <ul className="pick-list">
        {state.stories.map((s) => (
          <li key={s.id}>
            <button className="pick" disabled={!active || busy} onClick={() => run({ type: "choose_focus", storyId: s.id, moveToTop: true }, `Alustame loost ${s.code}`)}>
              <strong>{s.code}</strong> {storyTitle(s)}
            </button>
          </li>
        ))}
      </ul>
      {active && <p className="muted small">Valitud lugu tõstetakse backlog'i algusesse (saad tagasi võtta).</p>}
    </div>
  );
}

function SuggestionCard({ storyId, reason }: { storyId: string; reason: string }) {
  const { state, run, busy } = useProject();
  const s = storyById(state, storyId);
  if (!s) return null;
  return (
    <div className="card suggestion">
      <div className="card-label">Mõjutab ka lugu {s.code} – eraldi ettepanek</div>
      <p>{storyTitle(s)}</p>
      <p className="muted">{reason}</p>
      <button className="btn small" disabled={busy} onClick={() => run({ type: "refine", storyId, text: reason }, `Koosta muudatusettepanek loole ${s.code}`)}>
        Koosta muudatusettepanek loole {s.code}
      </button>
    </div>
  );
}
