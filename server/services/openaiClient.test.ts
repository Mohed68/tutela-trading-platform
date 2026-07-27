import assert from "node:assert/strict";
import test from "node:test";
import {
  OptionalIntegrationUnavailableError,
  getOpenAIClient,
} from "./openaiClient.js";

test("OpenAI is optional during core startup", () => {
  assert.throws(
    () => getOpenAIClient({ NODE_ENV: "development" }),
    OptionalIntegrationUnavailableError,
  );
});

test("OpenAI is disabled during controlled recovery even with a key", () => {
  assert.throws(
    () =>
      getOpenAIClient({
        NODE_ENV: "development",
        TUTELA_RECOVERY_MODE: "true",
        OPENAI_API_KEY: "test-key-never-used",
      }),
    OptionalIntegrationUnavailableError,
  );
});
