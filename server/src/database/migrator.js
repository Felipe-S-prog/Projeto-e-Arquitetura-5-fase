import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

// Pasta onde ficam os scripts SQL do banco (server/database/migrations).
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../database/migrations', import.meta.url));

// Uma "migration" é um arquivo .sql que altera o banco (criar tabela, adicionar
// coluna...). Elas rodam em ordem de nome (001_..., 002_...) e cada uma roda
// UMA vez por banco: o nome fica gravado na tabela schema_migrations.
// Assim todo mundo do grupo chega ao mesmo banco com "npm run db:migrate".

async function listMigrationFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return entries.filter((name) => name.toLowerCase().endsWith('.sql')).sort((a, b) => a.localeCompare(b));
}

// O checksum detecta migration editada depois de aplicada. Normalizamos as
// quebras de linha para o mesmo arquivo dar o mesmo resultado no Windows (CRLF)
// e no Linux/Mac (LF).
function checksum(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

// Conecta sem escolher banco (para poder criá-lo ou apagá-lo).
function connectWithoutDatabase(db) {
  return mysql.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, ssl: db.ssl });
}

export async function runMigrations({ db, migrationsDir = DEFAULT_MIGRATIONS_DIR, log = console.log }) {
  // 1) garante que o banco existe
  const admin = await connectWithoutDatabase(db);
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${db.database}\` CHARACTER SET utf8mb4`);
  } finally {
    await admin.end();
  }

  // 2) conecta no banco. multipleStatements só aqui: os arquivos .sql são
  // do próprio repositório (confiáveis) e costumam ter vários comandos.
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
    const [rows] = await conn.query('SELECT name, checksum FROM schema_migrations');
    const alreadyApplied = new Map(rows.map((row) => [row.name, row.checksum]));

    for (const file of await listMigrationFiles(migrationsDir)) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      const hash = checksum(sql);

      if (alreadyApplied.has(file)) {
        if (alreadyApplied.get(file) !== hash) {
          throw new Error(
            `A migration ${file} foi alterada depois de aplicada. ` +
              'Não edite migrations antigas: crie uma nova (ex.: 002_ajuste.sql). ' +
              'Em desenvolvimento, "npm run db:reset" recria o banco do zero.'
          );
        }
        skipped.push(file);
        continue;
      }

      try {
        // Atenção: no MySQL, CREATE/ALTER TABLE confirmam sozinhos (não dá rollback).
        // Se uma migration falhar no meio, o que veio antes dela no arquivo já foi aplicado.
        await conn.query(sql);
      } catch (err) {
        throw new Error(`Falha ao aplicar ${file}: ${err.message}`, { cause: err });
      }
      await conn.query('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [file, hash]);
      applied.push(file);
      log(`  ✔ aplicada: ${file}`);
    }
  } finally {
    await conn.end();
  }

  return { applied, skipped };
}

// Apaga o banco inteiro. Só para desenvolvimento (o CLI bloqueia em produção).
export async function dropDatabase(db) {
  const admin = await connectWithoutDatabase(db);
  try {
    await admin.query(`DROP DATABASE IF EXISTS \`${db.database}\``);
  } finally {
    await admin.end();
  }
}
