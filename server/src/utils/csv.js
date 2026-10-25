// Gera CSV que o Excel em português abre direto, com acentos e colunas certas:
// - separador ";" (o Excel pt-BR usa "," como separador decimal);
// - números com vírgula decimal (7,5);
// - BOM UTF-8 no início, para o Excel não estragar os acentos;
// - quebra de linha CRLF.
const BOM = '﻿';

// Célula que começa com = + - @ pode ser executada como fórmula pelo Excel
// (CSV injection): prefixamos com apóstrofo. Números não passam por aqui.
const FORMULA_START = /^[=+\-@\t\r]/;

function formatCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header, rows) {
  return BOM + [header, ...rows].map((row) => row.map(formatCell).join(';')).join('\r\n') + '\r\n';
}
