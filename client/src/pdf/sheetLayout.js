// Geometria do quadro de resposta (a folha com o QR Code e as bolinhas).
//
// Este arquivo é a ÚNICA fonte das posições: o PDF (buildConsolidatedPdf.js) desenha
// a partir dele, e a correção automática (T30) deve usar o mesmo arquivo para saber onde
// ficam as bolinhas depois de alinhar a foto pelos 4 quadrados pretos dos cantos.
//
// Convenções: unidade = ponto (pt, 1/72 de polegada), origem no canto superior esquerdo
// da página A4 e eixo y crescendo para baixo. Quem desenha no PDF converte o y.

export const PAGE = { width: 595.28, height: 841.89 };
export const MARGIN = 42;
export const MAX_QUESTIONS = 25;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 5;
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// 20 pt: bem maior que qualquer parte do QR (o centro dos quadrados do QR tem uns 14,5 pt),
// para o leitor não confundir os marcadores com partes do QR.
export const MARKER_SIZE = 20;
export const BUBBLE_RADIUS = 4.6;
export const QR_BOX = 140; // quadrado do QR, já com a margem branca de 4 módulos
export const CARD_TOP = 276; // topo fixo do quadro de resposta
const COLUMN_PITCH = 30;

// optionCounts: lista com o número de alternativas de cada questão, na ordem impressa.
// Devolve todas as posições necessárias para desenhar (e depois ler) o quadro.
export function getSheetGeometry(optionCounts) {
  const questionCount = optionCounts.length;
  if (questionCount < 1) {
    throw new Error('A prova precisa ter pelo menos uma questão.');
  }
  if (questionCount > MAX_QUESTIONS) {
    throw new Error(
      `O quadro de resposta comporta no máximo ${MAX_QUESTIONS} questões (a prova tem ${questionCount}).`,
    );
  }
  optionCounts.forEach((count, i) => {
    if (!Number.isInteger(count) || count < MIN_OPTIONS || count > MAX_OPTIONS) {
      throw new Error(
        `A questão ${i + 1} tem ${count} alternativas; o quadro de resposta aceita de ${MIN_OPTIONS} a ${MAX_OPTIONS}.`,
      );
    }
  });

  const columnCount = Math.max(...optionCounts);
  const rowPitch = questionCount <= 20 ? 17 : 340 / questionCount;

  const left = MARGIN;
  const right = PAGE.width - MARGIN;

  const qr = { x: left + 24, y: CARD_TOP + 18, size: QR_BOX };
  const codeLabel = { cx: qr.x + qr.size / 2, y: qr.y + qr.size + 15 }; // y da linha de base

  const markerLeftX = 290;
  const labelRightX = markerLeftX + MARKER_SIZE + 32;
  const firstColumnX = labelRightX + 22;
  const lastColumnX = firstColumnX + (columnCount - 1) * COLUMN_PITCH;
  const markerRightX = lastColumnX + 22;

  const markerTopY = CARD_TOP + 18;
  const lettersTopY = markerTopY + MARKER_SIZE + 8;
  const firstRowY = lettersTopY + 18;
  const lastRowY = firstRowY + (questionCount - 1) * rowPitch;
  const lettersBottomY = lastRowY + 18;
  const markerBottomY = lettersBottomY + 8;
  const cardBottom = Math.max(markerBottomY + MARKER_SIZE, codeLabel.y + 10) + 18;

  // ordem fixa dos marcadores: superior esquerdo, superior direito, inferior direito, inferior esquerdo
  const markers = [
    { corner: 'tl', x: markerLeftX, y: markerTopY, size: MARKER_SIZE },
    { corner: 'tr', x: markerRightX, y: markerTopY, size: MARKER_SIZE },
    { corner: 'br', x: markerRightX, y: markerBottomY, size: MARKER_SIZE },
    { corner: 'bl', x: markerLeftX, y: markerBottomY, size: MARKER_SIZE },
  ];

  const columns = Array.from({ length: columnCount }, (_, j) => ({
    index: j,
    letter: OPTION_LETTERS[j],
    cx: firstColumnX + j * COLUMN_PITCH,
  }));

  const rows = optionCounts.map((count, i) => {
    const cy = firstRowY + i * rowPitch;
    return {
      index: i,
      number: i + 1,
      cy,
      labelRightX,
      options: Array.from({ length: count }, (_, j) => ({
        index: j,
        letter: OPTION_LETTERS[j],
        cx: columns[j].cx,
        cy,
        r: BUBBLE_RADIUS,
      })),
    };
  });

  return {
    page: PAGE,
    card: { x: left, y: CARD_TOP, width: right - left, height: cardBottom - CARD_TOP },
    qr,
    codeLabel,
    markers,
    columns,
    lettersTopY,
    lettersBottomY,
    rows,
  };
}

// Centros dos 4 marcadores, na ordem tl, tr, br, bl. A correção usa estes pontos para
// alinhar a foto (homografia) antes de procurar as bolinhas marcadas.
export function markerCenters(geometry) {
  return geometry.markers.map((m) => ({ x: m.x + m.size / 2, y: m.y + m.size / 2 }));
}
