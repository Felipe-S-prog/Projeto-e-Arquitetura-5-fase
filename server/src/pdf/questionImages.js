// Carrega as imagens das questões (imagem_url) para o PDF (T25). Substitui o carregador do
// navegador (que usava Image e canvas): no servidor a imagem é baixada e entra no PDF como está,
// por isso só PNG e JPG são aceitos (os formatos que o pdf-lib incorpora). Outro formato, imagem
// grande demais ou endereço fora do ar não derrubam o PDF: a questão sai sem a imagem e o id entra
// em "failed", para a tela avisar o professor.
//
// Devolve: { images: { [idDaQuestão]: { bytes, type: 'png' | 'jpg' } }, failed: [ids] }

const TIMEOUT_MS = 8000;
const MAX_BYTES = 5 * 1024 * 1024;

// Descobre o formato pelos primeiros bytes do arquivo, não pela extensão do endereço.
export function detectImageType(bytes) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  return null;
}

async function downloadImage(url, fetchImpl) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Endereço de imagem não suportado.');

  const response = await fetchImpl(parsed, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
  if (!response.ok) throw new Error(`Imagem respondeu ${response.status}.`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Imagem grande demais.');

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error('Imagem grande demais.');

  const type = detectImageType(bytes);
  if (!type) throw new Error('A imagem precisa ser PNG ou JPG.');
  return { bytes, type };
}

export async function loadQuestionImages(questions, { fetchImpl = fetch } = {}) {
  const images = {};
  const failed = [];

  await Promise.all(
    questions
      .filter((q) => q.imageUrl)
      .map(async (question) => {
        try {
          images[question.id] = await downloadImage(question.imageUrl, fetchImpl);
        } catch {
          failed.push(question.id);
        }
      })
  );

  return { images, failed };
}
