import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { createGabaritoService, resolverGabarito } from '../src/services/gabarito.service.js';

// Prova com 3 questões: 10 (correta é a original 1), 20 (correta é a original 0) e 30 (discursiva).
const alternativas = new Map([
  [10, [false, true, false, false]],
  [20, [true, false]],
]);

const copia = (extra = {}) => ({
  code: 'ABC234',
  provaId: 1,
  provaTitulo: 'Cálculo I — P1',
  answerKeyPublished: true,
  answerKeyPublishedAt: '2026-10-28T12:00:00.000Z',
  // Impressa como: 1ª = questão 20, 2ª = questão 10, 3ª = questão 30.
  questionIds: [20, 10, 30],
  // Questão 10 impressa na ordem original [3, 1, 0, 2]: a correta (original 1) é a letra B.
  // Questão 20 impressa como [1, 0]: a correta (original 0) é a letra B.
  alternativesOrder: { 10: [3, 1, 0, 2], 20: [1, 0], 30: [] },
  ...extra,
});

function fakeRepository(copias) {
  return {
    async findCopiaPorCodigo(codigo) {
      return copias.find((c) => c.code === codigo) ?? null;
    },
    async listAlternativasDaProva() {
      return alternativas;
    },
  };
}

async function rejeita(promessa, statusEsperado) {
  await assert.rejects(promessa, (err) => {
    assert.ok(err instanceof AppError, `esperava AppError, veio ${err}`);
    assert.equal(err.statusCode, statusEsperado);
    return true;
  });
}

test('resolverGabarito: letra certa na ordem impressa da cópia; discursiva sem letra', () => {
  assert.deepEqual(resolverGabarito(copia(), alternativas), [
    { number: 1, correctLetter: 'B' },
    { number: 2, correctLetter: 'B' },
    { number: 3, correctLetter: null },
  ]);
});

test('resolverGabarito: sem embaralhar, vale a ordem original', () => {
  const semEmbaralhar = copia({ questionIds: [10, 20], alternativesOrder: { 10: [0, 1, 2, 3], 20: [0, 1] } });
  assert.deepEqual(resolverGabarito(semEmbaralhar, alternativas), [
    { number: 1, correctLetter: 'B' },
    { number: 2, correctLetter: 'A' },
  ]);
});

test('consultar: devolve só o título e as letras, nunca nota ou aluno', async () => {
  const service = createGabaritoService(fakeRepository([copia({ studentName: 'Ana', label: 'Ana' })]));
  const gabarito = await service.consultar(' abc234 ');
  assert.deepEqual(Object.keys(gabarito).sort(), ['answers', 'code', 'examTitle', 'publishedAt']);
  assert.equal(gabarito.examTitle, 'Cálculo I — P1');
  assert.equal(gabarito.answers.length, 3);
});

test('consultar: código inexistente (404), não publicado (403) e inválido (400)', async () => {
  const service = createGabaritoService(fakeRepository([copia({ code: 'NAOPUB', answerKeyPublished: false })]));
  await rejeita(service.consultar('ZZZ999'), 404);
  await rejeita(service.consultar('NAOPUB'), 403);
  await rejeita(service.consultar('ab'), 400);
  await rejeita(service.consultar('ABC-23'), 400);
});
