import jsQR from 'jsqr';
import { parseQrPayload } from './qrPayload.js';

// Leitura automática da folha de resposta pela foto (T63 e T64).
//
// Roteiro (docs/folha-de-resposta.md):
// 1. Ler o QR Code: dá o código da cópia e a posição da folha na foto.
// 2. Prever onde estão os 4 quadrados pretos dos cantos e procurá-los perto dali.
// 3. Com os 4 centros, calcular a homografia (pt da folha -> pixel da foto).
// 4. Medir a escuridão do miolo de cada bolinha, comparando com o papel em volta.
// 5. Decidir dentro de cada linha: em branco, uma marcada ou marcação dupla.
//
// A geometria (em pt, origem no canto superior esquerdo da página) vem da API junto com a
// cópia (server/src/services/correcao.folha.js), a mesma que desenha a folha no PDF.
// As funções recebem os pixels em formato ImageData ({ data, width, height }), então
// funcionam no navegador e nos testes.

export const MIN_PAGE_WIDTH_PX = 1000; // folha com menos de 1000 px de largura: pedir outra foto
const BLANK_LIMIT = 0.12; // bolinha mais escura abaixo disso: questão em branco
const MARKED_RATIO = 0.5; // marcadas: pelo menos metade da escuridão da mais escura
const DOUBTFUL_RATIO = 0.35; // segunda mais escura acima disso (e abaixo de 0,5): conferir
const WEAK_MARK = 0.25; // marcação única mais clara que isso: conferir
const CORE_RATIO = 0.6; // mede só o miolo da bolinha, sem o contorno impresso

export class SheetReadError extends Error {}

// ---------- QR Code ----------

// Procura o QR do SGP na imagem. Devolve { code, version, corners } ou null.
export function findSheetQr(imageData) {
  const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  if (!result) return null;
  const code = parseQrPayload(result.data);
  if (!code) return null;
  const { topLeftCorner, topRightCorner, bottomLeftCorner } = result.location;
  return { code, version: result.version, corners: { tl: topLeftCorner, tr: topRightCorner, bl: bottomLeftCorner } };
}

// ---------- Geometria ----------

function solve(matrix, vector) {
  // Eliminação de Gauss com pivô parcial.
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) throw new SheetReadError('Não foi possível alinhar a folha na foto.');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

// Transformação afim a partir de 3 pares de pontos (origem -> destino).
export function affineFrom3(src, dst) {
  const m = src.map((p) => [p.x, p.y, 1]);
  const [a, b, c] = solve(m, dst.map((p) => p.x));
  const [d, e, f] = solve(m, dst.map((p) => p.y));
  return (p) => ({ x: a * p.x + b * p.y + c, y: d * p.x + e * p.y + f });
}

// Homografia a partir de 4 pares de pontos (origem -> destino).
export function homographyFrom4(src, dst) {
  const rows = [];
  const values = [];
  src.forEach((s, i) => {
    const d = dst[i];
    rows.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]);
    values.push(d.x);
    rows.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]);
    values.push(d.y);
  });
  const [h11, h12, h13, h21, h22, h23, h31, h32] = solve(rows, values);
  return (p) => {
    const w = h31 * p.x + h32 * p.y + 1;
    return { x: (h11 * p.x + h12 * p.y + h13) / w, y: (h21 * p.x + h22 * p.y + h23) / w };
  };
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Cantos do símbolo do QR em pt. O símbolo começa 4 módulos (margem branca) para dentro da caixa.
function qrSymbolCorners(folha, version) {
  const side = 17 + 4 * version;
  const module = folha.qr.tamanho / (side + 8);
  const x0 = folha.qr.x + 4 * module;
  const y0 = folha.qr.y + 4 * module;
  const size = side * module;
  return { tl: { x: x0, y: y0 }, tr: { x: x0 + size, y: y0 }, bl: { x: x0, y: y0 + size } };
}

// ---------- Pixels ----------

function red(imageData, x, y) {
  return imageData.data[(y * imageData.width + x) * 4];
}

function percentile(values, p) {
  if (values.length === 0) return 255;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
}

// Procura o quadrado preto perto da posição prevista. Devolve o centro (px) ou null.
export function findMarker(imageData, predicted, sidePx) {
  const half = Math.ceil(1.6 * sidePx);
  const x0 = Math.max(0, Math.round(predicted.x - half));
  const y0 = Math.max(0, Math.round(predicted.y - half));
  const x1 = Math.min(imageData.width - 1, Math.round(predicted.x + half));
  const y1 = Math.min(imageData.height - 1, Math.round(predicted.y + half));
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w < 4 || h < 4) return null;

  const window = new Uint8Array(w * h);
  const samples = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = red(imageData, x0 + x, y0 + y);
      window[y * w + x] = v;
      if ((x + y) % 3 === 0) samples.push(v);
    }
  }
  const limit = percentile(samples, 0.9) * 0.5;
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) dark[i] = window[i] < limit ? 1 : 0;

  // Manchas escuras (vizinhança de 4) e escolha da que parece o quadrado esperado.
  const expectedArea = sidePx * sidePx;
  const seen = new Uint8Array(w * h);
  const stack = [];
  let best = null;
  for (let start = 0; start < w * h; start++) {
    if (!dark[start] || seen[start]) continue;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      area += 1;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h || seen[j] || !dark[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const fill = area / (boxW * boxH);
    const aspect = boxW / boxH;
    if (area < 0.45 * expectedArea || area > 1.9 * expectedArea || fill < 0.6 || aspect < 0.5 || aspect > 2) continue;
    const center = { x: x0 + sx / area, y: y0 + sy / area };
    const d = distance(center, predicted);
    if (!best || d < best.d) best = { center, d };
  }
  return best ? best.center : null;
}

// Média do vermelho num círculo e valores num anel (para estimar o papel em volta).
function sampleCircle(imageData, c, radius) {
  let sum = 0;
  let count = 0;
  const r2 = radius * radius;
  for (let y = Math.floor(c.y - radius); y <= Math.ceil(c.y + radius); y++) {
    for (let x = Math.floor(c.x - radius); x <= Math.ceil(c.x + radius); x++) {
      if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) continue;
      if ((x - c.x) ** 2 + (y - c.y) ** 2 > r2) continue;
      sum += red(imageData, x, y);
      count += 1;
    }
  }
  return count ? sum / count : 255;
}

function sampleRing(imageData, c, inner, outer, out) {
  for (let y = Math.floor(c.y - outer); y <= Math.ceil(c.y + outer); y++) {
    for (let x = Math.floor(c.x - outer); x <= Math.ceil(c.x + outer); x++) {
      if (x < 0 || y < 0 || x >= imageData.width || y >= imageData.height) continue;
      const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
      if (d2 < inner * inner || d2 > outer * outer) continue;
      out.push(red(imageData, x, y));
    }
  }
}

// ---------- Decisão por linha (T64) ----------

// darkness: escuridão de cada bolinha da linha (0 = papel, 1 = preto).
// Devolve { situacao: 'MARCADA' | 'EM_BRANCO' | 'DUPLA', indice, duvidosa, motivo }.
export function decideRow(darkness) {
  const max = Math.max(...darkness);
  if (max < BLANK_LIMIT) {
    return { situacao: 'EM_BRANCO', indice: null, duvidosa: max >= 0.08, motivo: max >= 0.08 ? 'Marcação muito fraca ou rasurada' : null };
  }
  const marked = darkness.map((d, i) => (d >= MARKED_RATIO * max ? i : -1)).filter((i) => i >= 0);
  if (marked.length > 1) return { situacao: 'DUPLA', indice: null, duvidosa: true, motivo: 'Mais de uma alternativa marcada (anulada)' };

  const second = Math.max(0, ...darkness.filter((_, i) => i !== marked[0]));
  if (max < WEAK_MARK) return { situacao: 'MARCADA', indice: marked[0], duvidosa: true, motivo: 'Marcação fraca' };
  if (second >= DOUBTFUL_RATIO * max) return { situacao: 'MARCADA', indice: marked[0], duvidosa: true, motivo: 'Outra alternativa também parece marcada' };
  return { situacao: 'MARCADA', indice: marked[0], duvidosa: false, motivo: null };
}

// ---------- Leitura completa ----------

// Lê as marcações da folha. qr: resultado de findSheetQr; folha: geometria vinda da API.
// Devolve { larguraFolhaPx, respostas: [{ numero, questaoId, letra, situacao, duvidosa, motivo, escuridao }] }.
export function readAnswers(imageData, qr, folha) {
  const symbol = qrSymbolCorners(folha, qr.version);
  const fromQr = affineFrom3([symbol.tl, symbol.tr, symbol.bl], [qr.corners.tl, qr.corners.tr, qr.corners.bl]);
  const scale = (distance(qr.corners.tl, qr.corners.tr) / distance(symbol.tl, symbol.tr) + distance(qr.corners.tl, qr.corners.bl) / distance(symbol.tl, symbol.bl)) / 2;

  const found = folha.marcadores.map((m) => findMarker(imageData, fromQr(m), folha.tamanhoMarcador * scale));
  if (found.some((c) => !c)) {
    throw new SheetReadError('Não encontrei os 4 quadrados pretos dos cantos do quadro de resposta. Fotografe a folha inteira, sem cortar os cantos.');
  }
  const toPhoto = homographyFrom4(folha.marcadores, found);

  const midY = (folha.marcadores[0].y + folha.marcadores[3].y) / 2;
  const larguraFolhaPx = distance(toPhoto({ x: 0, y: midY }), toPhoto({ x: folha.pagina.largura, y: midY }));
  if (larguraFolhaPx < MIN_PAGE_WIDTH_PX) {
    throw new SheetReadError(
      `A folha ficou pequena na foto (${Math.round(larguraFolhaPx)} px de largura; o mínimo é ${MIN_PAGE_WIDTH_PX}). Aproxime a câmera até a folha ocupar a foto toda.`
    );
  }

  const respostas = folha.questoes.map((q) => {
    const bubbles = q.opcoes.map((o) => {
      const c = toPhoto({ x: o.x, y: o.y });
      const r = distance(c, toPhoto({ x: o.x + o.raio, y: o.y }));
      return { c, r };
    });
    const ring = [];
    bubbles.forEach(({ c, r }) => sampleRing(imageData, c, 1.4 * r, 1.9 * r, ring));
    const paper = Math.max(1, percentile(ring, 0.9));
    const escuridao = bubbles.map(({ c, r }) => Math.min(1, Math.max(0, 1 - sampleCircle(imageData, c, CORE_RATIO * r) / paper)));
    const decision = decideRow(escuridao);
    return {
      numero: q.numero,
      questaoId: q.questaoId,
      letra: decision.indice === null ? null : q.opcoes[decision.indice].letra,
      situacao: decision.situacao,
      duvidosa: decision.duvidosa,
      motivo: decision.motivo,
      escuridao: escuridao.map((d) => Math.round(d * 100) / 100),
    };
  });

  return { larguraFolhaPx: Math.round(larguraFolhaPx), respostas };
}

// ---------- Arquivo de imagem (navegador) ----------

const READ_MAX_SIDE = 2400; // fotos maiores são reduzidas: suficiente para a leitura e mais rápido

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
      reject(new SheetReadError('Não foi possível abrir essa imagem. Use um arquivo JPG, PNG ou WebP.'));
    };
    img.src = url;
  });
}

// Abre a foto e procura o QR. Devolve { imageData, qr }; qr é null quando não achou o QR do SGP.
export async function loadSheetPhoto(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, READ_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { imageData, qr: findSheetQr(imageData) };
}
