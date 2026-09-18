import type { QueryResultRow } from "pg";
interface QueryPort { query<T extends QueryResultRow>(sql:string,values:unknown[]):Promise<{rows:T[]}> }

// The VRE decision writer holds this same scoped lock. Acquire in stable order
// and recheck inside the command transaction, through the final durable write.
export async function lockAndRequireTradeMutation(db: QueryPort, action: TradeMutationAction, subjects: readonly EnforcementSubject[]): Promise<void> {
  const keys=[...new Set(subjects.map(subject=>`vre-enforcement:${subject.scope}:${subject.subjectId}`))].sort();
  for(const key of keys) await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[key]);
  if(!await createEnforcementGuard(db).allows(action,subjects)) throw new EnforcementDeniedError();
}

export const TRADE_MUTATION_ACTIONS = [
  "offer.create", "offer.edit", "offer.submit",
  "order.create", "order.accept", "contract.create",
  "contract.prepare", "contract.approve", "contract.sign",
  "contract.execute", "contract.evidence", "contract.delivery",
  "contract.settlement", "contract.close", "contract.dispute",
] as const;
export type TradeMutationAction = typeof TRADE_MUTATION_ACTIONS[number];
export type EnforcementSubject = Readonly<{ scope: "USER" | "ORGANIZATION"; subjectId: string }>;

export class EnforcementDeniedError extends Error {
  constructor() { super("ENFORCEMENT_ACTION_DENIED"); }
}

export interface EnforcementGuard {
  allows(action: TradeMutationAction, subjects: readonly EnforcementSubject[]): Promise<boolean>;
}

export function createEnforcementGuard(db: QueryPort): EnforcementGuard {
  return Object.freeze({
    async allows(action:TradeMutationAction, subjects:readonly EnforcementSubject[]) {
      const unique:EnforcementSubject[] = [...new Map<string,EnforcementSubject>(subjects.filter((subject:EnforcementSubject) => subject.subjectId.trim()).map((subject:EnforcementSubject) => [`${subject.scope}:${subject.subjectId}`,subject])).values()];
      for (const subject of unique) {
        const result = await db.query<{state:string; restricted:boolean}>(`
          SELECT current.state,
            EXISTS(SELECT 1 FROM public.vre_enforcement_action_restrictions restriction
              WHERE restriction.action_id=current.id AND restriction.action_kind=$3) AS restricted
          FROM LATERAL (
            SELECT id,state FROM public.vre_enforcement_actions
            WHERE scope=$1 AND subject_id=$2
            ORDER BY effective_at DESC,id DESC LIMIT 1
          ) current
        `,[subject.scope,subject.subjectId,action]);
        const current=result.rows[0];
        if (!current || current.state === "NORMAL" || current.state === "MONITORED") continue;
        if (current.state === "RESTRICTED" && !current.restricted) continue;
        return false;
      }
      return true;
    },
  });
}

export async function requireTradeMutation(
  action: TradeMutationAction,
  subjects: readonly EnforcementSubject[],
): Promise<void> {
  const {pool}=await import("../db.js");
  if (!(await createEnforcementGuard(pool).allows(action,subjects))) throw new EnforcementDeniedError();
}
