import { AppError } from '../errors/AppError.js';
import { createQuestoesRepository } from '../repositories/questoes.repository.js';
import { normalizeTags } from '../utils/tags.js';

export function createQuestoesService({ pool }) {
  const repository = createQuestoesRepository({ pool });

  function validarId(value, campo = 'ID') {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
      throw AppError.badRequest(`${campo} inválido.`);
    }

    return id;
  }

  function validarQuestao(body) {
    const enunciado = body?.enunciado?.trim();
    const imagemUrl = body?.imagem_url?.trim() || null;
    const tags = body?.tags;
    const alternativas = body?.alternativas;

    if (!enunciado) {
      throw AppError.badRequest('O enunciado é obrigatório.');
    }

    if (imagemUrl && imagemUrl.length > 500) {
      throw AppError.badRequest('A URL da imagem deve ter no máximo 500 caracteres.');
    }

    if (!Array.isArray(tags) || tags.some(
      (tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 50
    )) {
      throw AppError.badRequest('Informe uma lista válida de tags, com até 50 caracteres cada.');
    }

    if (
      !Array.isArray(alternativas) ||
      alternativas.length < 2 ||
      alternativas.length > 5 ||
      alternativas.some((item) => typeof item?.texto !== 'string' || !item.texto.trim())
    ) {
      throw AppError.badRequest('A questão deve ter de 2 a 5 alternativas preenchidas.');
    }

    if (alternativas.filter((item) => item.correta === true).length !== 1) {
      throw AppError.badRequest('Selecione exatamente uma alternativa correta.');
    }

    return {
      enunciado,
      imagemUrl,
      tags: normalizeTags(tags),
      alternativas: alternativas.map((item) => ({
        texto: item.texto.trim(),
        correta: item.correta === true,
      })),
    };
  }

  async function salvarTags(connection, questaoId, tags) {
    await repository.limparTags(connection, questaoId);

    for (const nome of tags) {
      await repository.inserirTag(connection, nome);

      const rows = await repository.buscarTag(connection, nome);

      await repository.vincularTag(connection, questaoId, rows[0].id);
    }
  }

  async function salvarAlternativas(connection, questaoId, alternativas) {
    await repository.limparAlternativas(connection, questaoId);

    for (const [ordem, alternativa] of alternativas.entries()) {
      await repository.inserirAlternativa(connection, questaoId, alternativa.texto, alternativa.correta ? 1 : 0, ordem);
    }
  }

  async function montarQuestao(row) {
    const tagRows = await repository.listarTags(row.id);

    const alternativaRows = await repository.listarAlternativas(row.id);

    return {
      id: row.id,
      excerpt: row.enunciado,
      tags: normalizeTags(tagRows.map((tag) => tag.nome)),
      imageUrl: row.imagem_url,
      alternatives: alternativaRows.map((alternativa) => ({
        text: alternativa.texto,
        correct: Boolean(alternativa.correta),
      })),
    };
  }

  async function listar(professorId) {
    const rows = await repository.listar(professorId);

    const questoes = [];
    for (const row of rows) {
      questoes.push(await montarQuestao(row));
    }

    return questoes;
  }

  async function criar(professorId, dados) {
    const questao = validarQuestao(dados);

    return repository.withTransaction(async (connection) => {
      const result = await repository.inserir(connection, professorId, questao.enunciado, questao.imagemUrl);

      await salvarTags(connection, result.insertId, questao.tags);
      await salvarAlternativas(connection, result.insertId, questao.alternativas);

      return {
        question: {
          id: result.insertId,
          excerpt: questao.enunciado,
          tags: questao.tags,
          imageUrl: questao.imagemUrl,
          alternatives: questao.alternativas.map((item) => ({
            text: item.texto,
            correct: item.correta,
          })),
        },
      };
    });
  }

  async function editar(questaoId, professorId, dados) {
    const id = validarId(questaoId, 'ID da questão');
    const questao = validarQuestao(dados);

    return repository.withTransaction(async (connection) => {
      const existentes = await repository.bloquear(connection, id, professorId);

      if (existentes.length === 0) {
        throw AppError.notFound('Questão não encontrada para este professor.');
      }

      await repository.atualizar(connection, questao.enunciado, questao.imagemUrl, id, professorId);

      await salvarTags(connection, id, questao.tags);
      await salvarAlternativas(connection, id, questao.alternativas);

      return {
        question: {
          id,
          excerpt: questao.enunciado,
          tags: questao.tags,
          imageUrl: questao.imagemUrl,
          alternatives: questao.alternativas.map((item) => ({
            text: item.texto,
            correct: item.correta,
          })),
        },
      };
    });
  }

  async function excluir(questaoId, professorId) {
    const id = validarId(questaoId, 'ID da questão');

    const result = await repository.excluir(id, professorId);

    if (result.affectedRows === 0) {
      throw AppError.notFound('Questão não encontrada para este professor.');
    }
  }

  return { listar, criar, editar, excluir };
}
