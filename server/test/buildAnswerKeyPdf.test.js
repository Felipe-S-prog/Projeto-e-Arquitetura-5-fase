import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { buildAnswerKeyPdf } from '../src/pdf/buildAnswerKeyPdf.js';

const copia = (i, total = 5) => ({
  code: `COD${String(i).padStart(3, '0')}`,
  label: `Prova #${String(i).padStart(2, '0')}`,
  answers: Array.from({ length: total }, (_, n) => ({ number: n + 1, correctLetter: 'ABCDE'[n % 5] })),
});

test('quadros inteiros por página: 25 cópias de 5 questões ocupam 3 páginas (9 + 10 + 6)', async () => {
  const { bytes, pageCount } = await buildAnswerKeyPdf({
    exam: { title: 'P1' },
    copies: Array.from({ length: 25 }, (_, i) => copia(i + 1)),
  });
  assert.equal(pageCount, 3);
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 3);
});

test('prova de 20 questões usa duas linhas na grade e continua em uma página para poucas cópias', async () => {
  const { pageCount } = await buildAnswerKeyPdf({ exam: { title: 'P2' }, copies: [copia(1, 20), copia(2, 20)] });
  assert.equal(pageCount, 1);
});

test('sem cópias é um erro claro; caracteres fora da fonte não derrubam o PDF', async () => {
  await assert.rejects(buildAnswerKeyPdf({ exam: { title: 'P1' }, copies: [] }), /Não há cópias/);
  const { pageCount } = await buildAnswerKeyPdf({
    exam: { title: 'Limites → ∞ e √2' },
    institution: 'Católica SC',
    copies: [{ ...copia(1), label: 'Zoë 😀' }],
  });
  assert.equal(pageCount, 1);
});
