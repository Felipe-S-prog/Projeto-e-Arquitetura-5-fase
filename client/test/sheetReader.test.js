import assert from 'node:assert/strict';
import { test } from 'node:test';
import QRCode from 'qrcode';
import { folhaDaCopia } from '../../server/src/services/correcao.folha.js';
import { decideRow, findSheetQr, homographyFrom4, readAnswers, SheetReadError } from '../src/utils/sheetReader.js';
import { createStabilityTracker, scaleQr } from '../src/utils/liveSheet.js';

// Folha de teste: a mesma geometria que o servidor manda para o front (e que desenha o PDF).
function folhaCom(alternativasPorQuestao) {
  return folhaDaCopia(alternativasPorQuestao.map((n, i) => ({ questaoId: 100 + i, tipo: 'OBJETIVA', alternativas: Array.from({ length: n }) })));
}

// "Fotografa" a folha: desenha em pt e leva para pixels com uma homografia (rotação,
// perspectiva e escala), com papel levemente desigual e ruído.
// marks: { [numero]: ['A', ...] } letras pintadas em cada questão.
function photo(folha, code, marks, { width, height, corners, seed = 7, ink = [40, 60, 170] }) {
  const qr = QRCode.create(`SGP1:${code}`, { errorCorrectionLevel: 'Q' }).modules;
  const module = folha.qr.tamanho / (qr.size + 8);
  const qx = folha.qr.x + 4 * module;
  const qy = folha.qr.y + 4 * module;
  const page = [
    { x: 0, y: 0 },
    { x: folha.pagina.largura, y: 0 },
    { x: folha.pagina.largura, y: folha.pagina.altura },
    { x: 0, y: folha.pagina.altura },
  ];
  const toPt = homographyFrom4(corners, page); // pixel da foto -> pt da folha
  const half = folha.tamanhoMarcador / 2;
  const firstY = folha.questoes[0].opcoes[0].y;
  const pitch = folha.questoes.length > 1 ? folha.questoes[1].opcoes[0].y - firstY : 1;
  const filled = new Map();
  folha.questoes.forEach((q) => q.opcoes.forEach((o) => filled.set(`${q.numero}${o.letra}`, (marks[q.numero] ?? []).includes(o.letra))));

  let state = seed;
  const noise = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state / 0x7fffffff - 0.5) * 18;
  };
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = toPt({ x, y });
      let color = null;
      if (p.x < 0 || p.y < 0 || p.x > folha.pagina.largura || p.y > folha.pagina.altura) color = [70, 70, 75]; // mesa
      else {
        if (folha.marcadores.some((m) => Math.abs(p.x - m.x) <= half && Math.abs(p.y - m.y) <= half)) color = [15, 15, 15];
        const col = Math.floor((p.x - qx) / module);
        const row = Math.floor((p.y - qy) / module);
        if (!color && col >= 0 && row >= 0 && col < qr.size && row < qr.size && qr.get(row, col)) color = [15, 15, 15];
        if (!color) {
          // só a linha de bolinhas mais próxima pode conter este ponto
          const q = folha.questoes[Math.round((p.y - firstY) / pitch)];
          for (const o of q?.opcoes ?? []) {
            const d = Math.hypot(p.x - o.x, p.y - o.y);
            if (filled.get(`${q.numero}${o.letra}`) && d <= o.raio * 1.05) color = ink;
            else if (Math.abs(d - o.raio) <= 0.45) color = [120, 120, 120]; // contorno impresso
            if (color) break;
          }
        }
        if (!color) {
          const light = 238 - (p.x / folha.pagina.largura) * 25; // luz desigual
          color = [light, light - 2, light - 6];
        }
      }
      const i = (y * width + x) * 4;
      const n = noise();
      data[i] = color[0] + n;
      data[i + 1] = color[1] + n;
      data[i + 2] = color[2] + n;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const MARKS = { 1: ['A'], 2: ['C'], 4: ['B', 'D'], 5: ['E'], 6: ['B'], 7: ['A'], 8: ['D'], 9: ['C'], 10: ['B'] };

function readPhoto(folha, code, marks, options) {
  const image = photo(folha, code, marks, options);
  const qr = findSheetQr(image);
  assert.ok(qr, 'o QR deveria ser lido');
  assert.equal(qr.code, code);
  return readAnswers(image, qr, folha);
}

test('lê a folha inclinada e com perspectiva: marcadas, em branco e marcação dupla', () => {
  const folha = folhaCom(Array(10).fill(5));
  const { respostas, larguraFolhaPx } = readPhoto(folha, 'K7M2QA', MARKS, {
    width: 1500,
    height: 2000,
    corners: [{ x: 120, y: 90 }, { x: 1400, y: 160 }, { x: 1350, y: 1930 }, { x: 60, y: 1860 }],
  });
  assert.ok(larguraFolhaPx > 1200);
  assert.deepEqual(
    respostas.map((r) => [r.numero, r.letra, r.situacao]),
    [
      [1, 'A', 'MARCADA'],
      [2, 'C', 'MARCADA'],
      [3, null, 'EM_BRANCO'],
      [4, null, 'DUPLA'],
      [5, 'E', 'MARCADA'],
      [6, 'B', 'MARCADA'],
      [7, 'A', 'MARCADA'],
      [8, 'D', 'MARCADA'],
      [9, 'C', 'MARCADA'],
      [10, 'B', 'MARCADA'],
    ]
  );
  assert.equal(respostas[3].duvidosa, true); // dupla sempre vai para conferência
  assert.ok(respostas.filter((r) => r.situacao === 'MARCADA').every((r) => !r.duvidosa));
  assert.deepEqual(respostas.map((r) => r.questaoId), folha.questoes.map((q) => q.questaoId));
});

test('lê a folha de cabeça para baixo (o QR dá a orientação)', () => {
  const folha = folhaCom([4, 4, 3, 5, 2]);
  const { respostas } = readPhoto(folha, 'ZX9KPL', { 1: ['D'], 2: ['A'], 3: ['C'], 5: ['B'] }, {
    width: 1450,
    height: 1950,
    corners: [{ x: 1380, y: 1880 }, { x: 80, y: 1900 }, { x: 60, y: 70 }, { x: 1400, y: 50 }],
  });
  assert.deepEqual(respostas.map((r) => r.letra), ['D', 'A', 'C', null, 'B']);
});

test('quadro de 25 questões (bolinhas menores) também é lido', () => {
  const folha = folhaCom(Array(25).fill(4));
  const marks = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [i + 1, ['ABCD'[i % 4]]]));
  const { respostas } = readPhoto(folha, 'M4RK25', marks, {
    width: 1300,
    height: 1800,
    corners: [{ x: 40, y: 60 }, { x: 1250, y: 30 }, { x: 1280, y: 1760 }, { x: 20, y: 1740 }],
  });
  assert.deepEqual(respostas.map((r) => r.letra), Array.from({ length: 25 }, (_, i) => 'ABCD'[i % 4]));
});

test('foto com a folha pequena demais é recusada com mensagem clara', () => {
  const folha = folhaCom(Array(5).fill(4));
  const image = photo(folha, 'SMALL1', { 1: ['A'] }, {
    width: 900,
    height: 1200,
    corners: [{ x: 50, y: 40 }, { x: 860, y: 40 }, { x: 860, y: 1180 }, { x: 50, y: 1180 }],
  });
  const qr = findSheetQr(image);
  assert.ok(qr);
  assert.throws(() => readAnswers(image, qr, folha), (err) => err instanceof SheetReadError && /pequena na foto/.test(err.message));
});

test('decideRow: em branco, marcação fraca, dupla e marcação limpa', () => {
  assert.deepEqual(decideRow([0.02, 0.05, 0.03]), { situacao: 'EM_BRANCO', indice: null, duvidosa: false, motivo: null });
  assert.equal(decideRow([0.02, 0.1, 0.03]).duvidosa, true); // quase marcada: conferir
  assert.deepEqual(decideRow([0.7, 0.05, 0.04]), { situacao: 'MARCADA', indice: 0, duvidosa: false, motivo: null });
  assert.equal(decideRow([0.05, 0.18, 0.04]).duvidosa, true); // caneta fraca: conferir
  assert.equal(decideRow([0.7, 0.05, 0.66]).situacao, 'DUPLA');
  assert.equal(decideRow([0.7, 0.3, 0.05]).duvidosa, true); // segunda bolinha suja
});

// Reduz a imagem pela média de blocos (como o canvas faz no navegador) até maxSide no lado maior.
function shrink(image, maxSide) {
  const factor = Math.max(image.width, image.height) / maxSide;
  const width = Math.round(image.width / factor);
  const height = Math.round(image.height / factor);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.width - 1, Math.floor(x * factor));
      const sy = Math.min(image.height - 1, Math.floor(y * factor));
      const si = (sy * image.width + sx) * 4;
      const i = (y * width + x) * 4;
      data[i] = image.data[si];
      data[i + 1] = image.data[si + 1];
      data[i + 2] = image.data[si + 2];
      data[i + 3] = 255;
    }
  }
  return { imageData: { data, width, height }, factor: image.width / width };
}

// Quadro de câmera 1920x1080 (paisagem) com só o QR e o quadro de respostas enquadrados:
// o topo e o pé da folha ficam fora da imagem, como na leitura ao vivo.
function cameraFrame(folha, code, marks, seed) {
  return photo(folha, code, marks, {
    width: 1920,
    height: 1080,
    seed,
    corners: [{ x: 300, y: -470 }, { x: 1720, y: -440 }, { x: 1700, y: 1570 }, { x: 280, y: 1545 }],
  });
}

test('câmera ao vivo: QR achado no quadro reduzido e bolinhas lidas no quadro inteiro', () => {
  const folha = folhaCom(Array(10).fill(5));
  const frame = cameraFrame(folha, 'LIVE01', MARKS, 11);
  const small = shrink(frame, 1000);
  const qr = scaleQr(findSheetQr(small.imageData), small.factor);
  assert.ok(qr, 'o QR deveria ser lido no quadro reduzido');
  assert.equal(qr.code, 'LIVE01');
  const { respostas, larguraFolhaPx } = readAnswers(frame, qr, folha);
  assert.ok(larguraFolhaPx >= 1000, `folha com ${larguraFolhaPx} px`);
  assert.deepEqual(
    respostas.map((r) => r.letra),
    ['A', 'C', null, null, 'E', 'B', 'A', 'D', 'C', 'B']
  );
});

test('câmera ao vivo: dois quadros seguidos da mesma folha são aceitos como estáveis', () => {
  const folha = folhaCom(Array(10).fill(5));
  const tracker = createStabilityTracker(2);
  const results = [11, 23].map((seed) => {
    const frame = cameraFrame(folha, 'LIVE02', MARKS, seed);
    const small = shrink(frame, 1000);
    const qr = scaleQr(findSheetQr(small.imageData), small.factor);
    return { code: qr.code, reading: readAnswers(frame, qr, folha) };
  });
  assert.equal(tracker.push(results[0]), false);
  assert.equal(tracker.push(results[1]), true);
});
