// AI teenuse pakkujad. Kõik AI päringud käivad läbi serveri; võti loetakse ainult keskkonnamuutujast.
// Iga vastus kontrollitakse zod-skeemiga ja sisuliste reeglitega; vigase vastuse korral proovitakse uuesti.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export type StepName =
  | "clarify"
  | "roles"
  | "stories"
  | "priority"
  | "criteria_mockup"
  | "refine"
  | "review"
  | "new_view"
  | "interpret";

export interface AiTask<T> {
  step: StepName;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  /** Sisulised vead, mille korral vastust ei tohi kasutada (proovitakse uuesti, lõpuks veateade). */
  validate?: (out: T) => string[];
  /** Kvaliteediprobleemid, mille korral proovitakse uuesti, kuid viimasel katsel vastus aktsepteeritakse. */
  soft?: (out: T) => string[];
  /** Näidisvastus mock-režiimi jaoks. */
  mock: () => T;
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly retryable = true,
  ) {
    super(message);
  }
}

export interface AiProvider {
  readonly name: string;
  readonly available: boolean;
  generate<T>(task: AiTask<T>): Promise<T>;
}

const MAX_ATTEMPTS = 3;

export function createProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  if ((env.AI_PROVIDER ?? "anthropic").toLowerCase() === "mock") return new MockProvider();
  return new AnthropicProvider(env);
}

class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;
  private model: string;
  private effort: "low" | "medium" | "high";
  private useStructuredOutput = true;
  private useFallbacks: boolean;

  constructor(env: NodeJS.ProcessEnv) {
    this.model = env.AI_MODEL || "claude-opus-5-5";
    const effort = (env.AI_EFFORT || "medium").toLowerCase();
    this.effort = effort === "low" || effort === "high" ? effort : "medium";
    this.useFallbacks = (env.AI_FALLBACKS ?? "default") !== "off";
    if (env.ANTHROPIC_API_KEY) this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });
  }

  get available(): boolean {
    return this.client !== null;
  }

  async generate<T>(task: AiTask<T>): Promise<T> {
    if (!this.client) {
      throw new AiError("AI teenus pole seadistatud (ANTHROPIC_API_KEY puudub). Backlog'i saab hallata käsitsi.", false);
    }
    let feedback = "";
    let lastProblem = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const text = await this.request(task, feedback);
      const result = parseAndValidate(task, text, attempt === MAX_ATTEMPTS);
      if (result.ok) return result.value;
      lastProblem = result.problems.join("; ");
      console.warn(`[ai] ${task.step}: vastus ei läbinud kontrolli (katse ${attempt}): ${lastProblem}`);
      feedback =
        `\n\nSinu eelmine vastus ei läbinud serveri kontrolli. Paranda need probleemid ja vasta uuesti kogu JSON-iga:\n- ` +
        result.problems.join("\n- ") +
        `\n\nEelmine vastus:\n${text.slice(0, 6000)}`;
    }
    throw new AiError(`AI vastus ei vastanud oodatud vormile ka pärast ${MAX_ATTEMPTS} katset. Proovi uuesti. (${lastProblem.slice(0, 200)})`);
  }

  private async request<T>(task: AiTask<T>, feedback: string): Promise<string> {
    const client = this.client!;
    const format = zodOutputFormat(task.schema as z.ZodType<T>);
    const schemaHint = this.useStructuredOutput
      ? ""
      : `\n\nVasta AINULT ühe JSON-objektiga (ilma markdownita), mis vastab sellele JSON-skeemile:\n${JSON.stringify(format.schema)}`;
    try {
      const response = await client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        system: task.system,
        messages: [{ role: "user", content: task.user + schemaHint + feedback }],
        output_config: {
          effort: this.effort,
          ...(this.useStructuredOutput ? { format: { type: "json_schema" as const, schema: format.schema } } : {}),
        },
        ...(this.useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      if (response.stop_reason === "refusal") {
        throw new AiError("AI keeldus sellele päringule vastamast. Sõnasta soov ümber või jätka käsitsi.", false);
      }
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("");
      if (response.stop_reason === "max_tokens") {
        return text + "\n[VASTUS KATKES: liiga pikk]";
      }
      return text;
    } catch (err) {
      if (err instanceof AiError) throw err;
      if (err instanceof Anthropic.AuthenticationError) {
        throw new AiError("AI teenuse võti on vigane. Kontrolli ANTHROPIC_API_KEY väärtust.", false);
      }
      if (err instanceof Anthropic.BadRequestError) {
        const msg = String(err.message);
        // Kui konto ei toeta varumudelit või struktureeritud väljundit, jätkame ilma nendeta.
        if (this.useFallbacks && /fallback/i.test(msg)) {
          this.useFallbacks = false;
          return this.request(task, feedback);
        }
        if (this.useStructuredOutput && /(output_config|format|schema)/i.test(msg)) {
          console.warn("[ai] struktureeritud väljund lükati tagasi, jätkan skeemi juhisega:", msg);
          this.useStructuredOutput = false;
          return this.request(task, feedback);
        }
        throw new AiError(`AI päring lükati tagasi: ${msg.slice(0, 200)}`, false);
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new AiError("AI teenus on hetkel ülekoormatud (päringute limiit). Proovi hetke pärast uuesti.");
      }
      if (err instanceof Anthropic.APIConnectionError) {
        throw new AiError("AI teenusega ei saanud ühendust. Kontrolli internetiühendust ja proovi uuesti.");
      }
      if (err instanceof Anthropic.APIError) {
        throw new AiError(`AI teenus vastas veaga (${err.status}). Proovi uuesti.`);
      }
      throw err;
    }
  }
}

/** Parsib ja kontrollib vastuse. Eraldi funktsioon, et seda saaks testida ilma võrguta. */
export function parseAndValidate<T>(
  task: Pick<AiTask<T>, "schema" | "validate" | "soft">,
  text: string,
  lastAttempt: boolean,
): { ok: true; value: T } | { ok: false; problems: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(text));
  } catch {
    return { ok: false, problems: ["Vastus ei olnud korrektne JSON."] };
  }
  const parsed = task.schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(juur)"}: ${i.message}`),
    };
  }
  const hard = task.validate?.(parsed.data) ?? [];
  if (hard.length > 0) return { ok: false, problems: hard };
  const soft = task.soft?.(parsed.data) ?? [];
  if (soft.length > 0 && !lastAttempt) return { ok: false, problems: soft };
  return { ok: true, value: parsed.data };
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

/** Testimiseks ja demoks ilma API võtmeta: tagastab etteantud näidisvastused, mis läbivad sama kontrolli. */
class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly available = true;

  async generate<T>(task: AiTask<T>): Promise<T> {
    await new Promise((r) => setTimeout(r, 250));
    const result = parseAndValidate(task, JSON.stringify(task.mock()), true);
    if (!result.ok) throw new AiError(`Mock-vastus ei läbinud kontrolli: ${result.problems.join("; ")}`);
    return result.value;
  }
}
