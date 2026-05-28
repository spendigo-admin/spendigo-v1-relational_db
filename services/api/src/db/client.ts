import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let dbInstance: any = null;
let poolInstance: Pool | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  const isLocalHost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  // Serverless pool configuration: Keep a small pool footprint
  // to avoid hitting Postgres connection limits under concurrent scaling
  poolInstance = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isLocalHost ? false : { rejectUnauthorized: false }
  });

  dbInstance = drizzle(poolInstance, { schema });
  return dbInstance;
}

export function closePool() {
  if (poolInstance) {
    poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}
