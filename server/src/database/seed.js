import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { loadConfig, loadEnvFile } from '../config/env.js';
import { describeDbError } from './describeDbError.js';

// Uso:
//   npm run db:seed   -> insere os dados de demonstração de database/seeds (só em desenvolvimento)
// Os arquivos rodam em ordem de nome e são idempotentes (podem rodar de novo sem duplicar).
// Rode depois do "npm run db:migrate".
const SEEDS_DIR = fileURLToPath(new URL('../../database/seeds', import.meta.url));

loadEnvFile();

let config;
try {
  config = loadConfig();
  if (config.nodeEnv === 'production') throw new Error('db:seed é bloqueado quando NODE_ENV=production.');

  const files = (await readdir(SEEDS_DIR)).filter((name) => name.toLowerCase().endsWith('.sql')).sort();
  const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
  try {
    for (const file of files) {
      await conn.query(await readFile(path.join(SEEDS_DIR, file), 'utf8'));
      console.log(`  ✔ seed aplicado: ${file}`);
    }
  } finally {
    await conn.end();
  }
  console.log(`\nPronto: ${files.length} seed(s) em ${config.db.host}:${config.db.port}/${config.db.database}.`);
} catch (err) {
  console.error(`\n✖ ${config ? describeDbError(err, config.db) : err.message}`);
  process.exitCode = 1;
}
