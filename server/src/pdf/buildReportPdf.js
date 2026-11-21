import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sanitizeText, wrapText } from './pdfText.js';

// PDF dos relatórios de notas (T66): página A4 deitada com título, linhas de resumo e uma ou
// mais tabelas. As tabelas quebram de página repetindo o cabeçalho. Não depende do banco:
// recebe as tabelas já montadas (services/relatorio.exportacao.js).
//
// relatorio: { titulo, subtitulo: [texto], tabelas: [{ titulo?, colunas: [{ titulo, tipo, largura }], linhas }] }

const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 36;
const CONTENT_WIDTH = PAGE.width - 2 * MARGIN;
const BODY_BOTTOM = PAGE.height - 40;
const ROW_HEIGHT = 15;

const INK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.42, 0.42, 0.45);
const HEADER_FILL = rgb(0.91, 0.92, 0.94);
const ZEBRA = rgb(0.97, 0.97, 0.98);
const LINE = rgb(0.82, 0.83, 0.86);

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const toPdfY = (y) => PAGE.height - y;

function format(value, tipo) {
  if (value === null || value === undefined) return '';
  if (tipo === 'numero' && typeof value === 'number') return numberFormat.format(value);
  return String(value);
}

function fit(str, font, size, maxWidth) {
  if (font.widthOfTextAtSize(str, size) <= maxWidth) return str;
  let text = str;
  while (text.length > 1 && font.widthOfTextAtSize(`${text}...`, size) > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}...`;
}

export async function buildReportPdf(relatorio, { creationDate = new Date() } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(relatorio.titulo);
  doc.setCreator('SGP');
  doc.setProducer('SGP (pdf-lib)');
  doc.setLanguage('pt-BR');
  doc.setCreationDate(creationDate);
  doc.setModificationDate(creationDate);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const charset = new Set(font.getCharacterSet());
  const clean = (text) => sanitizeText(text, charset);

  let page;
  let y;
  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = MARGIN;
  };
  const text = (str, x, size, f = font, color = INK) => page.drawText(str, { x, y: toPdfY(y), size, font: f, color });

  newPage();
  y += 14;
  text(fit(clean(relatorio.titulo), bold, 15, CONTENT_WIDTH), MARGIN, 15, bold);
  y += 6;
  for (const line of relatorio.subtitulo ?? []) {
    y += 13;
    text(fit(clean(line), font, 9.5, CONTENT_WIDTH), MARGIN, 9.5, font, GRAY);
  }
  y += 16;

  for (const tabela of relatorio.tabelas) {
    const size = tabela.colunas.length > 14 ? 7 : 8;
    const total = tabela.colunas.reduce((s, c) => s + (c.largura ?? 12), 0);
    const widths = tabela.colunas.map((c) => ((c.largura ?? 12) / total) * CONTENT_WIDTH);
    const xs = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((s, w) => s + w, 0));

    const drawCellText = (value, i, f, rowTop, h) => {
      const col = tabela.colunas[i];
      const str = fit(clean(format(value, col.tipo)), f, size, widths[i] - 6);
      const width = f.widthOfTextAtSize(str, size);
      const x = col.alinhamento === 'centro' ? xs[i] + (widths[i] - width) / 2 : col.tipo === 'numero' ? xs[i] + widths[i] - 3 - width : xs[i] + 3;
      page.drawText(str, { x, y: toPdfY(rowTop + h / 2 + size * 0.35), size, font: f, color: INK });
    };
    // Cabeçalho em até 3 linhas por coluna, para não cortar títulos longos (ex.: nome da prova e data).
    const headerLines = tabela.colunas.map((c, i) => {
      const lines = wrapText(clean(c.titulo), bold, size, widths[i] - 6);
      return lines.length > 3 ? [...lines.slice(0, 2), fit(lines.slice(2).join(' '), bold, size, widths[i] - 6)] : lines;
    });
    const lineHeight = size + 2;
    const headerHeight = Math.max(...headerLines.map((l) => l.length)) * lineHeight + 8;
    const drawHeader = () => {
      page.drawRectangle({ x: MARGIN, y: toPdfY(y + headerHeight), width: CONTENT_WIDTH, height: headerHeight, color: HEADER_FILL });
      headerLines.forEach((lines, i) => {
        const col = tabela.colunas[i];
        lines.forEach((line, k) => {
          const width = bold.widthOfTextAtSize(line, size);
          const x = col.alinhamento === 'centro' ? xs[i] + (widths[i] - width) / 2 : col.tipo === 'numero' ? xs[i] + widths[i] - 3 - width : xs[i] + 3;
          page.drawText(line, { x, y: toPdfY(y + 4 + (k + 1) * lineHeight - 2), size, font: bold, color: INK });
        });
      });
      y += headerHeight;
    };

    // título da tabela + cabeçalho + ao menos 2 linhas precisam caber juntos
    if (y + 20 + headerHeight + 2 * ROW_HEIGHT > BODY_BOTTOM) newPage();
    if (tabela.titulo) {
      y += 12;
      text(fit(clean(tabela.titulo), bold, 11, CONTENT_WIDTH), MARGIN, 11, bold);
      y += 8;
    }
    drawHeader();
    if (tabela.linhas.length === 0) {
      y += 14;
      text('Sem dados.', MARGIN + 3, size, font, GRAY);
      y += 6;
    }
    tabela.linhas.forEach((linha, r) => {
      if (y + ROW_HEIGHT > BODY_BOTTOM) {
        newPage();
        drawHeader();
      }
      if (r % 2 === 1) page.drawRectangle({ x: MARGIN, y: toPdfY(y + ROW_HEIGHT), width: CONTENT_WIDTH, height: ROW_HEIGHT, color: ZEBRA });
      linha.forEach((value, i) => drawCellText(value, i, font, y, ROW_HEIGHT));
      y += ROW_HEIGHT;
      page.drawLine({ start: { x: MARGIN, y: toPdfY(y) }, end: { x: MARGIN + CONTENT_WIDTH, y: toPdfY(y) }, thickness: 0.4, color: LINE });
    });
    y += 18;
  }

  const pages = doc.getPages();
  const generated = `Gerado pelo SGP em ${creationDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
  pages.forEach((p, i) => {
    const footer = `Página ${i + 1} de ${pages.length}`;
    p.drawText(clean(generated), { x: MARGIN, y: 20, size: 8, font, color: GRAY });
    p.drawText(footer, { x: PAGE.width - MARGIN - font.widthOfTextAtSize(footer, 8), y: 20, size: 8, font, color: GRAY });
  });

  return { bytes: await doc.save(), paginas: pages.length };
}
