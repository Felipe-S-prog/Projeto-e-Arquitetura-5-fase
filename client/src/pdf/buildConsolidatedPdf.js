import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getQrMatrix } from '../utils/qrCode';
import { buildQrPath } from '../utils/qrPath';
import { sanitizeText, wrapText } from './pdfText';
import { PAGE, MARGIN, getSheetGeometry } from './sheetLayout';

// Módulo de montagem do PDF consolidado (T22).
// Recebe a prova, as cópias já geradas (com a ordem embaralhada de cada uma) e devolve
// UM PDF com todas as cópias em sequência. Não depende do banco de dados nem de tela:
// quem chama passa os dados e recebe os bytes do arquivo (a ligação com o botão
// "Baixar todas em PDF" é a T25).
//
// Cada cópia tem: página 1 (cabeçalho, orientações e quadro de resposta com QR Code)
// seguida das páginas de questões, na ordem e com as alternativas da própria cópia.

const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const INK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.42, 0.42, 0.45);
const LIGHT = rgb(0.72, 0.72, 0.75);
const BUBBLE = rgb(0.45, 0.45, 0.48);

const DEFAULT_INSTRUCTIONS = [
  'Responda no quadro de resposta com caneta azul ou preta. Não use lápis.',
  'Preencha totalmente a bolinha da alternativa escolhida. Não use X, risco ou círculo.',
  'Marcar mais de uma alternativa na mesma questão anula a questão.',
  'Não rasure o quadro de resposta e não escreva fora das bolinhas.',
  'Não dobre, amasse nem manche esta folha: o QR Code e os quadrados pretos dos cantos precisam estar íntegros para a correção.',
  'O código impresso abaixo do QR Code identifica a sua prova.',
];

const INSTRUCTIONS_BOX = { y: 160, height: 110 };
const LEFT_BLOCK_RIGHT = 453; // limite direito do bloco de título (a caixa de nota fica depois)
const Q_MARGIN_X = 50;
const Q_TOP = 72;
const Q_BOTTOM = 800;
const QUESTION_GAP = 14;
const IMAGE_MAX = { width: 260, height: 170 };

const toPdfY = (y) => PAGE.height - y;

// ---------------------------------------------------------------------------
// Funções de desenho. Todas recebem y "de cima para baixo" (linha de base do texto).
// ---------------------------------------------------------------------------

function drawLeft(page, str, { x, y, size, font, color = INK }) {
  page.drawText(str, { x, y: toPdfY(y), size, font, color });
}

function drawCentered(page, str, { cx, y, size, font, color = INK }) {
  const w = font.widthOfTextAtSize(str, size);
  page.drawText(str, { x: cx - w / 2, y: toPdfY(y), size, font, color });
}

function drawRight(page, str, { rightX, y, size, font, color = INK }) {
  const w = font.widthOfTextAtSize(str, size);
  page.drawText(str, { x: rightX - w, y: toPdfY(y), size, font, color });
}

function drawBox(page, { x, y, width, height }, { color = LIGHT, thickness = 0.8 } = {}) {
  page.drawRectangle({
    x,
    y: toPdfY(y + height),
    width,
    height,
    borderColor: color,
    borderWidth: thickness,
  });
}

function drawHLine(page, x1, x2, y, { color = LIGHT, thickness = 0.6 } = {}) {
  page.drawLine({
    start: { x: x1, y: toPdfY(y) },
    end: { x: x2, y: toPdfY(y) },
    color,
    thickness,
  });
}

// "(1,5 pontos)", "(1,0 ponto)". Devolve '' quando a questão não tem pontuação.
function formatScore(score) {
  const n = Number(score);
  if (score === null || score === undefined || !Number.isFinite(n)) return '';
  let s = String(Math.round(n * 100) / 100);
  if (!s.includes('.')) s += '.0';
  return `(${s.replace('.', ',')} ${n > 0 && n <= 1 ? 'ponto' : 'pontos'})`;
}

// Reduz a fonte até o texto caber em uma linha; se ainda não couber, corta com "...".
function fitSingleLine(str, font, size, maxWidth, minSize = 8) {
  let s = size;
  while (s > minSize && font.widthOfTextAtSize(str, s) > maxWidth) s -= 0.5;
  let text = str;
  if (font.widthOfTextAtSize(text, s) > maxWidth) {
    while (text.length > 1 && font.widthOfTextAtSize(`${text}...`, s) > maxWidth) {
      text = text.slice(0, -1);
    }
    text = `${text.trimEnd()}...`;
  }
  return { text, size: s };
}

// ---------------------------------------------------------------------------
// Preparação dos dados de cada cópia
// ---------------------------------------------------------------------------

// Monta as questões como serão impressas na cópia: na ordem da cópia e com as
// alternativas na ordem embaralhada dela (letras A, B, C... seguem a ordem impressa).
function printedQuestionsOf(copy, questionsById) {
  return copy.questionIds.map((id) => {
    const question = questionsById.get(String(id));
    if (!question) {
      throw new Error(`A cópia ${copy.code} usa a questão ${id}, que não foi informada.`);
    }
    const original = question.alternatives || [];
    const order = copy.alternativesOrder?.[id] ?? original.map((_, i) => i);
    if (order.length !== original.length) {
      throw new Error(
        `A cópia ${copy.code} tem a ordem das alternativas da questão ${id} diferente da questão original.`,
      );
    }
    return {
      question,
      alternatives: order.map((originalIndex, position) => {
        const alt = original[originalIndex];
        if (!alt) {
          throw new Error(`A cópia ${copy.code} aponta para uma alternativa inexistente na questão ${id}.`);
        }
        return { letter: String.fromCharCode(65 + position), text: alt.text };
      }),
    };
  });
}

// ---------------------------------------------------------------------------
// Página 1: cabeçalho, orientações e quadro de resposta
// ---------------------------------------------------------------------------

function fitInstructions(ctx, instructions, innerWidth) {
  const { font } = ctx;
  for (let size = 8.5; size >= 7; size -= 0.5) {
    const lineHeight = size * 1.3;
    const items = instructions.map((text) => wrapText(ctx.clean(text), font, size, innerWidth - 12));
    const lineCount = items.reduce((sum, lines) => sum + lines.length, 0);
    const height = 26 + lineCount * lineHeight + (items.length - 1) * 2;
    if (height <= INSTRUCTIONS_BOX.height - 6) return { size, lineHeight, items };
  }
  throw new Error('As orientações são longas demais para o espaço reservado na primeira página.');
}

function drawHeader(ctx, page, copy) {
  const { font, bold, clean, meta } = ctx;

  let titleY = 62;
  if (meta.institution) {
    drawLeft(page, fitSingleLine(clean(meta.institution), font, 9, LEFT_BLOCK_RIGHT - MARGIN).text, {
      x: MARGIN,
      y: 50,
      size: 9,
      font,
      color: GRAY,
    });
    titleY = 72;
  }

  const titleWidth = LEFT_BLOCK_RIGHT - MARGIN;
  let titleLines = wrapText(clean(meta.title), bold, 15, titleWidth);
  if (titleLines.length > 2) {
    const second = fitSingleLine(`${titleLines[1]} ${titleLines.slice(2).join(' ')}`, bold, 15, titleWidth, 15);
    titleLines = [titleLines[0], second.text];
  }
  titleLines.forEach((line, i) => {
    drawLeft(page, line, { x: MARGIN, y: titleY + i * 19, size: 15, font: bold });
  });

  const subtitle = [
    meta.className ? `Turma: ${meta.className}` : '',
    meta.date ? `Data: ${meta.date}` : '',
  ]
    .filter(Boolean)
    .join('     ');
  if (subtitle) {
    const fitted = fitSingleLine(clean(subtitle), font, 10, titleWidth);
    drawLeft(page, fitted.text, {
      x: MARGIN,
      y: titleY + (titleLines.length - 1) * 19 + 17,
      size: fitted.size,
      font,
      color: GRAY,
    });
  }

  // caixa da nota
  const noteBox = { x: PAGE.width - MARGIN - 90, y: 40, width: 90, height: 62 };
  drawBox(page, noteBox, { color: INK, thickness: 0.8 });
  drawHLine(page, noteBox.x, noteBox.x + noteBox.width, noteBox.y + 16, { color: INK, thickness: 0.8 });
  drawCentered(page, 'NOTA', { cx: noteBox.x + noteBox.width / 2, y: noteBox.y + 11.5, size: 9, font: bold });

  // estudante e matrícula
  drawLeft(page, 'ESTUDANTE:', { x: MARGIN, y: 127, size: 10, font: bold });
  drawHLine(page, 118, LEFT_BLOCK_RIGHT, 129.5, { color: INK });
  if (copy.studentName) {
    const name = fitSingleLine(clean(copy.studentName), font, 11, LEFT_BLOCK_RIGHT - 122 - 2);
    drawLeft(page, name.text, { x: 122, y: 126, size: name.size, font });
  }
  drawLeft(page, 'MATRÍCULA:', { x: MARGIN, y: 150, size: 10, font: bold });
  drawHLine(page, 118, 300, 152.5, { color: INK });
}

function drawInstructions(ctx, page, layout) {
  const { font, bold } = ctx;
  const box = {
    x: MARGIN,
    y: INSTRUCTIONS_BOX.y,
    width: PAGE.width - 2 * MARGIN,
    height: INSTRUCTIONS_BOX.height,
  };
  drawBox(page, box);
  drawLeft(page, 'ORIENTAÇÕES PARA O PREENCHIMENTO', {
    x: box.x + 12,
    y: box.y + 16,
    size: 8.5,
    font: bold,
    color: GRAY,
  });
  let y = box.y + 32;
  layout.items.forEach((lines) => {
    lines.forEach((line, i) => {
      if (i === 0) drawLeft(page, '•', { x: box.x + 12, y, size: layout.size, font });
      drawLeft(page, line, { x: box.x + 24, y, size: layout.size, font });
      y += layout.lineHeight;
    });
    y += 2;
  });
}

function drawQr(page, geometry, code) {
  const matrix = getQrMatrix(code);
  const moduleSize = geometry.qr.size / (matrix.size + 8); // 4 módulos de margem branca de cada lado
  page.drawSvgPath(buildQrPath(matrix.size, matrix.isDark), {
    x: geometry.qr.x + 4 * moduleSize,
    y: toPdfY(geometry.qr.y + 4 * moduleSize),
    scale: moduleSize,
    color: BLACK,
    borderWidth: 0,
  });
}

function drawAnswerCard(ctx, page, geometry, code) {
  const { font, bold } = ctx;

  drawBox(page, geometry.card, { color: INK, thickness: 1 });
  drawLeft(page, 'QUADRO DE RESPOSTA', {
    x: geometry.card.x + 12,
    y: geometry.card.y + 12,
    size: 7.5,
    font: bold,
    color: GRAY,
  });

  drawQr(page, geometry, code);
  drawCentered(page, `Prova: ${code}`, {
    cx: geometry.codeLabel.cx,
    y: geometry.codeLabel.y,
    size: 11,
    font: bold,
  });

  geometry.markers.forEach((m) => {
    page.drawRectangle({
      x: m.x,
      y: toPdfY(m.y + m.size),
      width: m.size,
      height: m.size,
      color: BLACK,
    });
  });

  geometry.columns.forEach((col) => {
    drawCentered(page, col.letter, { cx: col.cx, y: geometry.lettersTopY + 8, size: 9, font: bold, color: GRAY });
    drawCentered(page, col.letter, { cx: col.cx, y: geometry.lettersBottomY - 4, size: 9, font: bold, color: GRAY });
  });

  geometry.rows.forEach((row) => {
    drawRight(page, `Q.${row.number}`, {
      rightX: row.labelRightX,
      y: row.cy + 3.2,
      size: 9,
      font: bold,
    });
    row.options.forEach((o) => {
      page.drawCircle({
        x: o.cx,
        y: toPdfY(o.cy),
        size: o.r,
        color: WHITE,
        borderColor: BUBBLE,
        borderWidth: 0.8,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Páginas de questões
// ---------------------------------------------------------------------------

function drawRunningHeader(ctx, page, copy) {
  drawLeft(page, fitSingleLine(ctx.clean(ctx.meta.title), ctx.font, 8, 330, 8).text, {
    x: Q_MARGIN_X,
    y: 36,
    size: 8,
    font: ctx.font,
    color: GRAY,
  });
  drawRight(page, ctx.clean(copy.studentName || `Prova ${copy.code}`), {
    rightX: PAGE.width - Q_MARGIN_X,
    y: 36,
    size: 8,
    font: ctx.font,
    color: GRAY,
  });
  drawHLine(page, Q_MARGIN_X, PAGE.width - Q_MARGIN_X, 44);
}

function fitImage(embedded) {
  const scale = Math.min(1, IMAGE_MAX.width / embedded.width, IMAGE_MAX.height / embedded.height);
  return { width: embedded.width * scale, height: embedded.height * scale };
}

// Transforma uma questão em "pedaços" (linhas de texto e imagem), cada um com sua altura.
// Assim a questão pode ser medida inteira antes de decidir em qual página ela entra.
function layoutQuestion(ctx, number, printed) {
  const { font, bold, clean } = ctx;
  const { question, alternatives } = printed;
  const pieces = [];

  const statementText = clean(
    [question.excerpt ?? question.statement ?? '', formatScore(question.score)].filter(Boolean).join(' '),
  );
  const textX = Q_MARGIN_X + 20;
  const statementLines = wrapText(statementText, font, 10.5, PAGE.width - Q_MARGIN_X - textX);
  statementLines.forEach((line, i) => {
    pieces.push({
      h: 13.5,
      draw: (page, y) => {
        if (i === 0) drawLeft(page, `${number}.`, { x: Q_MARGIN_X, y: y + 10, size: 10.5, font: bold });
        drawLeft(page, line, { x: textX, y: y + 10, size: 10.5, font });
      },
    });
  });

  const embedded = ctx.images.get(String(question.id));
  if (embedded) {
    const dims = fitImage(embedded);
    pieces.push({
      h: dims.height + 10,
      draw: (page, y) => {
        page.drawImage(embedded.image, {
          x: textX,
          y: toPdfY(y + 4 + dims.height),
          width: dims.width,
          height: dims.height,
        });
      },
    });
  }

  alternatives.forEach((alt) => {
    const lines = wrapText(clean(alt.text), font, 10, PAGE.width - Q_MARGIN_X - (Q_MARGIN_X + 38));
    lines.forEach((line, i) => {
      pieces.push({
        h: i === lines.length - 1 ? 16 : 13,
        draw: (page, y) => {
          if (i === 0) drawLeft(page, `${alt.letter})`, { x: Q_MARGIN_X + 20, y: y + 10, size: 10, font: bold });
          drawLeft(page, line, { x: Q_MARGIN_X + 38, y: y + 10, size: 10, font });
        },
      });
    });
  });

  return pieces;
}

function placeQuestion(ctx, pieces) {
  const total = pieces.reduce((sum, p) => sum + p.h, 0);
  const bodyHeight = Q_BOTTOM - Q_TOP;
  const atTop = !ctx.page || ctx.y <= Q_TOP;

  // A questão inteira fica na mesma página, a não ser que seja maior que uma página.
  if (!ctx.page || (!atTop && total > Q_BOTTOM - ctx.y && total <= bodyHeight)) {
    ctx.newQuestionPage();
  }
  pieces.forEach((piece) => {
    if (ctx.y + piece.h > Q_BOTTOM && ctx.y > Q_TOP) ctx.newQuestionPage();
    piece.draw(ctx.page, ctx.y);
    ctx.y += piece.h;
  });
  ctx.y += QUESTION_GAP;
}

// ---------------------------------------------------------------------------
// Uma cópia completa
// ---------------------------------------------------------------------------

function renderCopy(ctx, prepared, mode, duplex) {
  const { doc, font } = ctx;
  const { copy, printed, geometry } = prepared;

  const pages = [];
  const firstPage = doc.addPage([PAGE.width, PAGE.height]);
  pages.push(firstPage);

  drawHeader(ctx, firstPage, copy);
  drawInstructions(ctx, firstPage, ctx.instructionsLayout);
  drawAnswerCard(ctx, firstPage, geometry, copy.code);

  if (mode === 'completo') {
    ctx.page = null;
    ctx.y = Q_TOP;
    ctx.newQuestionPage = () => {
      const page = doc.addPage([PAGE.width, PAGE.height]);
      pages.push(page);
      drawRunningHeader(ctx, page, copy);
      ctx.page = page;
      ctx.y = Q_TOP;
    };
    printed.forEach((item, i) => {
      placeQuestion(ctx, layoutQuestion(ctx, i + 1, item));
    });
  }

  // Impressão frente e verso: cada cópia termina em página par, para a próxima
  // cópia não começar no verso desta.
  if (duplex && pages.length % 2 === 1) {
    const blank = doc.addPage([PAGE.width, PAGE.height]);
    pages.push(blank);
    drawCentered(blank, '(página em branco)', {
      cx: PAGE.width / 2,
      y: PAGE.height / 2,
      size: 9,
      font,
      color: LIGHT,
    });
  }

  pages.forEach((page, i) => {
    drawCentered(page, `Prova ${copy.code}   |   Página ${i + 1} de ${pages.length}`, {
      cx: PAGE.width / 2,
      y: 820,
      size: 8,
      font,
      color: GRAY,
    });
  });

  return pages.length;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

// Parâmetros:
//   exam:         { title }
//   className, date, institution: texto do cabeçalho (opcionais)
//   questions:    questões da prova: { id, excerpt (ou statement), alternatives: [{ text }], score, imageUrl }
//   copies:       cópias geradas (utils/answerKey.js): { code, label, studentName, questionIds, alternativesOrder }
//   images:       { [idDaQuestão]: { bytes: Uint8Array, type: 'png' | 'jpg' } } (ver loadQuestionImages.js)
//   mode:         'completo' (folha + questões) ou 'folha-de-resposta' (só a folha de cada cópia)
//   duplex:       true para cada cópia terminar em página par (impressão frente e verso)
//   instructions: lista de orientações impressas na primeira página
//   creationDate: data gravada no arquivo (fixa, para o PDF ser reprodutível)
//
// Devolve: { bytes, pageCount, copies: [{ code, label, firstPage, pageCount }], warnings }
export async function buildConsolidatedPdf({
  exam,
  className,
  date,
  institution,
  questions,
  copies,
  images = {},
  mode = 'completo',
  duplex = false,
  instructions = DEFAULT_INSTRUCTIONS,
  creationDate = new Date(),
}) {
  if (!Array.isArray(copies) || copies.length === 0) {
    throw new Error('Não há cópias para gerar o PDF.');
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('A prova não tem questões.');
  }
  if (mode !== 'completo' && mode !== 'folha-de-resposta') {
    throw new Error(`Modo de PDF desconhecido: ${mode}`);
  }

  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const charset = new Set(font.getCharacterSet());
  const clean = (text) => sanitizeText(text, charset);

  const title = exam?.title || 'Prova';
  doc.setTitle(clean(title));
  doc.setCreator('SGP');
  doc.setProducer('SGP (pdf-lib)');
  doc.setLanguage('pt-BR');
  doc.setCreationDate(creationDate);
  doc.setModificationDate(creationDate);

  const warnings = [];
  const questionsById = new Map(questions.map((q) => [String(q.id), q]));

  // Prepara TODAS as cópias antes de desenhar: se alguma estiver inválida, o erro
  // aparece antes de qualquer página ser montada.
  const prepared = copies.map((copy) => {
    const printed = printedQuestionsOf(copy, questionsById);
    const geometry = getSheetGeometry(printed.map((p) => p.alternatives.length));
    return { copy, printed, geometry };
  });

  // Cada imagem é incorporada uma única vez e reaproveitada por todas as cópias.
  const embeddedImages = new Map();
  for (const [id, img] of Object.entries(images)) {
    try {
      const image = img.type === 'jpg' ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes);
      embeddedImages.set(String(id), { image, width: image.width, height: image.height });
    } catch {
      warnings.push(`Não foi possível incluir a imagem da questão ${id} no PDF.`);
    }
  }

  const ctx = {
    doc,
    font,
    bold,
    clean,
    images: embeddedImages,
    meta: { title, className, date, institution },
    page: null,
    y: Q_TOP,
    newQuestionPage: null,
    instructionsLayout: null,
  };
  ctx.instructionsLayout = fitInstructions(ctx, instructions, PAGE.width - 2 * MARGIN - 24);

  const summary = [];
  let nextPage = 1;
  for (const item of prepared) {
    const pageCount = renderCopy(ctx, item, mode, duplex);
    summary.push({
      code: item.copy.code,
      label: item.copy.label,
      firstPage: nextPage,
      pageCount,
    });
    nextPage += pageCount;
  }

  const bytes = await doc.save();
  return { bytes, pageCount: doc.getPageCount(), copies: summary, warnings };
}
