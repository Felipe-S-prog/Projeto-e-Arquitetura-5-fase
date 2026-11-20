import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProvaRepository } from '../src/repositories/prova.repository.js';

// Pool falso: registra o SQL e responde o status da prova no SELECT ... FOR UPDATE.
function makePool(statusNoBanco) {
  const calls = [];
  const responder = async (sql, params) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
    if (sql.includes('FOR UPDATE')) return [statusNoBanco ? [{ status: statusNoBanco }] : []];
    if (sql.startsWith('SELECT id, titulo')) {
      return [[{ id: 7, titulo: 'Nova', descricao: null, status: statusNoBanco, criada_em: null }]];
    }
    if (sql.startsWith('SELECT questao_id')) return [[{ questao_id: 3, posicao: 1, pontuacao: '2.00' }]];
    return [{ affectedRows: 1 }];
  };
  const connection = {
    query: responder,
    async beginTransaction() { calls.push('begin'); },
    async commit() { calls.push('commit'); },
    async rollback() { calls.push('rollback'); },
    release() { calls.push('release'); },
  };
  return { calls, query: responder, async getConnection() { return connection; } };
}

const dados = { titulo: 'Nova', descricao: null, questoes: [{ questionId: 3, score: 2 }] };
const escritas = (calls) => calls.filter((c) => typeof c === 'object' && /^(UPDATE|DELETE|INSERT)/.test(c.sql));

test('update: trava a prova e grava título e questões quando ela ainda está em Rascunho (T50)', async () => {
  const pool = makePool('RASCUNHO');
  const prova = await createProvaRepository(pool).update(7, 1, dados);

  assert.match(pool.calls[1].sql, /^SELECT status FROM prova WHERE id = \? AND professor_id = \? FOR UPDATE$/);
  assert.deepEqual(pool.calls[1].params, [7, 1]);
  assert.deepEqual(escritas(pool.calls).map((c) => c.sql.split(' ')[0]), ['UPDATE', 'DELETE', 'INSERT']);
  assert.ok(pool.calls.includes('commit'));
  assert.equal(prova.title, 'Nova');
  assert.deepEqual(prova.questions, [{ questionId: 3, score: 2 }]);
});

test('update: prova que já virou Pronta (aplicação criada antes) devolve null sem gravar nada (T50)', async () => {
  for (const status of ['PRONTA', 'ARQUIVADA', null]) {
    const pool = makePool(status);
    assert.equal(await createProvaRepository(pool).update(7, 1, dados), null, `status ${status}`);
    assert.deepEqual(escritas(pool.calls), [], `status ${status}`);
    assert.ok(pool.calls.includes('release'));
  }
});
