import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTurmasRoutes } from '../src/routes/turmas.routes.js';
import { createQuestoesRoutes } from '../src/routes/questoes.routes.js';

// Exercise the real Express router and middleware without opening a network port.
async function request(t, factory, pool, method, path, body) {
  const url = new URL(path, 'http://localhost');
  const req = { method, url: url.pathname, originalUrl: url.pathname,
    query: Object.fromEntries(url.searchParams), body, user: { id: 7 } };
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(value) { resolve({ status: this.statusCode, json: async () => value }); return this; },
      end() { resolve({ status: this.statusCode, json: async () => null }); },
    };
    factory({ pool }).handle(req, res, (error) => {
      res.status(error?.statusCode ?? 500).json({ message: error?.message ?? 'Rota não encontrada' });
    });
  });
}
function transaction(execute) {
  const calls = [];
  const connection = {
    execute: async (sql, values) => { calls.push([sql, values]); return execute(sql, values); },
    beginTransaction: async () => calls.push(['begin']),
    commit: async () => calls.push(['commit']),
    rollback: async () => calls.push(['rollback']),
    release: () => calls.push(['release']),
  };
  return { calls, pool: { getConnection: async () => connection } };
}
test('T81: turma arquivada pode ser editada pelo dono, inclusive sem alteração', async (t) => {
  const calls = [];
  const pool = { execute: async (sql, values) => {
    calls.push([sql, values]);
    if (sql.startsWith('UPDATE')) return [{ affectedRows: 0 }];
    if (sql.includes('FROM matricula')) return [[]];
    return [[{ id: 2, nome: 'Ação e Educação', disciplina: 'Matemática', periodo: '2026/2', status: 'ARQUIVADA' }]];
  }};
  const res = await request(t, createTurmasRoutes, pool, 'PUT', '/2', { nome: 'Ação e Educação', disciplina: 'Matemática', periodo: '2026/2', professor_id: 999 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'Arquivada');
  assert.doesNotMatch(calls[0][0], /status = 'ATIVA'/);
  assert.equal(calls[0][1].at(-1), 7);
});
for (const linked of [false, true]) {
  test('T81: excluir turma ' + (linked ? 'com aplicações preserva histórico por arquivamento' : 'sem aplicações remove só a turma'), async (t) => {
    const { calls, pool } = transaction(async (sql) => {
      if (sql.startsWith('SELECT id FROM turma')) return [[{ id: 2 }]];
      if (sql.startsWith('SELECT id FROM aplicacao')) return [linked ? [{ id: 20 }] : []];
      return [{ affectedRows: 1 }];
    });
    const res = await request(t, createTurmasRoutes, pool, 'DELETE', '/2?professor_id=999');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).archived, linked);
    assert(calls.some(([sql]) => sql.startsWith(linked ? 'UPDATE turma' : 'DELETE FROM turma')));
    assert(!calls.some(([sql]) => /DELETE FROM (aluno|correcao|aplicacao|copia_prova)/.test(sql)));
    assert.deepEqual(calls[1][1], [2, 7]);
    assert(calls.some(([sql]) => sql === 'commit'));
  });
}
test('T81: outra pessoa não exclui turma e a transação é revertida', async (t) => {
  const { calls, pool } = transaction(async () => [[]]);
  const res = await request(t, createTurmasRoutes, pool, 'DELETE', '/2?professor_id=999');
  assert.equal(res.status, 404);
  assert(calls.some(([sql]) => sql === 'rollback'));
  assert(!calls.some(([sql]) => sql.startsWith('DELETE') || sql.startsWith('UPDATE')));
});
test('T81: falha no banco reverte a exclusão', async (t) => {
  const { calls, pool } = transaction(async (sql) => {
    if (sql.startsWith('SELECT id FROM turma')) return [[{ id: 2 }]];
    throw new Error('falha simulada');
  });
  const res = await request(t, createTurmasRoutes, pool, 'DELETE', '/2');
  assert.equal(res.status, 500);
  assert(calls.some(([sql]) => sql === 'rollback'));
  assert(!calls.some(([sql]) => sql === 'commit'));
});
test('T79: criação normaliza as tags antes de gravar e ignora professor forjado', async (t) => {
  const { calls, pool } = transaction(async (sql) => {
    if (sql.includes('INSERT INTO questao ')) return [{ insertId: 10 }];
    if (sql.includes('SELECT id FROM tag')) return [[{ id: 3 }]];
    return [{ affectedRows: 1 }];
  });
  const res = await request(t, createQuestoesRoutes, pool, 'POST', '/', {
    professor_id: 999, enunciado: 'Quanto é 2 + 2?', tags: ['MAT', 'matemática', ' Matemat '],
    alternativas: [{ texto: '4', correta: true }, { texto: '5', correta: false }],
  });
  assert.equal(res.status, 201);
  assert.deepEqual((await res.json()).question.tags, ['matematica']);
  assert.equal(calls.filter(([sql]) => sql.includes('INSERT IGNORE INTO tag ')).length, 1);
  assert.equal(calls.find(([sql]) => sql.includes('INSERT INTO questao '))[1][0], 7);
});
test('T81: exclusão de questão é lógica e respeita o professor autenticado', async (t) => {
  const calls = [];
  const pool = { execute: async (sql, values) => { calls.push([sql, values]); return [{ affectedRows: 1 }]; }};
  const res = await request(t, createQuestoesRoutes, pool, 'DELETE', '/10?professor_id=999');
  assert.equal(res.status, 204);
  assert.match(calls[0][0], /SET excluida_em = CURRENT_TIMESTAMP/);
  assert.deepEqual(calls[0][1], [10, 7]);
});
test('T81: exclusão de questão de outro professor retorna 404', async (t) => {
  const res = await request(t, createQuestoesRoutes, { execute: async () => [{ affectedRows: 0 }] }, 'DELETE', '/10');
  assert.equal(res.status, 404);
});
