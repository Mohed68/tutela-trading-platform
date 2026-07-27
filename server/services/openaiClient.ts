import OpenAI from "openai";
import { isRecoveryMode } from "../recoveryMode";

let client: OpenAI | undefined;
let configuredKey: string | undefined;

export class OptionalIntegrationUnavailableError extends Error {
  constructor(integration: string) {
    super(`${integration} integration is not configured for this operation.`);
    this.name = "OptionalIntegrationUnavailableError";
  }
}

export function getOpenAIClient(
  environment: NodeJS.ProcessEnv = process.env,
): OpenAI {
  if (isRecoveryMode(environment)) {
    throw new OptionalIntegrationUnavailableError("OpenAI");
  }

  const apiKey = environment.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OptionalIntegrationUnavailableError("OpenAI");
  }

  if (!client || configuredKey !== apiKey) {
    client = new OpenAI({ apiKey });
    configuredKey = apiKey;
  }
  return client;
}
