import mysql from 'mysql2/promise';
import { Database as SqliteDatabase } from 'bun:sqlite';

export type DatabaseType = 'mysql' | 'sqlite';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

export const databaseType = determineDatabaseType(databaseUrl);

type DbParams = unknown[];

export interface DatabaseClient {
  query<T>(sql: string, params?: DbParams): Promise<T[]>;
  execute(sql: string, params?: DbParams): Promise<void>;
  close(): Promise<void>;
}

export type DatabaseContext = {
  client: DatabaseClient;
  query<T>(sql: string, params?: DbParams): Promise<T[]>;
  execute(sql: string, params?: DbParams): Promise<void>;
};

export function createDatabaseClient(): DatabaseClient {
  return databaseType === 'sqlite'
    ? createSqliteClient(databaseUrl)
    : createMysqlClient(databaseUrl);
}

export function createDatabaseContext(client?: DatabaseClient): DatabaseContext {
  const db = client ?? createDatabaseClient();
  return {
    client: db,
    query: <T>(sql: string, params: DbParams = []) => db.query<T>(sql, params),
    execute: (sql: string, params: DbParams = []) => db.execute(sql, params)
  };
}

let defaultClient: DatabaseClient | null = null;
let defaultContext: DatabaseContext | null = null;

export function setDefaultClient(client: DatabaseClient) {
  defaultClient = client;
  defaultContext = createDatabaseContext(client);
}

export function getDefaultClient(): DatabaseClient {
  if (!defaultClient) {
    defaultClient = createDatabaseClient();
  }
  return defaultClient;
}

export function getDefaultContext(): DatabaseContext {
  if (!defaultContext) {
    defaultContext = createDatabaseContext(getDefaultClient());
  }
  return defaultContext;
}

export const query = <T>(sql: string, params: DbParams = []): Promise<T[]> =>
  getDefaultClient().query<T>(sql, params);

export const execute = (sql: string, params: DbParams = []): Promise<void> =>
  getDefaultClient().execute(sql, params);

export const closeDatabase = async (): Promise<void> => {
  if (defaultContext) {
    defaultContext = null;
  }
  if (!defaultClient) return;
  await defaultClient.close();
  defaultClient = null;
};

function determineDatabaseType(url: string): DatabaseType {
  const explicitType = process.env.DATABASE_TYPE?.trim().toLowerCase();
  if (explicitType) {
    if (explicitType === 'mysql' || explicitType === 'sqlite') {
      return explicitType;
    }
    throw new Error('DATABASE_TYPE must be either mysql or sqlite');
  }

  const normalized = url.trim().toLowerCase();
  if (
    normalized.startsWith('sqlite:') ||
    normalized === ':memory:' ||
    normalized.endsWith('.sqlite') ||
    normalized.endsWith('.db')
  ) {
    return 'sqlite';
  }
  return 'mysql';
}

function createMysqlClient(url: string): DatabaseClient {
  const pool = mysql.createPool(url);

  return {
    async query<T>(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows as T[];
    },
    async execute(sql, params = []) {
      await pool.execute(sql, params);
    },
    async close() {
      await pool.end();
    }
  };
}

function createSqliteClient(pathOrUrl: string): DatabaseClient {
  const sqlitePath = normalizeSqlitePath(pathOrUrl);
  const db = new SqliteDatabase(sqlitePath);
  db.exec('PRAGMA foreign_keys = ON;');

  return {
    async query<T>(sql, params = []) {
      const statement = db.query(sql);
      const rows = statement.all(...params);
      return rows as T[];
    },
    async execute(sql, params = []) {
      db.query(sql).all(...params);
    },
    async close() {
      db.close();
    }
  };
}

function normalizeSqlitePath(raw: string): string {
  let trimmed = raw.trim();
  if (trimmed.startsWith('sqlite://')) {
    trimmed = trimmed.slice('sqlite://'.length);
  } else if (trimmed.startsWith('sqlite:')) {
    trimmed = trimmed.slice('sqlite:'.length);
  }

  if (!trimmed) {
    return ':memory:';
  }

  if (trimmed.startsWith('/') && /^[a-z]:/i.test(trimmed.slice(1))) {
    trimmed = trimmed.slice(1);
  }

  return trimmed;
}
