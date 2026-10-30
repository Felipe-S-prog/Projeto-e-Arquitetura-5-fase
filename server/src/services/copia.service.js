import { AppError } from '../errors/AppError.js';
import { gerarCopias } from './copia.geracao.js';

const CODIGO_PATTERN = /^[A-Z0-9]{4,12}$/;

function parseId(valor, mensagem) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest(mensagem);
  return id;
}

// Service das Cópias da Prova (T23). Regras de negócio:
// - a cópia pertence à aplicação, que é do professor dono da prova (RNF04);
// - as cópias só são geradas (ou regeradas) enquanto a aplicação está Pendente: depois do download
//   do PDF elas ficam fixas, porque os códigos já foram impressos;
// - gerar de novo troca todas as cópias, e nunca se a aplicação já tem correção lançada;
// - vinculada à turma (T24): uma cópia nominal por aluno matriculado, em ordem alfabética,
//   com o nome no rótulo e o aluno gravado na cópia (a correção já sabe de quem é a nota);
// - publicar o gabarito libera a consulta pública de uma cópia ou de todas, e não tem volta.
export function createCopiaService(repository, { gerar = gerarCopias } = {}) {
  async function buscarAplicacao(idBruto, professorId) {
    const id = parseId(idBruto, 'Aplicação inválida.');
    const aplicacao = await repository.findAplicacao(id, professorId);
    if (!aplicacao) throw AppError.notFound('Aplicação não encontrada.');
    return aplicacao;
  }

  return {
    listar(professorId) {
      return repository.listByProfessor(professorId);
    },

    async listarDaAplicacao(aplicacaoId, professorId) {
      const aplicacao = await buscarAplicacao(aplicacaoId, professorId);
      return repository.listByAplicacao(aplicacao.id, professorId);
    },

    async gerar(aplicacaoId, professorId) {
      const aplicacao = await buscarAplicacao(aplicacaoId, professorId);
      if (aplicacao.status !== 'PENDENTE') {
        throw AppError.conflict('As cópias desta aplicação já foram impressas e não podem ser geradas de novo.');
      }
      if ((await repository.countCorrecoes(aplicacao.id)) > 0) {
        throw AppError.conflict('Esta aplicação já tem correções lançadas; gerar de novo apagaria as notas.');
      }

      const questoes = await repository.listQuestoesDaProva(aplicacao.provaId);
      if (questoes.length === 0) throw AppError.conflict('A prova desta aplicação não tem questões.');

      let alunos = null;
      if (aplicacao.vincularAlunos) {
        alunos = await repository.listAlunosDaTurma(aplicacao.turmaId);
        if (alunos.length === 0) {
          throw AppError.conflict('A turma não tem alunos matriculados. Matricule os alunos ou gere provas anônimas.');
        }
      }

      const copias = gerar({
        questoes,
        quantidade: aplicacao.quantidade,
        embaralharQuestoes: aplicacao.embaralharQuestoes,
        embaralharAlternativas: aplicacao.embaralharAlternativas,
        codigosEmUso: await repository.listCodigos(),
        alunos,
      });

      await repository.substituirCopias(aplicacao.id, copias);
      return repository.listByAplicacao(aplicacao.id, professorId);
    },

    // body.code publica uma cópia só; sem code, publica todas as cópias da aplicação.
    async publicarGabarito(aplicacaoId, body, professorId) {
      const aplicacao = await buscarAplicacao(aplicacaoId, professorId);

      let codigo = null;
      if (body?.code !== undefined && body?.code !== null) {
        codigo = String(body.code).trim().toUpperCase();
        if (!CODIGO_PATTERN.test(codigo)) throw AppError.badRequest('Código de prova inválido.');
      }

      const copias = await repository.listByAplicacao(aplicacao.id, professorId);
      if (copias.length === 0) throw AppError.conflict('Gere as cópias da prova antes de publicar o gabarito.');
      if (codigo && !copias.some((c) => c.code === codigo)) {
        throw AppError.notFound('Cópia não encontrada nesta aplicação.');
      }

      await repository.publicarGabarito(aplicacao.id, codigo);
      return repository.listByAplicacao(aplicacao.id, professorId);
    },
  };
}
