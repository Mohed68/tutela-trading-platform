import { createHash } from "node:crypto";
import { canonicalizeWorkflowValue } from "./workflowCanonicalization.js";

export function fingerprintWorkflowValue(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonicalizeWorkflowValue(value))
    .digest("hex")}`;
}
