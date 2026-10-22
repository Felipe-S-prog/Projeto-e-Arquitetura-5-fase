import { toCamelCase } from '../utils/case.js';

// Models da Correção e Notas: convertem as linhas do banco nos objetos da API.

export function toIsoDate(value) {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

// data_aplicacao é DATE: devolvemos só "AAAA-MM-DD", sem horário nem fuso.
export function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

// copia_prova.ordem_embaralhamento é JSON no formato gerado pelo front
// (utils/answerKey.js): { questionIds: [...], alternativesOrder: { [idQuestao]: [...] } }.
// O mysql2 já devolve a coluna JSON como objeto, mas aceitamos texto também.
export function toOrdemEmbaralhamento(value) {
  const ordem = typeof value === 'string' ? JSON.parse(value) : (value ?? {});
  const alternativesOrder = {};
  for (const [questaoId, posicoes] of Object.entries(ordem.alternativesOrder ?? {})) {
    alternativesOrder[Number(questaoId)] = posicoes.map(Number);
  }
  return { questionIds: (ordem.questionIds ?? []).map(Number), alternativesOrder };
}

export function toAluno(row) {
  if (!row || row.alunoId === null || row.alunoId === undefined) return null;
  return { id: row.alunoId, nome: row.alunoNome, email: row.alunoEmail ?? null, matricula: row.alunoMatricula ?? null };
}

export function toCopia(dbRow) {
  const row = toCamelCase(dbRow);
  return {
    id: row.id,
    codigo: row.codigo,
    rotulo: row.rotulo,
    aluno: toAluno(row),
    gabaritoPublicado: Boolean(row.gabaritoPublicado),
    ordem: toOrdemEmbaralhamento(row.ordemEmbaralhamento),
    aplicacao: { id: row.aplicacaoId, dataAplicacao: toDateOnly(row.dataAplicacao) },
    prova: { id: row.provaId, titulo: row.provaTitulo },
    turma: { id: row.turmaId, nome: row.turmaNome },
  };
}

export function toQuestaoDaProva(dbRow) {
  const row = toCamelCase(dbRow);
  return { questaoId: row.questaoId, posicao: row.posicao, pontuacao: Number(row.pontuacao), tipo: row.tipo, enunciado: row.enunciado };
}

export function toAlternativa(dbRow) {
  const row = toCamelCase(dbRow);
  return { questaoId: row.questaoId, ordem: row.ordem, texto: row.texto, correta: Boolean(row.correta) };
}

export function toCorrecao(dbRow) {
  const row = toCamelCase(dbRow);
  return {
    id: row.id,
    copiaId: row.copiaProvaId,
    aluno: toAluno(row),
    professorId: row.professorId,
    nota: Number(row.nota),
    tipo: row.tipo,
    corrigidaEm: toIsoDate(row.corrigidaEm),
  };
}

export function toResposta(dbRow) {
  const row = toCamelCase(dbRow);
  return {
    questaoId: row.questaoId,
    numero: row.numero,
    letraMarcada: row.letraMarcada,
    correta: row.correta === null ? null : Boolean(row.correta),
    pontos: Number(row.pontos),
  };
}
