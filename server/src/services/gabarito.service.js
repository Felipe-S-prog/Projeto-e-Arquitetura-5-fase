import { AppError } from '../errors/AppError.js';

const LETRAS = ['A', 'B', 'C', 'D', 'E'];
const CODIGO_PATTERN = /^[A-Z0-9]{4,12}$/;

// Letra certa de cada questão na ordem IMPRESSA da cópia (T26; era utils/answerKey.js no front).
// alternativesOrder[questão] lista a posição original de cada alternativa impressa como A, B, C...
// Questão sem alternativas (discursiva) volta com letra nula.
export function resolverGabarito(copia, alternativasPorQuestao) {
  return copia.questionIds.map((questaoId, i) => {
    const corretas = alternativasPorQuestao.get(questaoId) ?? [];
    if (corretas.length === 0) return { number: i + 1, correctLetter: null };
    const ordem = copia.alternativesOrder[questaoId] ?? corretas.map((_, idx) => idx);
    const posicao = ordem.findIndex((original) => corretas[original]);
    return { number: i + 1, correctLetter: LETRAS[posicao] ?? null };
  });
}

// Service da consulta pública do gabarito (T26). Regras:
// - qualquer pessoa com o código impresso consulta, sem login;
// - só responde depois que o professor publicou o gabarito daquela cópia (RF08);
// - devolve só o título da prova e a letra certa de cada questão: nunca nota, aluno ou pontuação.
export function createGabaritoService(repository) {
  return {
    async consultar(codigoBruto) {
      const codigo = String(codigoBruto ?? '').trim().toUpperCase();
      if (!CODIGO_PATTERN.test(codigo)) throw AppError.badRequest('Código de prova inválido.');

      const copia = await repository.findCopiaPorCodigo(codigo);
      if (!copia) throw AppError.notFound('Não encontramos nenhuma prova com esse código.');
      if (!copia.answerKeyPublished) {
        throw AppError.forbidden('O gabarito desta prova ainda não foi publicado pelo professor.');
      }

      const alternativas = await repository.listAlternativasDaProva(copia.provaId);
      return {
        code: copia.code,
        examTitle: copia.provaTitulo,
        publishedAt: copia.answerKeyPublishedAt,
        answers: resolverGabarito(copia, alternativas),
      };
    },
  };
}
