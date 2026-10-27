import { AppError } from '../errors/AppError.js';

const MAX_QUANTIDADE = 1000;

function parseId(valor, mensagem) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest(mensagem);
  return id;
}

function parseQuantidade(valor) {
  const quantidade = Number(valor);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_QUANTIDADE) {
    throw AppError.badRequest(`A quantidade deve ser um número inteiro de 1 a ${MAX_QUANTIDADE}.`);
  }
  return quantidade;
}

// Data de hoje no fuso de Brasília ("AAAA-MM-DD"), para a data da aplicação não virar o dia mais cedo.
function hojeBrasilia() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

// Service das Aplicações (T18 e T19). Regras de negócio:
// - a aplicação liga uma prova a uma turma, ambas do professor logado (RNF04);
// - prova Arquivada não pode ser aplicada e turma Arquivada não recebe aplicação;
// - nasce Pendente; ao criar, a prova em Rascunho vira Pronta (T19);
// - a configuração (quantidade, embaralhar, vincular alunos) só muda enquanto está Pendente;
// - aplicar marca como Aplicada e grava a data de hoje (uma vez só; repetir não muda nada).
export function createAplicacaoService(repository, { hoje = hojeBrasilia } = {}) {
  async function buscarDoProfessor(idBruto, professorId) {
    const id = parseId(idBruto, 'Aplicação inválida.');
    const aplicacao = await repository.findById(id, professorId);
    if (!aplicacao) throw AppError.notFound('Aplicação não encontrada.');
    return aplicacao;
  }

  return {
    listar(professorId) {
      return repository.listByProfessor(professorId);
    },

    buscar(id, professorId) {
      return buscarDoProfessor(id, professorId);
    },

    async criar(body, professorId) {
      const provaId = parseId(body?.examId, 'Informe a prova da aplicação.');
      const turmaId = parseId(body?.classId, 'Informe a turma da aplicação.');
      const quantidade = parseQuantidade(body?.quantity);

      const prova = await repository.findProva(provaId, professorId);
      if (!prova) throw AppError.notFound('Prova não encontrada.');
      if (prova.status === 'ARQUIVADA') throw AppError.conflict('Uma prova arquivada não pode ser aplicada.');

      const turma = await repository.findTurma(turmaId, professorId);
      if (!turma) throw AppError.notFound('Turma não encontrada.');
      if (turma.status === 'ARQUIVADA') throw AppError.conflict('Uma turma arquivada não recebe aplicações.');

      return repository.create({ provaId, turmaId, quantidade });
    },

    async atualizar(id, body, professorId) {
      const atual = await buscarDoProfessor(id, professorId);
      if (atual.status !== 'Pendente') {
        throw AppError.conflict('Só é possível alterar a configuração de uma aplicação Pendente.');
      }

      const campos = {};
      if (body?.quantity !== undefined) campos.quantity = parseQuantidade(body.quantity);
      for (const nome of ['shuffleQuestions', 'shuffleAlternatives', 'linkToRoster']) {
        if (body?.[nome] !== undefined) {
          if (typeof body[nome] !== 'boolean') throw AppError.badRequest(`O campo ${nome} deve ser verdadeiro ou falso.`);
          campos[nome] = body[nome];
        }
      }
      if (Object.keys(campos).length === 0) throw AppError.badRequest('Informe ao menos um campo para atualizar.');

      await repository.updateConfig(atual.id, campos);
      return repository.findById(atual.id, professorId);
    },

    async aplicar(id, professorId) {
      const atual = await buscarDoProfessor(id, professorId);
      if (atual.status === 'Pendente') await repository.marcarAplicada(atual.id, hoje());
      return repository.findById(atual.id, professorId);
    },
  };
}
