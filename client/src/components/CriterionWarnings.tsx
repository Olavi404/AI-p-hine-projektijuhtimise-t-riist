import { checkCriterion } from "../../../shared/quality.ts";

/** Reeglipõhine hoiatus: hinnangulised sõnad või mitu tingimust ühes kriteeriumis. */
export function CriterionWarnings({ text }: { text: string }) {
  const issues = checkCriterion(text);
  if (issues.length === 0) return null;
  return (
    <ul className="warnings">
      {issues.map((i) => (
        <li key={i.code}>⚠ {i.message}</li>
      ))}
    </ul>
  );
}
