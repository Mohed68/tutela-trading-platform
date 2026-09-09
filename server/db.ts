import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool as NodePostgresPool } from 'pg';
import { drizzle as drizzleNodePostgres } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const useNodePostgresForTest =
  process.env.NODE_ENV === "test" &&
  process.env.TUTELA_TEST_NODE_POSTGRES === "true";

export const pool = useNodePostgresForTest
  ? new NodePostgresPool({ connectionString: process.env.DATABASE_URL })
  : new Pool({ connectionString: process.env.DATABASE_URL });
export const db = useNodePostgresForTest
  ? drizzleNodePostgres({ client: pool as NodePostgresPool, schema })
  : drizzle({ client: pool as Pool, schema });
