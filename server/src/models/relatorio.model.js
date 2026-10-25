import { toCamelCase } from '../utils/case.js';
import { toDateOnly, toIsoDate } from './correcao.model.js';

// Models dos relatórios e do histórico de notas: convertem as linhas do banco
// nos objetos da API (DECIMAL e COUNT viram número, datas viram texto ISO).

function toNumberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function toAplicacaoResumo(dbRow) {
  const row = toCamelCase(dbRow);
  return {
    id: row.id,
    dataAplicacao: toDateOnly(row.dataAplicacao),
    status: row.status,
    prova: { id: row.provaId, titulo: row.provaTitulo },
    turma: { id: row.turmaId, nome: row.turmaNome },
    notaMaxima: Number(row.notaMaxima),
    // Contagens só existem na listagem (consulta com GROUP BY).
    ...(row.totalCopias !== undefined && {
      totalCopias: Number(row.totalCopias),
      corrigidas: Number(row.corrigidas),
      media: toNumberOrNull(row.media),
    }),
  };
}

export function toNotaDaCopia(dbRow) {
  const row = toCamelCase(dbRow);
  return {
    copiaId: row.copiaId,
    codigo: row.codigo,
    rotulo: row.rotulo,
    aluno: row.alunoId ? { id: row.alunoId, nome: row.alunoNome, matricula: row.alunoMatricula } : null,
    correcaoId: row.correcaoId ?? null,
    nota: toNumberOrNull(row.nota),
    tipo: row.tipo ?? null,
    corrigidaEm: toIsoDate(row.corrigidaEm),
  };
}

export function toDesempenhoDaQuestao(dbRow) {
  const row = toCamelCase(dbRow);
  return {
    questaoId: row.questaoId,
    posicao: row.posicao,
    tipo: row.tipo,
    enunciado: row.enunciado,
    pontuacao: Number(row.pontuacao),
    corrigidas: Number(row.corrigidas),
    acertos: Number(row.acertos),
    emBranco: Number(row.emBranco),
    mediaPontos: toNumberOrNull(row.mediaPontos),
  };
}

export function toTurmaResumo(dbRow) {
  const row = toCamelCase(dbRow);
  return { ...row, totalAlunos: Number(row.totalAlunos), totalAplicacoes: Number(row.totalAplicacoes) };
}

export function toNotaDoAluno(dbRow) {
  const row = toCamelCase(dbRow);
  return { ...row, nota: Number(row.nota) };
}

export function toItemDoHistorico(dbRow) {
  const row = toCamelCase(dbRow);
  return {
    correcaoId: row.correcaoId,
    nota: Number(row.nota),
    notaMaxima: Number(row.notaMaxima),
    tipo: row.tipo,
    corrigidaEm: toIsoDate(row.corrigidaEm),
    codigo: row.codigo,
    gabaritoPublicado: Boolean(row.gabaritoPublicado),
    gabaritoPublicadoEm: toIsoDate(row.gabaritoPublicadoEm),
    aplicacao: { id: row.aplicacaoId, dataAplicacao: toDateOnly(row.dataAplicacao) },
    prova: { id: row.provaId, titulo: row.provaTitulo },
    turma: { id: row.turmaId, nome: row.turmaNome },
  };
}
