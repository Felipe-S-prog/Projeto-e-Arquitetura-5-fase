import { toCamelCase } from '../utils/case.js';

// Models das Aplicações (T18): convertem as linhas do banco nos objetos que o front já usa
// (ver client/src/data/applications.json):
// { id, examId, classId, status, quantity, date, shuffleQuestions, shuffleAlternatives, linkToRoster }.

const STATUS_PARA_API = { PENDENTE: 'Pendente', APLICADA: 'Aplicada' };

// data_aplicacao é DATE: devolvemos só "AAAA-MM-DD", sem horário nem fuso.
function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export function toAplicacao(dbRow) {
  const row = toCamelCase(dbRow);
  const aplicacao = {
    id: row.id,
    examId: row.provaId,
    classId: row.turmaId,
    status: STATUS_PARA_API[row.status] ?? row.status,
    quantity: row.quantidade,
    date: toDateOnly(row.dataAplicacao),
    shuffleQuestions: Boolean(row.embaralharQuestoes),
    shuffleAlternatives: Boolean(row.embaralharAlternativas),
    linkToRoster: Boolean(row.vincularAlunos),
  };
  // Quando a criação muda o status da prova (Rascunho -> Pronta), o front precisa saber.
  if (row.provaStatus !== undefined) {
    aplicacao.examStatus = { RASCUNHO: 'Rascunho', PRONTA: 'Pronta', ARQUIVADA: 'Arquivada' }[row.provaStatus] ?? row.provaStatus;
  }
  return aplicacao;
}
