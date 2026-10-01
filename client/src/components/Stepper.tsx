import { useProject } from "../state.tsx";
import { STAGES, STAGE_LABELS } from "../../../shared/types.ts";

/** Protsessi sammude riba. Etappe saab vahele jätta ja varasemate juurde tagasi minna. */
export function Stepper() {
  const { state, run, busy } = useProject();
  const current = STAGES.indexOf(state.project.stage);
  return (
    <ol className="stepper" aria-label="Protsessi etapid">
      {STAGES.map((stage, i) => (
        <li key={stage} className={i === current ? "current" : i < current ? "done" : ""}>
          <button
            disabled={busy || i === current}
            onClick={() => run({ type: "goto_stage", stage }, `Liigu etappi „${STAGE_LABELS[stage]}“`)}
            title={i === current ? "Praegune etapp" : `Liigu etappi „${STAGE_LABELS[stage]}“`}
          >
            <span className="step-no">{i + 1}</span>
            {STAGE_LABELS[stage]}
          </button>
        </li>
      ))}
    </ol>
  );
}
