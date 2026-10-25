import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { calcularCorrecao, montarQuestoesImpressas, validarNotaManual } from '../src/services/correcao.calculo.js';

// Prova com 2 objetivas e 1 discursiva (nota máxima 10).
const questoes = [
  { questaoId: 10, posicao: 1, pontuacao: 4, tipo: 'OBJETIVA', enunciado: 'Capital da Argentina?' },
  { questaoId: 20, posicao: 2, pontuacao: 3.5, tipo: 'OBJETIVA', enunciado: '2 + 2?' },
  { questaoId: 30, posicao: 3, pontuacao: 2.5, tipo: 'DISCURSIVA', enunciado: 'Explique.' },
];
const alternativas = [
  { questaoId: 10, ordem: 0, texto: 'Buenos Aires', correta: true },
  { questaoId: 10, ordem: 1, texto: 'Córdoba', correta: false },
  { questaoId: 10, ordem: 2, texto: 'Rosário', correta: false },
  { questaoId: 20, ordem: 0, texto: '3', correta: false },
  { questaoId: 20, ordem: 1, texto: '4', correta: true },
];
// Cópia embaralhada: questões 20, 30, 10; na 10 a correta (ordem 0) foi impressa como C.
const ordem = { questionIds: [20, 30, 10], alternativesOrder: { 10: [2, 1, 0], 20: [0, 1], 30: [] } };

function rejeitaCom(fn, statusCode, trecho) {
  assert.throws(fn, (err) => err instanceof AppError && err.statusCode === statusCode && err.message.includes(trecho));
}

test('montarQuestoesImpressas: segue a ordem da cópia e a letra correta acompanha o embaralhamento', () => {
  const impressas = montarQuestoesImpressas(ordem, questoes, alternativas);
  assert.deepEqual(
    impressas.map((q) => [q.numero, q.questaoId, q.letraCorreta]),
    [
      [1, 20, 'B'],
      [2, 30, null],
      [3, 10, 'C'],
    ]
  );
  assert.deepEqual(
    impressas[2].alternativas.map((a) => `${a.letra}) ${a.texto}`),
    ['A) Rosário', 'B) Córdoba', 'C) Buenos Aires']
  );
});

test('montarQuestoesImpressas: sem ordem gravada usa a posição da prova e a ordem original das alternativas', () => {
  const impressas = montarQuestoesImpressas({ questionIds: [], alternativesOrder: {} }, questoes, alternativas);
  assert.deepEqual(
    impressas.map((q) => [q.questaoId, q.letraCorreta]),
    [
      [10, 'A'],
      [20, 'B'],
      [30, null],
    ]
  );
});

test('montarQuestoesImpressas: cópia que não bate com a prova é recusada (409)', () => {
  rejeitaCom(() => montarQuestoesImpressas({ questionIds: [20, 10], alternativesOrder: {} }, questoes, alternativas), 409, 'ordem gravada');
  rejeitaCom(
    () => montarQuestoesImpressas({ questionIds: [10, 20, 30], alternativesOrder: { 10: [0, 1] } }, questoes, alternativas),
    409,
    'alternativas gravadas'
  );
  const semCorreta = alternativas.map((a) => ({ ...a, correta: false }));
  rejeitaCom(() => montarQuestoesImpressas(ordem, questoes, semCorreta), 409, 'não tem alternativa correta');
});

test('calcularCorrecao: soma a pontuação das objetivas certas e os pontos dados nas discursivas', () => {
  const impressas = montarQuestoesImpressas(ordem, questoes, alternativas);
  const { nota, respostas } = calcularCorrecao(impressas, [
    { questaoId: 20, letra: 'b' },
    { questaoId: 30, pontos: 1.25 },
    { questaoId: 10, letra: 'A' },
  ]);
  assert.equal(nota, 4.75); // 3.5 (certa) + 1.25 (discursiva) + 0 (errada)
  assert.deepEqual(
    respostas.map((r) => [r.numero, r.letraMarcada, r.letraCorreta, r.correta, r.pontos]),
    [
      [1, 'B', 'B', true, 3.5],
      [2, null, null, null, 1.25],
      [3, 'A', 'C', false, 0],
    ]
  );
});

test('calcularCorrecao: objetiva sem resposta (ou com letra nula) conta como em branco', () => {
  const impressas = montarQuestoesImpressas(ordem, questoes, alternativas);
  const { nota, respostas } = calcularCorrecao(impressas, [
    { questaoId: 30, pontos: 0 },
    { questaoId: 10, letra: null },
  ]);
  assert.equal(nota, 0);
  assert.deepEqual(
    respostas.filter((r) => r.tipo === 'OBJETIVA').map((r) => [r.letraMarcada, r.correta]),
    [
      [null, false],
      [null, false],
    ]
  );
});

test('calcularCorrecao: respostas inválidas viram 400 com mensagem clara', () => {
  const impressas = montarQuestoesImpressas(ordem, questoes, alternativas);
  rejeitaCom(() => calcularCorrecao(impressas, 'x'), 400, 'lista');
  rejeitaCom(() => calcularCorrecao(impressas, [{ questaoId: 99, letra: 'A' }]), 400, 'não está nesta prova');
  rejeitaCom(() => calcularCorrecao(impressas, [{ questaoId: 30, pontos: 1 }, { questaoId: 30, pontos: 1 }]), 400, 'mais de uma');
  rejeitaCom(() => calcularCorrecao(impressas, []), 400, 'discursiva 2');
  rejeitaCom(() => calcularCorrecao(impressas, [{ questaoId: 30, pontos: 2.6 }]), 400, 'entre 0 e 2.5');
  rejeitaCom(() => calcularCorrecao(impressas, [{ questaoId: 30, pontos: 1 }, { questaoId: 20, letra: 'C' }]), 400, 'só tem as alternativas A, B');
  rejeitaCom(() => calcularCorrecao(impressas, [{ questaoId: 30, pontos: 1 }, { questaoId: 20, letra: 'Z' }]), 400, 'Letra inválida');
});

test('validarNotaManual: aceita de 0 até a nota máxima, com até 2 casas', () => {
  assert.equal(validarNotaManual('7.5', 10), 7.5);
  assert.equal(validarNotaManual(0, 10), 0);
  assert.equal(validarNotaManual(10, 10), 10);
  rejeitaCom(() => validarNotaManual('', 10), 400, 'Informe a nota');
  rejeitaCom(() => validarNotaManual('abc', 10), 400, 'Informe a nota');
  rejeitaCom(() => validarNotaManual(10.01, 10), 400, 'entre 0 e 10');
  rejeitaCom(() => validarNotaManual(-1, 10), 400, 'entre 0 e 10');
  rejeitaCom(() => validarNotaManual(7.555, 10), 400, '2 casas');
});
