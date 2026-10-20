// Tratamento de texto para o PDF.
// As fontes padrão do PDF (Helvetica) cobrem português, ², ×, ÷, aspas e travessões,
// mas não cobrem símbolos como ≤ ≥ ≠ → √ π. Esses são trocados por texto equivalente;
// qualquer outro caractere que a fonte não tenha vira "?" (em vez de derrubar o PDF).

const REPLACEMENTS = {
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '≈': '~',
  '→': '->',
  '←': '<-',
  '↔': '<->',
  '−': '-',
  '√': 'raiz de ',
  π: 'pi',
  '∞': 'infinito',
  ' ': ' ',
  '\t': ' ',
};

// charset: Set com os códigos de caractere da fonte, ex.: new Set(font.getCharacterSet()).
export function sanitizeText(text, charset) {
  let out = '';
  for (const ch of String(text ?? '')) {
    if (ch === '\n' || ch === '\r') {
      out += ch;
      continue;
    }
    const replaced = Object.prototype.hasOwnProperty.call(REPLACEMENTS, ch) ? REPLACEMENTS[ch] : ch;
    for (const piece of replaced) {
      out += charset.has(piece.codePointAt(0)) ? piece : '?';
    }
  }
  return out;
}

// Quebra o texto em linhas que cabem em maxWidth. Respeita quebras de linha do texto e
// divide palavras maiores que a linha (por exemplo, um link longo) em pedaços.
export function wrapText(text, font, size, maxWidth) {
  const lines = [];
  for (const paragraph of String(text ?? '').split(/\r?\n/)) {
    const words = paragraph.split(' ').filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (let word of words) {
      while (font.widthOfTextAtSize(word, size) > maxWidth) {
        let cut = word.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut--;
        if (current) {
          lines.push(current);
          current = '';
        }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
