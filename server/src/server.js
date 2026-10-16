import { createApp } from './app.js';
import { loadConfig, loadEnvFile } from './config/env.js';
import { createPool } from './database/pool.js';
import { describeDbError } from './database/describeDbError.js';

loadEnvFile();

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exit(1);
}

const pool = createPool(config.db);
const app = createApp({ pool, config });

// Aviso amigável no início. Não derruba a API: /api/health/db mostra o estado do banco.
pool
  .query('SELECT 1')
  .then(() => console.log(`✔ MySQL conectado (${config.db.host}:${config.db.port}/${config.db.database})`))
  .catch((err) => {
    console.warn(`⚠ ${describeDbError(err, config.db)}`);
    console.warn('  A API continua no ar; as rotas que usam o banco vão responder 503 até ele voltar.');
  });

const server = app.listen(config.port, () => {
  console.log(`✔ API do SGP no ar: http://localhost:${config.port}/api/health`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`✖ A porta ${config.port} já está em uso. Feche o outro processo ou mude PORT no .env.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

// Encerramento limpo (Ctrl+C): para de aceitar requisições e fecha as conexões do banco.
function shutdown(signal) {
  console.log(`\n${signal} recebido: encerrando...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
