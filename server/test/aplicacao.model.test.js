import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toAplicacao } from '../src/models/aplicacao.model.js';

const linha = (extra = {}) => ({
  id: 7,
  turma_id: 2,
  prova_id: 3,
  status: 'PENDENTE',
  quantidade: 30,
  data_aplicacao: null,
  embaralhar_questoes: 1,
  embaralhar_alternativas: 0,
  vincular_alunos: 1,
  ...extra,
});

test('toAplicacao: gradedCount traz as correções lançadas, para a tela travar nova geração (T58)', () => {
  assert.equal(toAplicacao(linha({ total_correcoes: 0 })).gradedCount, 0);
  assert.equal(toAplicacao(linha({ total_correcoes: '4' })).gradedCount, 4);
});

test('toAplicacao: sem a contagem na consulta, gradedCount não aparece', () => {
  assert.equal('gradedCount' in toAplicacao(linha()), false);
});

test('toAplicacao: Aplicada com todas as cópias corrigidas vira Corrigida', () => {
  const aplicada = (correcoes, copias) =>
    toAplicacao(linha({ status: 'APLICADA', total_correcoes: correcoes, total_copias: copias })).status;
  assert.equal(aplicada(5, 5), 'Corrigida');
  assert.equal(aplicada('5', '5'), 'Corrigida');
  assert.equal(aplicada(4, 5), 'Aplicada');
  assert.equal(aplicada(0, 0), 'Aplicada');
  assert.equal(toAplicacao(linha({ status: 'APLICADA' })).status, 'Aplicada');
});

test('toAplicacao: Pendente não vira Corrigida nem com correções lançadas', () => {
  assert.equal(toAplicacao(linha({ total_correcoes: 2, total_copias: 2 })).status, 'Pendente');
});

test('toAplicacao: copiesCount traz o total de cópias quando a consulta conta', () => {
  assert.equal(toAplicacao(linha({ total_copias: '3' })).copiesCount, 3);
  assert.equal('copiesCount' in toAplicacao(linha()), false);
});
