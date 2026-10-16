import { loadConfig, loadEnvFile } from '../config/env.js';
import { describeDbError } from './describeDbError.js';
import { dropDatabase, runMigrations } from './migrator.js';

// Uso:
//   npm run db:migrate   -> cria o banco (se não existir) e aplica as migrations pendentes
//   npm run db:reset     -> APAGA o banco e aplica tudo de novo (só em desenvolvimento)
loadEnvFile();
const reset = process.argv.includes('--reset');

try {
  const config = loadConfig();

  if (reset) {
    if (config.nodeEnv === 'production') {
      throw new Error('db:reset é bloqueado quando NODE_ENV=production.');
    }
    await dropDatabase(config.db);
    console.log(`Banco "${config.db.database}" apagado.`);
  }

  console.log(`Aplicando migrations em ${config.db.host}:${config.db.port}/${config.db.database}...`);
  const { applied, skipped } = await runMigrations({ db: config.db });
  console.log(`\nPronto: ${applied.length} aplicada(s), ${skipped.length} já estavam aplicadas.`);
} catch (err) {
  let config;
  try {
    config = loadConfig();
  } catch {
    // sem configuração válida: mostra a mensagem original
  }
  console.error(`\n✖ ${config ? describeDbError(err, config.db) : err.message}`);
  process.exitCode = 1;
}
