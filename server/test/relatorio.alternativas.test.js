import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distribuicaoDasAlternativas } from '../src/services/relatorio.alternativas.js';

// Questão 10: 4 alternativas, a correta é a C (ordem 2). Questão 20: 2 alternativas, a correta é a A.
const ALTERNATIVAS = [
  { questaoId: 20, ordem: 1, texto: 'Falso', correta: false },
  { questaoId: 10, ordem: 0, texto: '1', correta: false },
  { questaoId: 10, ordem: 1, texto: '2', correta: false },
  { questaoId: 10, ordem: 2, texto: '3', correta: true },
  { questaoId: 10, ordem: 3, texto: '4', correta: false },
  { questaoId: 20, ordem: 0, texto: 'Verdadeiro', correta: true },
];

// Versão 1 imprime as alternativas na ordem cadastrada; a versão 2 imprime de trás para frente.
const V1 = { 10: [0, 1, 2, 3], 20: [0, 1] };
const V2 = { 10: [3, 2, 1, 0], 20: [1, 0] };
const resposta = (questaoId, letraMarcada, alternativesOrder) => ({ questaoId, letraMarcada, alternativesOrder });

const quantidades = (d) => Object.fromEntries(d.alternativas.map((a) => [a.letra, a.quantidade]));

test('versões embaralhadas somam na alternativa original, não na letra impressa', () => {
  const d = distribuicaoDasAlternativas(ALTERNATIVAS, [
    resposta(10, 'C', V1), // versão 1, letra C impressa = alternativa C ("3")
    resposta(10, 'B', V2), // versão 2, letra B impressa = original 2 = alternativa C ("3")
    resposta(10, 'A', V2), // versão 2, letra A impressa = original 3 = alternativa D ("4")
  ]).get(10);

  assert.deepEqual(quantidades(d), { A: 0, B: 0, C: 2, D: 1 });
  assert.deepEqual(d.maisMarcadas, ['C']);
  assert.deepEqual(
    d.alternativas.map((a) => [a.letra, a.texto, a.correta, a.percentual]),
    [['A', '1', false, 0], ['B', '2', false, 0], ['C', '3', true, 66.67], ['D', '4', false, 33.33]],
  );
});

test('em branco e anulada (marcação dupla, gravada sem letra) entram juntas e contam no total', () => {
  const d = distribuicaoDasAlternativas(ALTERNATIVAS, [
    resposta(20, 'A', V1),
    resposta(20, null, V1), // em branco
    resposta(20, null, V2), // anulada por marcação dupla
    resposta(20, 'A', V2), // versão 2: A impressa = original 1 = alternativa B ("Falso")
  ]).get(20);

  assert.equal(d.respostas, 4);
  assert.deepEqual(d.emBranco, { quantidade: 2, percentual: 50 });
  assert.deepEqual(quantidades(d), { A: 1, B: 1 });
  assert.deepEqual(d.alternativas.map((a) => a.percentual), [25, 25]);
  assert.deepEqual(d.maisMarcadas, ['A', 'B']); // empate
});

test('questão sem respostas: zero em tudo, percentuais nulos e nenhuma mais marcada', () => {
  const d = distribuicaoDasAlternativas(ALTERNATIVAS, [resposta(20, 'A', V1)]).get(10);
  assert.equal(d.respostas, 0);
  assert.deepEqual(d.emBranco, { quantidade: 0, percentual: null });
  assert.ok(d.alternativas.every((a) => a.quantidade === 0 && a.percentual === null));
  assert.deepEqual(d.maisMarcadas, []);
});

test('todas em branco: nenhuma alternativa aparece como a mais marcada', () => {
  const d = distribuicaoDasAlternativas(ALTERNATIVAS, [resposta(10, null, V1), resposta(10, null, V2)]).get(10);
  assert.deepEqual(d.emBranco, { quantidade: 2, percentual: 100 });
  assert.deepEqual(d.maisMarcadas, []);
});

test('resposta de questão sem alternativas (discursiva) é ignorada e letra inexistente não vira alternativa', () => {
  const resultado = distribuicaoDasAlternativas(ALTERNATIVAS, [resposta(30, 'A', {}), resposta(20, 'D', V1)]);
  assert.equal(resultado.has(30), false);
  const d = resultado.get(20);
  assert.equal(d.respostas, 1);
  assert.deepEqual(quantidades(d), { A: 0, B: 0 });
  assert.equal(d.emBranco.quantidade, 1);
});

test('cópia sem ordem gravada (sem embaralhar) usa a letra impressa como a original', () => {
  const d = distribuicaoDasAlternativas(ALTERNATIVAS, [resposta(10, 'D', {})]).get(10);
  assert.deepEqual(quantidades(d), { A: 0, B: 0, C: 0, D: 1 });
});
