
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

// Pasta onde ficam os scripts SQL (server/database/migrations).
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(
  new URL('../../database/migrations', import.meta.url),
);

async function listMigrationFiles(dir) {
  let entries;

  try {
    entries = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  return entries
    .filter((name) => name.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

function checksum(sql) {
  return createHash('sha256')
    .update(sql.replace(/\r\n/g, '\n'))
    .digest('hex');
}

// Conecta sem escolher banco para poder criá-lo ou apagá-lo.
function connectWithoutDatabase(db) {
  return mysql.createConnection({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    ssl: db.ssl,
  });
}

export async function runMigrations({
  db,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  log = console.log,
}) {
  // 1. Garante que o banco existe.
  const admin = await connectWithoutDatabase(db);

  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${db.database}\` CHARACTER SET utf8mb4`,
    );
  } finally {
    await admin.end();
  }

  // 2. Conecta ao banco utilizando SSL quando configurado.
  const conn = await mysql.createConnection({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.database,
    ssl: db.ssl,
    multipleStatements: true,
  });

  const applied = [];
  const skipped = [];

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) NOT NULL PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [rows] = await conn.query(
      'SELECT name, checksum FROM schema_migrations',
    );

    const alreadyApplied = new Map(
      rows.map((row) => [row.name, row.checksum]),
    );

    for (const file of await listMigrationFiles(migrationsDir)) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      const hash = checksum(sql);

      if (alreadyApplied.has(file)) {
        if (alreadyApplied.get(file) !== hash) {
          throw new Error(
            `A migration ${file} foi alterada depois de aplicada. ` +
            'Não edite migrations antigas: crie uma nova. ' +
            'Em desenvolvimento, "npm run db:reset" recria o banco do zero.',
          );
        }

        skipped.push(file);
        continue;
      }

      try {
        await conn.query(sql);
      } catch (err) {
        throw new Error(
          `Falha ao aplicar ${file}: ${err.message}`,
          { cause: err },
        );
      }

      await conn.query(
        'INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)',
        [file, hash],
      );

      applied.push(file);
      log(`  ✔ aplicada: ${file}`);
    }
  } finally {
    await conn.end();
  }

  return { applied, skipped };
}

export async function dropDatabase(db) {
  const admin = await connectWithoutDatabase(db);

  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${db.database}\``);
  } finally {
    await admin.end();
  }
}
