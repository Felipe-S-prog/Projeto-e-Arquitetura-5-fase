import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unlink } from 'node:fs/promises';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { signAccessToken } from '../src/utils/jwt.js';

const config = loadConfig({ DB_USER: 'test', DB_PASSWORD: '', DB_NAME: 'sgp_test', NODE_ENV: 'test' });
async function withApp(action) {
  const pool = { execute: async () => [[{ id: 7, nome: 'Professor', email: 'p@example.com', papel: 'PROFESSOR', status: 'ATIVO', versao_sessao: 0 }]] };
  const server = createApp({ pool, config }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try { await action(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
const token = signAccessToken({ id: 7, papel: 'PROFESSOR', versao_sessao: 0 }, config.auth.jwtSecret, 3600);

test('T48: gestão de alunos e upload exigem autenticação; ingresso antigo está desativado', async () => {
  await withApp(async (url) => {
    for (const path of ['/turmas/2/matriculas', '/turmas/2/matriculas/importar', '/questoes/upload-imagem', '/turmas/ingresso']) {
      const result = await fetch(url + '/api' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(result.status, 401, path);
    }
    const removed = await fetch(url + '/api/turmas/ingresso', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    assert.equal(removed.status, 404);
  });
});
test('T48: upload rejeita arquivo falso e aceita PNG com conteúdo válido', async () => {
  await withApp(async (url) => {
    const headers = { Authorization: `Bearer ${token}` };
    const fake = new FormData();
    fake.append('imagem', new Blob(['conteúdo inválido'], { type: 'image/png' }), 'foto.png');
    assert.equal((await fetch(url + '/api/questoes/upload-imagem', { method: 'POST', headers, body: fake })).status, 400);
    const png = new FormData();
    png.append('imagem', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGioAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'foto.png');
    const response = await fetch(url + '/api/questoes/upload-imagem', { method: 'POST', headers, body: png });
    assert.equal(response.status, 201);
    const { imageUrl } = await response.json();
    assert.match(imageUrl, /^\/uploads\/questoes\/[a-f0-9-]+\.png$/);
    try { assert.equal((await fetch(url + imageUrl)).status, 200); }
    finally { await unlink(new URL('..' + imageUrl, import.meta.url)); }
  });
});
