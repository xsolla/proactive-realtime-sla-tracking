import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { slaAlertState } from "./schema/alert-state";
import { slaOutages } from "./schema/outages";

const schema = { slaOutages, slaAlertState };

export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(connectionString: string): Database {
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}

let database: Database | undefined;

export function getDatabase(): Database {
  if (database) {
    return database;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }
  database = createDatabase(connectionString);
  return database;
}
