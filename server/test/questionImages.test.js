import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectImageType, loadQuestionImages } from '../src/pdf/questionImages.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const GIF = new TextEncoder().encode('GIF89a....');

// fetch falso: responde pelo endereço, sem rede.
function fakeFetch(respostas) {
  return async (url) => {
    const r = respostas[url.href];
    if (!r) throw new Error('fora do ar');
    return {
      ok: r.status === undefined || r.status === 200,
      status: r.status ?? 200,
      headers: new Map([['content-length', String(r.bytes?.length ?? 0)]]),
      arrayBuffer: async () => r.bytes.buffer,
    };
  };
}

test('detectImageType reconhece PNG e JPG pelos primeiros bytes', () => {
  assert.equal(detectImageType(PNG), 'png');
  assert.equal(detectImageType(JPG), 'jpg');
  assert.equal(detectImageType(GIF), null);
});

test('carrega PNG e JPG; outro formato, erro HTTP, endereço fora do ar ou não http viram "failed"', async () => {
  const questoes = [
    { id: 1, imageUrl: 'https://img.test/a.png' },
    { id: 2, imageUrl: 'https://img.test/b.jpg' },
    { id: 3, imageUrl: 'https://img.test/c.gif' },
    { id: 4, imageUrl: 'https://img.test/404.png' },
    { id: 5, imageUrl: 'https://img.test/fora-do-ar.png' },
    { id: 6, imageUrl: 'file:///etc/passwd' },
    { id: 7, imageUrl: null },
  ];
  const fetchImpl = fakeFetch({
    'https://img.test/a.png': { bytes: PNG },
    'https://img.test/b.jpg': { bytes: JPG },
    'https://img.test/c.gif': { bytes: GIF },
    'https://img.test/404.png': { status: 404, bytes: new Uint8Array() },
  });

  const { images, failed } = await loadQuestionImages(questoes, { fetchImpl });
  assert.deepEqual(Object.keys(images).sort(), ['1', '2']);
  assert.equal(images[1].type, 'png');
  assert.equal(images[2].type, 'jpg');
  assert.deepEqual(failed.sort(), [3, 4, 5, 6]);
});
