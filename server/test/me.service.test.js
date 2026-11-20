import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { createMeService } from '../src/services/me.service.js';

test('anonimizar conta usa a identidade recebida do middleware e retorna confirmação', async () => {
  const chamados = [];
  const service = createMeService({
    async anonymizeAccount(userId) { chamados.push(userId); return true; },
  });

  const result = await service.anonymizeAccount(7);

  assert.deepEqual(chamados, [7]);
  assert.deepEqual(result, {
    message: 'Conta anonimizada. Todas as sessões foram encerradas.',
  });
});

test('anonimizar conta recusa usuário sem ID válido e conta que não está ativa', async () => {
  const service = createMeService({ async anonymizeAccount() { return false; } });

  await assert.rejects(service.anonymizeAccount(null), (error) => error instanceof AppError && error.statusCode === 401);
  await assert.rejects(service.anonymizeAccount(7), (error) => error instanceof AppError && error.statusCode === 401);
});
