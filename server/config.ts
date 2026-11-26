import { z } from "zod";

const schema = z.object({
  AI_PROVIDER: z.enum(["anthropic", "claude-code", "mock"]).default("anthropic"),
  AI_EFFORT: z.enum(["low", "medium", "high"]).default("medium"),
  ANTHROPIC_API_KEY: z.string().optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_HOST: z.string().min(1).default("127.0.0.1"),
});

export function parseConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error("Invalid environment settings: " + result.error.issues.map(i => i.path.join(".")).join(", "));
  }
  const cfg = result.data;
  if (cfg.AI_PROVIDER !== "mock" && !["127.0.0.1", "::1", "localhost"].includes(cfg.API_HOST)) {
    throw new Error("Real AI providers must listen locally until authentication and rate limits are implemented.");
  }
  return cfg;
}
