import { AppError } from '../errors/AppError.js';

export function validarAluno(body = {}) {
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const numero = typeof body.numero_matricula === 'string' ? body.numero_matricula.trim() : '';
  if (!nome || nome.length > 120) throw AppError.badRequest('Informe o nome do aluno (máximo de 120 caracteres).');
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw AppError.badRequest('Informe um e-mail válido.');
  if (numero.length > 30) throw AppError.badRequest('O número de matrícula aceita até 30 caracteres.');
  return { nome, email, numero_matricula: numero || null };
}

// CSV do Excel (UTF-8), com vírgula ou ponto e vírgula e aspas escapadas.
export function lerAlunosCsv(text) {
  if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > 500000) {
    throw AppError.badRequest('Envie um CSV UTF-8 de até 500 KB.');
  }
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const headerLine = source.split('\n')[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const rows = [];
  let row = [], field = '', quoted = false, closed = false, line = 1, startLine = 1;
  function finishField() { row.push(field); field = ''; closed = false; }
  function finishRow() {
    finishField();
    if (row.some((cell) => cell.trim())) rows.push({ line: startLine, cells: row });
    row = []; startLine = line + 1;
    if (rows.length > 501) throw AppError.badRequest('Importe no máximo 500 alunos por arquivo.');
  }
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === delimiter) finishField();
    else if (c === '\n') finishRow();
    else if (c === '"' && !field && !closed) quoted = true;
    else if (c === '"' || (closed && c.trim())) throw AppError.badRequest(`CSV inválido na linha ${line}. Confira as aspas.`);
    else if (!closed) field += c;
    if (c === '\n') line++;
  }
  if (quoted) throw AppError.badRequest('CSV com aspas não fechadas.');
  finishRow();
  const headers = rows.shift()?.cells.map((v) => v.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[ -]/g, '_')) ?? [];
  const name = headers.indexOf('nome'), email = headers.indexOf('email') >= 0 ? headers.indexOf('email') : headers.indexOf('e_mail');
  const registration = headers.indexOf('numero_matricula') >= 0 ? headers.indexOf('numero_matricula') : headers.indexOf('matricula');
  if (name < 0 || email < 0 || new Set(headers).size !== headers.length) throw AppError.badRequest('O cabeçalho deve conter nome e email, sem colunas repetidas. Matrícula é opcional.');
  if (!rows.length) throw AppError.badRequest('O CSV não contém alunos.');
  return rows.map(({ line, cells }) => ({ line, body: { nome: cells[name], email: cells[email], numero_matricula: cells[registration] }, invalidColumns: cells.length !== headers.length }));
}
