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
