import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStabilityTracker, sameReading, scaleQr } from '../src/utils/liveSheet.js';

const leitura = (code, letras) => ({
  code,
  reading: { respostas: letras.map((letra, i) => ({ questaoId: 100 + i, letra, situacao: letra ? 'MARCADA' : 'EM_BRANCO' })) },
});

test('sameReading: mesma prova e mesmas letras', () => {
  assert.equal(sameReading(leitura('AAA111', ['A', 'C', null]), leitura('AAA111', ['A', 'C', null])), true);
  assert.equal(sameReading(leitura('AAA111', ['A', 'C', null]), leitura('AAA111', ['A', 'D', null])), false);
  assert.equal(sameReading(leitura('AAA111', ['A']), leitura('BBB222', ['A'])), false);
  assert.equal(sameReading(leitura('AAA111', ['A']), leitura('AAA111', ['A', 'B'])), false);
  assert.equal(sameReading(null, leitura('AAA111', ['A'])), false);
});

test('createStabilityTracker: só aceita depois de leituras iguais seguidas', () => {
  const tracker = createStabilityTracker(2);
  assert.equal(tracker.push(leitura('AAA111', ['A', 'B'])), false);
  assert.equal(tracker.push(leitura('AAA111', ['A', 'C'])), false); // mudou: recomeça a contagem
  assert.equal(tracker.push(leitura('AAA111', ['A', 'C'])), true);
});

test('createStabilityTracker: quadro sem leitura zera a contagem', () => {
  const tracker = createStabilityTracker(2);
  tracker.push(leitura('AAA111', ['A']));
  assert.equal(tracker.push(null), false);
  assert.equal(tracker.push(leitura('AAA111', ['A'])), false);
  assert.equal(tracker.push(leitura('AAA111', ['A'])), true);
  tracker.reset();
  assert.equal(tracker.count, 0);
});

test('scaleQr: leva os cantos da imagem reduzida para a imagem inteira', () => {
  const qr = { code: 'AAA111', version: 2, corners: { tl: { x: 10, y: 20 }, tr: { x: 30, y: 20 }, bl: { x: 10, y: 40 } } };
  assert.deepEqual(scaleQr(qr, 2).corners, { tl: { x: 20, y: 40 }, tr: { x: 60, y: 40 }, bl: { x: 20, y: 80 } });
  assert.equal(scaleQr(qr, 2).code, 'AAA111');
  assert.equal(scaleQr(qr, 1), qr);
  assert.equal(scaleQr(null, 2), null);
});
