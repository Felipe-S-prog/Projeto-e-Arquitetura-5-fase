import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sanitizeText } from './pdfText.js';
import { MARGIN, PAGE } from './sheetLayout.js';

// Montador do PDF do gabarito (T27). Um arquivo só, para o professor enviar às pessoas
// (ex.: pelo Teams): para cada cópia, um quadro com o rótulo, o código impresso e a letra
// certa de cada questão, na ordem impressa daquela cópia. Nunca traz nota ou pontuação.
// Não depende do banco: quem chama (services/pdf.service.js) passa as letras já resolvidas.

const INK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.42, 0.42, 0.45);
const LIGHT = rgb(0.78, 0.78, 0.8);
const NAVY = rgb(0.0, 0.2, 0.4);

const CONTENT_WIDTH = PAGE.width - 2 * MARGIN;
const COLUMNS = 10; // questões por linha da grade (a prova tem no máximo 20)
const CELL_HEIGHT = 26;
const CARD_HEADER = 24;
const CARD_PADDING = 10;
const CARD_GAP = 10;
const BODY_BOTTOM = 800;
const FIRST_PAGE_TOP = 150;
const NEXT_PAGE_TOP = 66;

const toPdfY = (y) => PAGE.height - y;

function drawLeft(page, str, { x, y, size, font, color = INK }) {
  page.drawText(str, { x, y: toPdfY(y), size, font, color });
}

function drawRight(page, str, { rightX, y, size, font, color = INK }) {
  page.drawText(str, { x: rightX - font.widthOfTextAtSize(str, size), y: toPdfY(y), size, font, color });
}

function drawCentered(page, str, { cx, y, size, font, color = INK }) {
  page.drawText(str, { x: cx - font.widthOfTextAtSize(str, size) / 2, y: toPdfY(y), size, font, color });
}

function drawHLine(page, y, color = LIGHT) {
  page.drawLine({ start: { x: MARGIN, y: toPdfY(y) }, end: { x: PAGE.width - MARGIN, y: toPdfY(y) }, color, thickness: 0.6 });
}

// Corta com "..." o texto que não cabe na largura.
function fit(str, font, size, maxWidth) {
  if (font.widthOfTextAtSize(str, size) <= maxWidth) return str;
  let text = str;
  while (text.length > 1 && font.widthOfTextAtSize(`${text}...`, size) > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}...`;
}

function cardHeight(answerCount) {
  return CARD_HEADER + Math.max(1, Math.ceil(answerCount / COLUMNS)) * CELL_HEIGHT + CARD_PADDING;
}

function drawFirstHeader(ctx, page) {
  const { font, bold, clean, meta } = ctx;
  if (meta.institution) {
    drawLeft(page, fit(clean(meta.institution), font, 9, CONTENT_WIDTH), { x: MARGIN, y: 50, size: 9, font, color: GRAY });
  }
  drawLeft(page, fit(clean(`Gabarito: ${meta.title}`), bold, 15, CONTENT_WIDTH), { x: MARGIN, y: 72, size: 15, font: bold });
  const subtitle = [
    meta.className ? `Turma: ${meta.className}` : '',
    meta.date ? `Data: ${meta.date}` : '',
    `${meta.copyCount} ${meta.copyCount === 1 ? 'prova' : 'provas'}`,
  ]
    .filter(Boolean)
    .join('     ');
  drawLeft(page, fit(clean(subtitle), font, 10, CONTENT_WIDTH), { x: MARGIN, y: 90, size: 10, font, color: GRAY });
  drawLeft(page, clean('Cada pessoa confere o gabarito pelo código impresso na própria prova. Só as respostas certas, na ordem'), {
    x: MARGIN,
    y: 112,
    size: 8.5,
    font,
    color: GRAY,
  });
  drawLeft(page, clean('em que as questões e alternativas aparecem naquela prova. Nenhuma nota é informada.'), {
    x: MARGIN,
    y: 123,
    size: 8.5,
    font,
    color: GRAY,
  });
  drawHLine(page, 134);
}

function drawRunningHeader(ctx, page) {
  drawLeft(page, fit(ctx.clean(`Gabarito: ${ctx.meta.title}`), ctx.font, 8, CONTENT_WIDTH), {
    x: MARGIN,
    y: 36,
    size: 8,
    font: ctx.font,
    color: GRAY,
  });
  drawHLine(page, 44);
}

function drawCard(ctx, page, y, copy) {
  const { font, bold, clean } = ctx;
  const height = cardHeight(copy.answers.length);
  page.drawRectangle({ x: MARGIN, y: toPdfY(y + height), width: CONTENT_WIDTH, height, borderColor: LIGHT, borderWidth: 0.8 });

  const right = PAGE.width - MARGIN - 12;
  const codeText = `Código: ${copy.code}`;
  drawRight(page, clean(codeText), { rightX: right, y: y + 16, size: 10.5, font: bold, color: NAVY });
  const labelWidth = CONTENT_WIDTH - 24 - bold.widthOfTextAtSize(clean(codeText), 10.5) - 16;
  drawLeft(page, fit(clean(copy.label || `Prova ${copy.code}`), bold, 11, labelWidth), { x: MARGIN + 12, y: y + 16, size: 11, font: bold });

  const cellWidth = (CONTENT_WIDTH - 24) / COLUMNS;
  copy.answers.forEach((answer, i) => {
    const col = i % COLUMNS;
    const row = Math.floor(i / COLUMNS);
    const cx = MARGIN + 12 + col * cellWidth + cellWidth / 2;
    const top = y + CARD_HEADER + row * CELL_HEIGHT;
    drawCentered(page, `${answer.number}`, { cx, y: top + 8, size: 7.5, font, color: GRAY });
    if (answer.correctLetter) {
      drawCentered(page, answer.correctLetter, { cx, y: top + 20, size: 11, font: bold });
    } else {
      drawCentered(page, 'disc.', { cx, y: top + 19, size: 7.5, font, color: GRAY }); // discursiva: sem letra
    }
  });

  return height;
}

// Parâmetros:
//   exam: { title }; className, date, institution: texto do cabeçalho (opcionais)
//   copies: [{ code, label, answers: [{ number, correctLetter }] }] (correctLetter nulo = discursiva)
//   creationDate: data gravada no arquivo
// Devolve: { bytes, pageCount }
export async function buildAnswerKeyPdf({ exam, className, date, institution, copies, creationDate = new Date() }) {
  if (!Array.isArray(copies) || copies.length === 0) throw new Error('Não há cópias para gerar o gabarito.');

  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const charset = new Set(font.getCharacterSet());
  const clean = (text) => sanitizeText(text, charset);

  const title = exam?.title || 'Prova';
  doc.setTitle(clean(`Gabarito: ${title}`));
  doc.setCreator('SGP');
  doc.setProducer('SGP (pdf-lib)');
  doc.setLanguage('pt-BR');
  doc.setCreationDate(creationDate);
  doc.setModificationDate(creationDate);

  const ctx = { font, bold, clean, meta: { title, className, date, institution, copyCount: copies.length } };

  let page = doc.addPage([PAGE.width, PAGE.height]);
  drawFirstHeader(ctx, page);
  let y = FIRST_PAGE_TOP;

  for (const copy of copies) {
    // Cada quadro fica inteiro na mesma página.
    if (y + cardHeight(copy.answers.length) > BODY_BOTTOM) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      drawRunningHeader(ctx, page);
      y = NEXT_PAGE_TOP;
    }
    y += drawCard(ctx, page, y, copy) + CARD_GAP;
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    drawCentered(p, `Gabarito   |   Página ${i + 1} de ${pages.length}`, { cx: PAGE.width / 2, y: 820, size: 8, font, color: GRAY });
  });

  return { bytes: await doc.save(), pageCount: pages.length };
}
