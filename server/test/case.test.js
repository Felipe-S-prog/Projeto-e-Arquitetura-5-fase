import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toCamelCase, toCamelCaseList } from '../src/utils/case.js';

test('toCamelCase: converte as chaves de snake_case para camelCase', () => {
  assert.deepEqual(toCamelCase({ id: 1, class_id: 2, answer_key_published_at: null, nome: 'x' }), {
    id: 1,
    classId: 2,
    answerKeyPublishedAt: null,
    nome: 'x',
  });
});

test('toCamelCase: não mexe nos valores (datas, números, textos com _)', () => {
  const date = new Date('2026-10-15T12:00:00Z');
  const result = toCamelCase({ created_at: date, score: 7.5, tag_name: 'a_b' });
  assert.equal(result.createdAt, date);
  assert.equal(result.score, 7.5);
  assert.equal(result.tagName, 'a_b');
});

test('toCamelCase: valores que não são objeto passam direto; lista converte item a item', () => {
  assert.equal(toCamelCase(undefined), undefined);
  assert.equal(toCamelCase(null), null);
  assert.deepEqual(toCamelCaseList([{ a_b: 1 }, { c_d: 2 }]), [{ aB: 1 }, { cD: 2 }]);
});
