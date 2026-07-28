import { safeErrorMessage } from "../safeErrors.js";
import type { VerificationDecision } from "../../shared/verification.js";
import { coordinateVerificationDecision } from "./coordinator.js";
import { evaluateAndCompleteClaimedVerification } from "./orchestrator.js";
import { claimNextVerification } from "./repository.js";

export interface VerificationWorkResult {
  attemptId: string;
  decision: VerificationDecision;
  workflowResult: "applied" | "already_applied" | "stale";
}

export async function processNextVerificationCommand(): Promise<
  VerificationWorkResult | undefined
> {
  const claim = await claimNextVerification();
  if (!claim) return undefined;
  const decision = await evaluateAndCompleteClaimedVerification(claim);
  if (!decision) return undefined;
  const workflowResult = await coordinateVerificationDecision(claim.attemptId);
  return { attemptId: claim.attemptId, decision, workflowResult };
}

export async function drainVerificationCommands(
  limit = 25,
): Promise<VerificationWorkResult[]> {
  const results: VerificationWorkResult[] = [];
  for (let index = 0; index < limit; index++) {
    const result = await processNextVerificationCommand();
    if (!result) break;
    results.push(result);
  }
  return results;
}

export function startVerificationWorker(options?: {
  intervalMs?: number;
  onError?: (message: string) => void;
}): () => void {
  const intervalMs = options?.intervalMs ?? 1_000;
  let active = true;
  let working = false;
  const run = async () => {
    if (!active || working) return;
    working = true;
    try {
      await drainVerificationCommands();
    } catch (error) {
      options?.onError?.(safeErrorMessage(error));
    } finally {
      working = false;
    }
  };
  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  void run();
  return () => {
    active = false;
    clearInterval(timer);
  };
}
