import { toCamelCase } from '../utils/case.js';
import { toIsoDate, toOrdemEmbaralhamento } from './correcao.model.js';

// Model das Cópias da Prova (T23): converte a linha de copia_prova no objeto que o front já usa
// (era montado em client/src/utils/answerKey.js):
// { id, applicationId, code, label, studentId, studentName, questionIds, alternativesOrder,
//   answerKeyPublished, answerKeyPublishedAt }.
export function toCopiaDaProva(dbRow) {
  const row = toCamelCase(dbRow);
  const ordem = toOrdemEmbaralhamento(row.ordemEmbaralhamento);
  return {
    id: row.id,
    applicationId: row.aplicacaoId,
    code: row.codigo,
    label: row.rotulo,
    studentId: row.alunoId ?? null,
    studentName: row.alunoNome ?? null,
    questionIds: ordem.questionIds,
    alternativesOrder: ordem.alternativesOrder,
    answerKeyPublished: Boolean(row.gabaritoPublicado),
    answerKeyPublishedAt: toIsoDate(row.gabaritoPublicadoEm),
  };
}
