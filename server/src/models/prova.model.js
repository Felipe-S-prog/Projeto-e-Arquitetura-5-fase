import { toCamelCase } from '../utils/case.js';

// Models da Provas (T17): convertem as linhas do banco nos objetos que o front já usa
// (ver client/src/data/exams.json): { id, title, description, status, questions: [{ questionId, score }] }.

const STATUS_PARA_API = { RASCUNHO: 'Rascunho', PRONTA: 'Pronta', ARQUIVADA: 'Arquivada' };

export function statusParaApi(status) {
  return STATUS_PARA_API[status] ?? status;
}

export function toProva(dbRow, questoes = []) {
  const row = toCamelCase(dbRow);
  return {
    id: row.id,
    title: row.titulo,
    description: row.descricao ?? '',
    status: statusParaApi(row.status),
    createdAt: row.criadaEm instanceof Date ? row.criadaEm.toISOString() : (row.criadaEm ?? null),
    questions: questoes.map(toQuestaoDaProva),
  };
}

export function toQuestaoDaProva(dbRow) {
  const row = toCamelCase(dbRow);
  return { questionId: row.questaoId, score: Number(row.pontuacao) };
}
