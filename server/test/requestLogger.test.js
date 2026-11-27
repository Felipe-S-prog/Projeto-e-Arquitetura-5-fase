
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { requestLogger } from '../src/middlewares/requestLogger.js';

function executeLogger({ method = 'GET', path, user = null, status = 200 }) {
  const req = { method, path, user };
  const res = new EventEmitter();
  res.statusCode = status;

  let output;

  const originalLog = console.log;
  console.log = (message) => {
    output = JSON.parse(message);
  };

  try {
    requestLogger(req, res, () => {});
    res.emit('finish');
  } finally {
    console.log = originalLog;
  }

  return output;
}

test('logger registra requisição em JSON com usuário e duração', () => {
  const log = executeLogger({
    path: '/api/turmas',
    user: { id: 9, role: 'PROFESSOR' },
  });

  assert.equal(log.level, 'info');
  assert.equal(log.event, 'http_request');
  assert.equal(log.method, 'GET');
  assert.equal(log.path, '/api/turmas');
  assert.equal(log.status, 200);
  assert.equal(log.user_id, 9);
  assert.equal(log.role, 'PROFESSOR');
  assert.equal(typeof log.duration_ms, 'number');
  assert.ok(log.timestamp);
});

test('logger registra consulta de notas como acesso auditado', () => {
  const log = executeLogger({
    path: '/api/correcoes/aplicacoes/10',
    user: { id: 9, role: 'PROFESSOR' },
  });

  assert.equal(log.event, 'data_access');
  assert.equal(log.user_id, 9);
});

test('logger registra consulta de relatórios como acesso auditado', () => {
  const log = executeLogger({
    path: '/api/relatorios/aplicacoes/10',
    user: { id: 9, role: 'PROFESSOR' },
  });

  assert.equal(log.event, 'data_access');
});

test('logger registra histórico do aluno como acesso auditado', () => {
  const log = executeLogger({
    path: '/api/alunos/15/historico',
    user: { id: 9, role: 'PROFESSOR' },
  });

  assert.equal(log.event, 'data_access');
});

test('logger não audita acesso sem autenticação ou com erro', () => {
  const unauthenticated = executeLogger({
    path: '/api/relatorios/aplicacoes',
  });

  const failed = executeLogger({
    path: '/api/relatorios/aplicacoes',
    user: { id: 9, role: 'PROFESSOR' },
    status: 500,
  });

  assert.equal(unauthenticated.event, 'http_request');
  assert.equal(failed.event, 'http_request');
  assert.equal(failed.level, 'error');
});
