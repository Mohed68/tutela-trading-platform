import { safeErrorMessage } from "../safeErrors.js";
import { coordinateVerificationDecision } from "./coordinator.js";
import {
  evaluateVerification,
  policyUnavailableVerificationResult,
} from "./engine.js";
import {
  claimNextVerification,
  completeClaimedVerification,
} from "./repository.js";

export interface VerificationWorkResult {
  attemptId: string;
  decision: "approved" | "revision_required" | "manual_review";
  workflowResult: "applied" | "already_applied" | "stale";
}

export async function processNextVerificationCommand(): Promise<
  VerificationWorkResult | undefined
> {
  const claim = await claimNextVerification();
  if (!claim) return undefined;
  const result = claim.recordedVersionsAvailable
    ? evaluateVerification(claim.snapshot)
    : policyUnavailableVerificationResult(
        claim.snapshot,
        claim.recordedVersions,
      );
  const persistedDecision = await completeClaimedVerification(claim, result);
  if (!persistedDecision) return undefined;
  const workflowResult = await coordinateVerificationDecision(claim.attemptId);
  return {
    attemptId: claim.attemptId,
    decision: persistedDecision,
    workflowResult,
  };
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
