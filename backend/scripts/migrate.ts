import { readFile } from 'node:fs/promises';
import { createDatabaseClient, databaseType } from '../src/db';

const schemaFile = databaseType === 'sqlite' ? '../../schema.sqlite.sql' : '../../schema.sql';
const schemaPath = new URL(schemaFile, import.meta.url);
const schemaSql = await readFile(schemaPath, 'utf8');

const client = createDatabaseClient();
try {
  const statements = schemaSql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.execute(statement);
  }

  console.log('Migration completed');
} finally {
  await client.close();
}
