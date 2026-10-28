import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

// Rotas da T26 sem MySQL: um "pool falso" devolve uma cópia publicada (ABC234) e outra não (NAOPUB).
const config = loadConfig({ DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'sgp_teste', NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173' });

const copias = {
  ABC234: { publicado: 1 },
  NAOPUB: { publicado: 0 },
};

const pool = {
  async query(sql, valores) {
    if (sql.includes('FROM copia_prova cp')) {
      const c = copias[valores[0]];
      if (!c) return [[], []];
      return [[{
        id: 1, aplicacao_id: 1, codigo: valores[0], rotulo: 'Prova #01', aluno_id: null, aluno_nome: null,
        ordem_embaralhamento: { questionIds: [10], alternativesOrder: { 10: [1, 0] } },
        gabarito_publicado: c.publicado, gabarito_publicado_em: null, prova_id: 1, prova_titulo: 'P1',
      }], []];
    }
    if (sql.includes('FROM prova_questao pq')) return [[{ questao_id: 10, correta: 1 }, { questao_id: 10, correta: 0 }], []];
    throw new Error(`consulta inesperada: ${sql}`);
  },
};

let server;
let url;
before(async () => {
  server = createApp({ pool, config }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('GET /api/gabarito/:codigo é pública: responde sem token, só com as letras', async () => {
  const res = await fetch(`${url}/api/gabarito/abc234`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { code: 'ABC234', examTitle: 'P1', publishedAt: null, answers: [{ number: 1, correctLetter: 'B' }] });
});

test('GET /api/gabarito/:codigo: não publicado 403, inexistente 404', async () => {
  assert.equal((await fetch(`${url}/api/gabarito/NAOPUB`)).status, 403);
  assert.equal((await fetch(`${url}/api/gabarito/ZZZ999`)).status, 404);
});

test('as rotas de cópias do professor continuam exigindo token (401)', async () => {
  assert.equal((await fetch(`${url}/api/copias`)).status, 401);
});
