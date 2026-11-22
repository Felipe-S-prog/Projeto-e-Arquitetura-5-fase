import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import express from 'express';
import { createMeRoutes } from '../src/routes/me.routes.js';

const servers = new Set();

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise((resolve) => server.close(resolve))));
  servers.clear();
});

async function start(pool) {
  const app = express();
  app.use(express.json());
  // O middleware real da API injeta este usuário depois de validar o JWT.
  app.use((req, res, next) => { req.user = { id: 7 }; next(); });
  app.use('/me', createMeRoutes({ pool }));
  const server = app.listen(0);
  servers.add(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

function fakePool() {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push(['BEGIN']); },
    async execute(sql, values = []) {
      calls.push([sql, values]);
      if (sql.includes('SELECT id') && sql.includes('FROM usuario')) return [[{ id: 7 }], []];
      if (sql.includes('UPDATE usuario')) return [{ affectedRows: 1 }, []];
      if (sql.includes('UPDATE refresh_token')) return [{ affectedRows: 2 }, []];
      throw new Error(`SQL inesperado no teste: ${sql}`);
    },
    async commit() { calls.push(['COMMIT']); },
    async rollback() { calls.push(['ROLLBACK']); },
    release() { calls.push(['RELEASE']); },
  };
  return { calls, pool: { getConnection: async () => connection } };
}

test('POST /me/anonymize anonimiza somente a conta autenticada e revoga sessões', async () => {
  const { calls, pool } = fakePool();
  const url = await start(pool);
  const response = await fetch(`${url}/me/anonymize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 999 }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: 'Conta anonimizada. Todas as sessões foram encerradas.',
  });

  const userUpdate = calls.find(([sql]) => typeof sql === 'string' && sql.includes('UPDATE usuario'));
  assert.deepEqual(userUpdate[1], ['Conta anonimizada #7', 'anonimizado-7@anonimizado.invalid', 7]);
  assert.match(userUpdate[0], /senha_hash = NULL/);
  assert.match(userUpdate[0], /status = 'ANONIMIZADO'/);
  assert.match(userUpdate[0], /versao_sessao = versao_sessao \+ 1/);
  assert.ok(calls.some(([sql]) => typeof sql === 'string' && sql.includes('UPDATE refresh_token')));
  assert.ok(calls.some(([sql]) => sql === 'COMMIT'));
  assert.ok(!calls.some(([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM usuario')));
});

test('POST /me/anonymize devolve 401 se o repositório não encontrar conta ativa', async () => {
  const connection = {
    async beginTransaction() {},
    async execute() { return [[], []]; },
    async rollback() { this.rolledBack = true; },
    async commit() {},
    release() {},
  };
  const url = await start({ getConnection: async () => connection });
  const response = await fetch(`${url}/me/anonymize`, { method: 'POST' });
  assert.equal(response.status, 401);
});
