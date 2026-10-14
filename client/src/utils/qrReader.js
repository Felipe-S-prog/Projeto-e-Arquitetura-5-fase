import jsQR from 'jsqr';

// Núcleo de leitura de QR Code. Os dois modos (upload de imagem e câmera) terminam
// aqui: pegam os pixels de uma imagem e devolvem o texto gravado no QR, ou null.
// Quem interpreta o texto (e confere se é um QR do SGP) é utils/qrPayload.js.

// Decodifica o QR a partir dos pixels (ImageData) de uma imagem.
// tryInverted também tenta QR claro sobre fundo escuro; é mais lento, então só vale
// para foto enviada, não para o laço da câmera.
export function decodeImageData(imageData, { tryInverted = false } = {}) {
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: tryInverted ? 'attemptBoth' : 'dontInvert',
  });
  return result ? result.data : null;
}

// ---------- Modo 1: arquivo de imagem ----------

// Fotos de celular são grandes demais e, às vezes, só leem em outra escala.
// Por isso tentamos algumas escalas antes de desistir.
const IMAGE_MAX_SIDES = [1600, 2400, 1000];

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir essa imagem. Use um arquivo JPG, PNG ou WebP.'));
    };
    img.src = url;
  });
}

function imageDataAtScale(img, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Fundo branco: PNG com transparência viraria preto e o QR não seria encontrado.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

// Lê o QR de um arquivo de imagem. Devolve o texto do QR ou null se não achar nenhum.
export async function readQrFromFile(file) {
  const img = await loadImage(file);
  const tried = new Set();
  for (const maxSide of IMAGE_MAX_SIDES) {
    const imageData = imageDataAtScale(img, maxSide);
    const key = `${imageData.width}x${imageData.height}`;
    if (tried.has(key)) continue;
    tried.add(key);
    const text = decodeImageData(imageData, { tryInverted: true });
    if (text) return text;
  }
  return null;
}

// ---------- Modo 2: câmera ----------

// Câmera só existe em página segura (https ou localhost) e em navegador com suporte.
export function cameraSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export function describeCameraError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'O navegador bloqueou o acesso à câmera. Libere a permissão na barra de endereço e tente de novo.';
    case 'NotFoundError':
      return 'Nenhuma câmera foi encontrada neste dispositivo.';
    case 'NotReadableError':
      return 'A câmera está em uso por outro programa. Feche-o e tente de novo.';
    default:
      return 'Não foi possível abrir a câmera.';
  }
}

// Liga a câmera e mostra a imagem no elemento <video>. Prefere a câmera traseira
// (celular); no computador usa a webcam. Devolve o stream, que deve ser passado
// para stopCamera quando terminar.
export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  await video.play();
  return stream;
}

export function stopCamera(stream, video) {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  if (video) video.srcObject = null;
}

// Laço de leitura: a cada intervalMs copia o quadro atual do vídeo para um canvas e
// tenta decodificar. Para cada QR encontrado chama onText(texto); se onText devolver
// true, o laço termina. Devolve uma função que interrompe o laço.
export function scanVideo(video, onText, { intervalMs = 150, maxSide = 960 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let stopped = false;
  let timer = null;

  const tick = () => {
    if (stopped) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.round(video.videoWidth * scale);
      const height = Math.round(video.videoHeight * scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.drawImage(video, 0, 0, width, height);
      const text = decodeImageData(ctx.getImageData(0, 0, width, height));
      if (text && onText(text)) return;
    }
    timer = setTimeout(tick, intervalMs);
  };

  timer = setTimeout(tick, 0);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
