import { AppError } from '../errors/AppError.js';

// Limites do modelo de dados (docs/modelo-dados) e do RF04.
export const MAX_QUESTOES_POR_PROVA = 20;
const MAX_TITULO = 150;
const MAX_PONTUACAO = 999.99; // prova_questao.pontuacao é DECIMAL(5,2)

function parseId(valor, mensagem) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest(mensagem);
  return id;
}

// Valida e normaliza o corpo recebido do front: { title, description, questions: [{ questionId, score }] }.
function validarDados(body) {
  const titulo = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!titulo) throw AppError.badRequest('Informe o título da prova.');
  if (titulo.length > MAX_TITULO) throw AppError.badRequest(`O título aceita até ${MAX_TITULO} caracteres.`);

  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    throw AppError.badRequest('A descrição deve ser um texto.');
  }
  const descricao = (body.description ?? '').trim() || null;

  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    throw AppError.badRequest('Selecione pelo menos uma questão para a prova.');
  }
  if (body.questions.length > MAX_QUESTOES_POR_PROVA) {
    throw AppError.badRequest(`Uma prova aceita no máximo ${MAX_QUESTOES_POR_PROVA} questões.`);
  }

  const vistos = new Set();
  const questoes = body.questions.map((item) => {
    const questionId = Number(item?.questionId);
    const score = Number(item?.score);
    if (!Number.isInteger(questionId) || questionId <= 0) throw AppError.badRequest('Questão inválida na prova.');
    if (vistos.has(questionId)) throw AppError.badRequest('A mesma questão não pode aparecer duas vezes na prova.');
    vistos.add(questionId);
    if (!Number.isFinite(score) || score <= 0 || score > MAX_PONTUACAO) {
      throw AppError.badRequest(`A pontuação de cada questão deve ser maior que 0 e no máximo ${MAX_PONTUACAO}.`);
    }
    return { questionId, score: Math.round(score * 100) / 100 };
  });

  return { titulo, descricao, questoes };
}

// Service das Provas (T17). Regras de negócio:
// - a prova é sempre do professor logado (RNF04);
// - de 1 a 20 questões, cada uma com pontuação > 0 (RF04);
// - só entram questões do próprio professor que não foram excluídas;
// - status: nasce "Rascunho"; só Rascunho pode ter as questões alteradas (T19 faz o Rascunho -> Pronta);
// - arquivar é manual e vale para Rascunho e Pronta.
export function createProvaService(repository) {
  async function buscarDoProfessor(idBruto, professorId) {
    const id = parseId(idBruto, 'Prova inválida.');
    const prova = await repository.findById(id, professorId);
    if (!prova) throw AppError.notFound('Prova não encontrada.');
    return prova;
  }

  async function conferirQuestoes(questoes, professorId) {
    const ids = questoes.map((q) => q.questionId);
    const disponiveis = new Set(await repository.findQuestoesDisponiveis(ids, professorId));
    const faltando = ids.filter((id) => !disponiveis.has(id));
    if (faltando.length > 0) {
      throw AppError.badRequest('Há questões que não existem, foram excluídas ou não pertencem a você.', { questionIds: faltando });
    }
  }

  return {
    listar(professorId) {
      return repository.listByProfessor(professorId);
    },

    buscar(id, professorId) {
      return buscarDoProfessor(id, professorId);
    },

    async criar(body, professorId) {
      const dados = validarDados(body);
      await conferirQuestoes(dados.questoes, professorId);
      return repository.create({ professorId, ...dados });
    },

    async atualizar(id, body, professorId) {
      const atual = await buscarDoProfessor(id, professorId);
      if (atual.status !== 'Rascunho') {
        throw AppError.conflict(`Só é possível editar uma prova em Rascunho (esta está ${atual.status}).`);
      }
      const dados = validarDados(body);
      await conferirQuestoes(dados.questoes, professorId);
      return repository.update(atual.id, professorId, dados);
    },

    async arquivar(id, professorId) {
      const atual = await buscarDoProfessor(id, professorId);
      if (atual.status === 'Arquivada') throw AppError.conflict('A prova já está arquivada.');
      return repository.updateStatus(atual.id, professorId, 'ARQUIVADA');
    },
  };
}
