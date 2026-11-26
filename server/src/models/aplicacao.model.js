import { toCamelCase } from '../utils/case.js';

// Models das Aplicações (T18): convertem as linhas do banco nos objetos que o front já usa
// { id, examId, classId, status, quantity, date, shuffleQuestions, shuffleAlternatives, linkToRoster },
// mais gradedCount (correções lançadas), que a tela usa para travar uma nova geração das cópias (T58).
// O status "Corrigida" não fica no banco: é uma aplicação APLICADA em que todas as cópias já têm
// correção. Assim ele acompanha sozinho as correções lançadas ou excluídas.

const STATUS_PARA_API = { PENDENTE: 'Pendente', APLICADA: 'Aplicada' };

// data_aplicacao é DATE: devolvemos só "AAAA-MM-DD", sem horário nem fuso.
function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function statusDaAplicacao(row) {
  const copias = Number(row.totalCopias ?? 0);
  const correcoes = Number(row.totalCorrecoes ?? 0);
  if (row.status === 'APLICADA' && copias > 0 && correcoes >= copias) return 'Corrigida';
  return STATUS_PARA_API[row.status] ?? row.status;
}

export function toAplicacao(dbRow) {
  const row = toCamelCase(dbRow);
  const aplicacao = {
    id: row.id,
    examId: row.provaId,
    classId: row.turmaId,
    status: statusDaAplicacao(row),
    quantity: row.quantidade,
    date: toDateOnly(row.dataAplicacao),
    shuffleQuestions: Boolean(row.embaralharQuestoes),
    shuffleAlternatives: Boolean(row.embaralharAlternativas),
    linkToRoster: Boolean(row.vincularAlunos),
  };
  if (row.totalCorrecoes !== undefined) aplicacao.gradedCount = Number(row.totalCorrecoes);
  if (row.totalCopias !== undefined) aplicacao.copiesCount = Number(row.totalCopias);
  // Quando a criação muda o status da prova (Rascunho -> Pronta), o front precisa saber.
  if (row.provaStatus !== undefined) {
    aplicacao.examStatus = { RASCUNHO: 'Rascunho', PRONTA: 'Pronta', ARQUIVADA: 'Arquivada' }[row.provaStatus] ?? row.provaStatus;
  }
  return aplicacao;
}
