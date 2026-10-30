import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Carrega as imagens das questões (imagem_url) para o PDF (T25). Substitui o carregador do
// navegador (que usava Image e canvas): no servidor a imagem entra no PDF como está, por isso
// só PNG e JPG são aceitos (os formatos que o pdf-lib incorpora). Outro formato (ex.: WEBP ou GIF
// enviados pelo upload), imagem grande demais ou endereço fora do ar não derrubam o PDF: a questão
// sai sem a imagem e o id entra em "failed", para a tela avisar o professor.
//
// Dois tipos de endereço:
// - "/uploads/questoes/<arquivo>": imagem enviada pelo upload da T12, lida direto do disco;
// - "http(s)://...": imagem de fora, baixada com tempo e tamanho limitados.
//
// Devolve: { images: { [idDaQuestão]: { bytes, type: 'png' | 'jpg' } }, failed: [ids] }

const TIMEOUT_MS = 8000;
const MAX_BYTES = 5 * 1024 * 1024;
const UPLOADS_PREFIX = '/uploads/questoes/';
// Mesma pasta em que routes/upload-imagem.routes.js grava (server/uploads/questoes).
const UPLOADS_DIR = fileURLToPath(new URL('../../uploads/questoes/', import.meta.url));

// Descobre o formato pelos primeiros bytes do arquivo, não pela extensão do endereço.
export function detectImageType(bytes) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  return null;
}

function comTipo(bytes) {
  const type = detectImageType(bytes);
  if (!type) throw new Error('A imagem precisa ser PNG ou JPG.');
  return { bytes, type };
}

// Só lê arquivos que estão DENTRO da pasta de uploads: "/uploads/questoes/../../.env" é recusado.
async function readUploadedImage(url, uploadsDir) {
  const nome = decodeURIComponent(url.slice(UPLOADS_PREFIX.length).split(/[?#]/)[0]);
  const pasta = path.resolve(uploadsDir);
  const arquivo = path.resolve(pasta, nome);
  if (!nome || path.dirname(arquivo) !== pasta) throw new Error('Endereço de imagem inválido.');

  const info = await stat(arquivo);
  if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Imagem inválida ou grande demais.');
  return comTipo(new Uint8Array(await readFile(arquivo)));
}

async function downloadImage(url, fetchImpl) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Endereço de imagem não suportado.');

  const response = await fetchImpl(parsed, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
  if (!response.ok) throw new Error(`Imagem respondeu ${response.status}.`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Imagem grande demais.');

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error('Imagem grande demais.');
  return comTipo(bytes);
}

export async function loadQuestionImages(questions, { fetchImpl = fetch, uploadsDir = UPLOADS_DIR } = {}) {
  const images = {};
  const failed = [];

  await Promise.all(
    questions
      .filter((q) => q.imageUrl)
      .map(async (question) => {
        try {
          images[question.id] = question.imageUrl.startsWith(UPLOADS_PREFIX)
            ? await readUploadedImage(question.imageUrl, uploadsDir)
            : await downloadImage(question.imageUrl, fetchImpl);
        } catch {
          failed.push(question.id);
        }
      })
  );

  return { images, failed };
}
