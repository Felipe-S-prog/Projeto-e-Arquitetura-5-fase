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

test('imagens do upload (T12): lidas da pasta de uploads; fora dela, inexistentes ou WEBP viram "failed"', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const base = await mkdtemp(path.join(tmpdir(), 'sgp-uploads-'));
  const uploadsDir = path.join(base, 'questoes');
  await (await import('node:fs/promises')).mkdir(uploadsDir);
  await writeFile(path.join(uploadsDir, 'a.png'), PNG);
  await writeFile(path.join(uploadsDir, 'b.jpg'), JPG);
  await writeFile(path.join(uploadsDir, 'c.webp'), new TextEncoder().encode('RIFF....WEBPVP8 '));
  await writeFile(path.join(base, 'segredo.png'), PNG); // fora da pasta de uploads

  try {
    const questoes = [
      { id: 1, imageUrl: '/uploads/questoes/a.png' },
      { id: 2, imageUrl: '/uploads/questoes/b.jpg?v=2' },
      { id: 3, imageUrl: '/uploads/questoes/c.webp' },
      { id: 4, imageUrl: '/uploads/questoes/nao-existe.png' },
      { id: 5, imageUrl: '/uploads/questoes/../segredo.png' },
      { id: 6, imageUrl: '/uploads/questoes/..%2Fsegredo.png' },
      { id: 7, imageUrl: '/uploads/questoes/' },
    ];
    const fetchImpl = () => {
      throw new Error('imagem do upload não deveria ir para a rede');
    };
    const { images, failed } = await loadQuestionImages(questoes, { uploadsDir, fetchImpl });
    assert.deepEqual(Object.keys(images).sort(), ['1', '2']);
    assert.equal(images[1].type, 'png');
    assert.equal(images[2].type, 'jpg');
    assert.deepEqual(failed.sort(), [3, 4, 5, 6, 7]);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
