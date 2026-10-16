import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { toHttpError } from '../src/middlewares/errorHandler.js';

test('AppError: atalhos devolvem o status e o código certos', () => {
  assert.deepEqual(
    [AppError.badRequest('x'), AppError.unauthorized(), AppError.forbidden(), AppError.notFound(), AppError.conflict('x')].map(
      (e) => [e.statusCode, e.code]
    ),
    [
      [400, 'BAD_REQUEST'],
      [401, 'UNAUTHORIZED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [409, 'CONFLICT'],
    ]
  );
});

test('toHttpError: AppError vira a resposta padronizada (com details só quando existem)', () => {
  assert.deepEqual(toHttpError(AppError.notFound('Questão não encontrada')), {
    status: 404,
    body: { error: { code: 'NOT_FOUND', message: 'Questão não encontrada' } },
  });
  const withDetails = toHttpError(AppError.badRequest('Dados inválidos', { campo: 'email' }));
  assert.equal(withDetails.status, 400);
  assert.deepEqual(withDetails.body.error.details, { campo: 'email' });
});

test('toHttpError: JSON inválido e corpo grande demais', () => {
  assert.equal(toHttpError({ type: 'entity.parse.failed' }).status, 400);
  assert.equal(toHttpError({ type: 'entity.parse.failed' }).body.error.code, 'INVALID_JSON');
  assert.equal(toHttpError({ type: 'entity.too.large' }).status, 413);
});

test('toHttpError: erros do MySQL em CRUD comum viram 409 (e-mail repetido, chave estrangeira, registro em uso)', () => {
  assert.deepEqual(
    ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2'].map((code) => {
      const { status, body } = toHttpError({ code });
      return [status, body.error.code];
    }),
    [
      [409, 'DUPLICATE_ENTRY'],
      [409, 'REFERENCE_NOT_FOUND'],
      [409, 'IN_USE'],
    ]
  );
});

test('toHttpError: banco inacessível vira 503', () => {
  for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR']) {
    const { status, body } = toHttpError({ code });
    assert.equal(status, 503, code);
    assert.equal(body.error.code, 'DB_UNAVAILABLE');
  }
});

test('toHttpError: erro desconhecido vira 500 SEM vazar a mensagem interna', () => {
  const { status, body } = toHttpError(new Error('SELECT * FROM usuarios WHERE senha = ...'));
  assert.equal(status, 500);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.ok(!JSON.stringify(body).includes('SELECT'));
});
