import { useProject } from "../state.tsx";
import { STAGES, STAGE_LABELS, type Stage } from "../../../shared/types.ts";

const STAGE_TIPS: Record<Stage, string> = {
  idea: "Kliendi idee ühe lausena ja täpsustavad küsimused",
  roles: "Kes rakendust kasutavad",
  stories: "Kasutajalood põhitöövoo järjekorras",
  priorities: "Millest alustada ja lugude järjekord",
  criteria: "Vastuvõtukriteeriumid ja vaate kavand",
  refinements: "Kliendi täpsustused eelvaatega",
  grooming: "Backlog'i ülevaatus: jagamine, ühendamine, DoR",
};

/** Protsessi sammude riba. Etappe saab vahele jätta ja varasemate juurde tagasi minna. */
export function Stepper() {
  const { state, run, busy } = useProject();
  const current = STAGES.indexOf(state.project.stage);
  const pct = (current / (STAGES.length - 1)) * 100;
  return (
    <div className="stepper-wrap">
      <ol className="stepper" aria-label="Protsessi etapid">
        {STAGES.map((stage, i) => (
          <li key={stage} className={i === current ? "current" : i < current ? "done" : ""}>
            <button
              disabled={busy || i === current}
              onClick={() => run({ type: "goto_stage", stage }, `Liigu etappi „${STAGE_LABELS[stage]}“`)}
              data-tip={STAGE_TIPS[stage]}
              aria-current={i === current ? "step" : undefined}
            >
              <span className="step-no">{i + 1}</span>
              {STAGE_LABELS[stage]}
            </button>
          </li>
        ))}
      </ol>
      <div className="stepper-progress" aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
