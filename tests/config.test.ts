import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../server/config.ts";

test("defaults to local host without a secret", () => {
  const config = parseConfig({});
  assert.equal(config.API_HOST, "127.0.0.1");
  assert.equal(config.ANTHROPIC_API_KEY, undefined);
});
test("rejects invalid provider and port without echoing secrets", () => {
  assert.throws(() => parseConfig({ AI_PROVIDER: "invalid", ANTHROPIC_API_KEY: "example-secret" }), e => e instanceof Error && !e.message.includes("example-secret"));
  assert.throws(() => parseConfig({ API_PORT: "99999" }));
});
test("mock can bind externally; real provider cannot", () => {
  assert.equal(parseConfig({ AI_PROVIDER: "mock", API_HOST: "0.0.0.0" }).API_HOST, "0.0.0.0");
  assert.throws(() => parseConfig({ AI_PROVIDER: "anthropic", API_HOST: "0.0.0.0" }));
  assert.throws(() => parseConfig({ AI_PROVIDER: "claude-code", API_HOST: "0.0.0.0" }));
});
