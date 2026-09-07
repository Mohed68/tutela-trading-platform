import type { Pool } from "pg";

export interface PrivilegedSessionInvalidationPort {
  invalidateUserSessions(userId: string): Promise<number>;
}

export function createPostgresSessionInvalidationPort(pool: Pool): PrivilegedSessionInvalidationPort {
  return Object.freeze({
    async invalidateUserSessions(userId: string): Promise<number> {
      if (!userId.trim()) throw new Error("SESSION_INVALIDATION_USER_REQUIRED");
      const result = await pool.query(
        `DELETE FROM public.sessions WHERE sess #>> '{passport,user}' = $1`,
        [userId],
      );
      return result.rowCount ?? 0;
    },
  });
}
