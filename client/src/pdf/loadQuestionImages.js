// Carrega as imagens das questões (imageUrl) e as converte em PNG, o formato que o
// montador de PDF aceita. Roda só no navegador (usa Image e canvas).
//
// Passar a imagem pelo canvas também resolve imagens SVG e fundos transparentes
// (o fundo vira branco). Se alguma imagem falhar, a questão continua no PDF sem ela
// e o id entra em "failed", para a tela poder avisar o professor.
//
// Devolve: { images: { [idDaQuestão]: { bytes, type: 'png' } }, failed: [ids] }

function loadHtmlImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
    img.src = url;
  });
}

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Falha ao converter a imagem.'));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

async function convertToPng(url, maxSide) {
  const img = await loadHtmlImage(url);
  // SVG sem largura e altura declaradas pode vir com tamanho 0
  const naturalWidth = img.naturalWidth || 600;
  const naturalHeight = img.naturalHeight || 400;
  const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0, canvas.width, canvas.height);

  return { bytes: await canvasToPngBytes(canvas), type: 'png' };
}

export async function loadQuestionImages(questions, { maxSide = 1200 } = {}) {
  const images = {};
  const failed = [];
  const withImage = questions.filter((q) => q.imageUrl);

  await Promise.all(
    withImage.map(async (question) => {
      try {
        images[question.id] = await convertToPng(question.imageUrl, maxSide);
      } catch {
        failed.push(question.id);
      }
    }),
  );

  return { images, failed };
}
