import type {
  VerificationDecision,
  VerificationSystemCondition,
} from "../../shared/verification.js";
import { evaluateClaimedVerification } from "./engine.js";
import {
  resolveVerificationPolicies,
  VERIFICATION_ENGINE_VERSION,
} from "./policy.js";
import {
  persistEngineCompletion,
  type ClaimedVerification,
} from "./repository.js";

export async function evaluateAndCompleteClaimedVerification(
  claim: ClaimedVerification,
): Promise<VerificationDecision | undefined> {
  const policies =
    claim.recordedVersions.engineVersion === VERIFICATION_ENGINE_VERSION
      ? resolveVerificationPolicies(claim.recordedVersions)
      : undefined;
  let systemConditions: readonly VerificationSystemCondition[] =
    policies ? [] : ["policy_configuration_unavailable"];

  for (let evaluation = 0; evaluation < 3; evaluation++) {
    const completion = evaluateClaimedVerification({
      attemptId: claim.attemptId,
      snapshot: claim.snapshot,
      recordedVersions: claim.recordedVersions,
      policies,
      systemConditions,
    });
    const persisted = await persistEngineCompletion(claim, completion);
    if (!persisted) return undefined;
    if (persisted.status === "reevaluation_required") {
      systemConditions = policies
        ? persisted.systemConditions
        : [
            ...persisted.systemConditions,
            "policy_configuration_unavailable",
          ];
      continue;
    }
    return persisted.decision;
  }
  return undefined;
}
