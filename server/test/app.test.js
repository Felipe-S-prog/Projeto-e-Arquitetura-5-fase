import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mysql from 'mysql2/promise';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

// Estes testes NÃO precisam de MySQL: usam um "pool falso" que devolve o que quisermos.
const config = loadConfig({ DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'sgp_teste', NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' });

function fakePool(behavior) {
  return { query: async (...args) => behavior(...args) };
}

async function startApp(pool) {
  const server = createApp({ pool, config }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const okPool = fakePool(async () => [[{ db: 'sgp_teste', now: new Date('2026-10-15T12:00:00.000Z') }], []]);
let ok;
before(async () => {
  ok = await startApp(okPool);
});
after(() => ok.server.close());

test('GET /api/health responde 200 sem tocar no banco', async () => {
  const exploding = fakePool(async () => {
    throw new Error('não deveria consultar o banco');
  });
  const { server, url } = await startApp(exploding);
  const res = await fetch(`${url}/api/health`);
  server.close();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptimeSeconds, 'number');
});

test('GET /api/health/db passa por todas as camadas e devolve o dado do model', async () => {
  const res = await fetch(`${ok.url}/api/health/db`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.database, 'sgp_teste');
  assert.equal(body.serverTime, '2026-10-15T12:00:00.000Z');
  assert.equal(typeof body.latencyMs, 'number');
});

test('GET /api/health/db: banco fora do ar -> 503 padronizado', async () => {
  const down = fakePool(async () => {
    throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
  });
  const { server, url } = await startApp(down);
  const res = await fetch(`${url}/api/health/db`);
  server.close();
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'DB_UNAVAILABLE');
});

test('GET /api/health/db: pool REAL do mysql2 apontando para uma porta fechada também vira 503', async () => {
  // garante que o formato do erro verdadeiro do mysql2 é reconhecido (não só o falso acima)
  const realPool = mysql.createPool({ host: '127.0.0.1', port: 1, user: 'u', password: 'p', database: 'x', connectTimeout: 2000 });
  const { server, url } = await startApp(realPool);
  const res = await fetch(`${url}/api/health/db`);
  server.close();
  await realPool.end();
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'DB_UNAVAILABLE');
});

test('erro inesperado vira 500 e a mensagem interna não chega ao cliente', async () => {
  const buggy = fakePool(async () => {
    throw new Error('ERRO-INTERNO-SECRETO');
  });
  const { server, url } = await startApp(buggy);
  const originalError = console.error;
  console.error = () => {}; // o handler registra o erro real no terminal; aqui silenciamos para não poluir o teste
  const res = await fetch(`${url}/api/health/db`);
  console.error = originalError;
  server.close();
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.ok(!text.includes('ERRO-INTERNO-SECRETO'));
  assert.equal(JSON.parse(text).error.code, 'INTERNAL_ERROR');
});

test('rota inexistente -> 404 em JSON', async () => {
  const res = await fetch(`${ok.url}/api/nao-existe`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
});

test('corpo com JSON inválido -> 400 INVALID_JSON', async () => {
  const res = await fetch(`${ok.url}/api/health`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{quebrado',
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_JSON');
});

test('CORS: libera o front configurado e não libera outras origens', async () => {
  const allowed = await fetch(`${ok.url}/api/health`, { headers: { origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const blocked = await fetch(`${ok.url}/api/health`, { headers: { origin: 'http://site-malicioso.example' } });
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
});

test('CORS: pré-requisição (OPTIONS) do navegador com Authorization é aceita', async () => {
  const res = await fetch(`${ok.url}/api/health`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization,content-type',
    },
  });
  assert.ok(res.status === 204 || res.status === 200);
  assert.match(res.headers.get('access-control-allow-headers') ?? '', /authorization/i);
});

test('segurança: não expõe x-powered-by e envia cabeçalhos do helmet', async () => {
  const res = await fetch(`${ok.url}/api/health`);
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});
