import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CODE_CHARS, CODE_LENGTH, gerarCopias } from '../src/services/copia.geracao.js';

// Gerador previsível: devolve a sequência informada em loop, para os testes não dependerem da sorte.
function sequencia(valores) {
  let i = 0;
  return () => valores[i++ % valores.length];
}

const questoes = [
  { id: 10, totalAlternativas: 4 },
  { id: 20, totalAlternativas: 3 },
  { id: 30, totalAlternativas: 0 }, // discursiva
];

const base = { questoes, quantidade: 3, embaralharQuestoes: true, embaralharAlternativas: true };

test('gera uma cópia por pessoa, com rótulo "Prova #NN" e código de 6 caracteres sem 0/O/1/I', () => {
  const copias = gerarCopias(base);
  assert.equal(copias.length, 3);
  assert.deepEqual(copias.map((c) => c.rotulo), ['Prova #01', 'Prova #02', 'Prova #03']);
  for (const c of copias) {
    assert.equal(c.codigo.length, CODE_LENGTH);
    assert.ok([...c.codigo].every((ch) => CODE_CHARS.includes(ch)), c.codigo);
  }
});

test('ordem no formato lido pela correção: todas as questões e uma permutação das alternativas', () => {
  for (const c of gerarCopias({ ...base, quantidade: 20 })) {
    assert.deepEqual([...c.ordem.questionIds].sort(), [10, 20, 30]);
    assert.deepEqual([...c.ordem.alternativesOrder[10]].sort(), [0, 1, 2, 3]);
    assert.deepEqual([...c.ordem.alternativesOrder[20]].sort(), [0, 1, 2]);
    assert.deepEqual(c.ordem.alternativesOrder[30], []);
  }
});

test('sem embaralhar, mantém a ordem da prova e a ordem original das alternativas', () => {
  const [c] = gerarCopias({ ...base, quantidade: 1, embaralharQuestoes: false, embaralharAlternativas: false });
  assert.deepEqual(c.ordem.questionIds, [10, 20, 30]);
  assert.deepEqual(c.ordem.alternativesOrder, { 10: [0, 1, 2, 3], 20: [0, 1, 2], 30: [] });
});

test('embaralha questões e alternativas de forma independente', () => {
  const random = sequencia([0, 0.99, 0.5, 0.1, 0.7, 0.3]);
  const [soQuestoes] = gerarCopias({ ...base, quantidade: 1, embaralharAlternativas: false, random });
  assert.deepEqual(soQuestoes.ordem.alternativesOrder[10], [0, 1, 2, 3]);
  const [soAlternativas] = gerarCopias({ ...base, quantidade: 1, embaralharQuestoes: false, random });
  assert.deepEqual(soAlternativas.ordem.questionIds, [10, 20, 30]);
});

test('não repete código já usado no banco nem entre as cópias novas', () => {
  // As 6 primeiras chamadas formam "AAAAAA" (já em uso), as 6 seguintes "AAAAAA" de novo e depois "BBBBBB".
  const a = 0; // CODE_CHARS[0] = 'A'
  const b = 1 / CODE_CHARS.length + 0.001; // CODE_CHARS[1] = 'B'
  const random = sequencia([...Array(12).fill(a), ...Array(6).fill(b), ...Array(6).fill(a), ...Array(6).fill(b), ...Array(6).fill(0.5)]);
  const copias = gerarCopias({ ...base, quantidade: 2, embaralharQuestoes: false, embaralharAlternativas: false, codigosEmUso: ['AAAAAA'], random });
  assert.equal(copias[0].codigo, 'BBBBBB');
  assert.notEqual(copias[1].codigo, 'BBBBBB');
  assert.notEqual(copias[1].codigo, 'AAAAAA');
});

test('com alunos (T24): uma cópia por aluno, com o nome no rótulo e o aluno gravado; quantidade é ignorada', () => {
  const alunos = [{ id: 7, nome: 'Ana Souza' }, { id: 9, nome: 'Bruno Lima' }];
  const copias = gerarCopias({ ...base, quantidade: 30, alunos });
  assert.deepEqual(copias.map((c) => [c.rotulo, c.alunoId]), [['Ana Souza', 7], ['Bruno Lima', 9]]);
  assert.ok(gerarCopias(base).every((c) => c.alunoId === null)); // sem alunos: anônimas
});
