import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTag, normalizeTags, suggestTags } from '../src/utils/tags.js';
import * as client from '../../client/src/utils/tags.js';

test('T79: acentos, caixa, espaços e aliases conhecidos viram uma tag única', () => {
  assert.deepEqual(normalizeTags(['Matematica', ' matemática ', 'MAT', 'matemat', 'Matemática']), ['matematica']);
  assert.equal(normalizeTag('  ÁLGEBRA   Linear '), 'algebra linear');
  assert.deepEqual(normalizeTags(['análise', 'analise', 'análise de dados']), ['analise', 'analise de dados']);
  assert.notEqual(normalizeTag('matriz'), normalizeTag('mat'));
  assert.equal(normalizeTag('constructor'), 'constructor');
  assert.equal(normalizeTag('__proto__'), '__proto__');
});
test('T79: sugestões consideram a última tag e não repetem selecionadas', () => {
  assert.deepEqual(suggestTags(['Matemática', 'mat', 'Álgebra', 'Geometria'], 'mat, ál'), ['algebra']);
  assert.deepEqual(suggestTags(['Álgebra', 'algebra'], ''), ['algebra']);
  assert.equal(suggestTags(Array.from({ length: 30 }, (_, i) => 'tag ' + i), '').length, 12);
});
test('T79: cliente e API usam a mesma normalização', () => {
  const values = ['Mat', 'matemat', 'matemática', ' FÍSICA ', 'Álgebra   Linear', 'análise', 'Matemática'];
  assert.deepEqual(client.normalizeTags(values), normalizeTags(values));
  for (const value of values) assert.equal(client.normalizeTag(value), normalizeTag(value));
});
