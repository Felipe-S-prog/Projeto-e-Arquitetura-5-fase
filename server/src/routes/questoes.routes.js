import { Router } from 'express';
import { AppError } from '../errors/AppError.js';

export function createQuestoesRoutes({ pool }) {
  const router = Router();

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
      tags: [...new Set(tags.map((tag) => tag.trim()))],
      alternativas: alternativas.map((item) => ({
        texto: item.texto.trim(),
        correta: item.correta === true,
      })),
    };
  }

  async function salvarTags(connection, questaoId, tags) {
    await connection.execute(
      'DELETE FROM questao_tag WHERE questao_id = ?',
      [questaoId],
    );

    for (const nome of tags) {
      await connection.execute(
        'INSERT IGNORE INTO tag (nome) VALUES (?)',
        [nome],
      );

      const [rows] = await connection.execute(
        'SELECT id FROM tag WHERE nome = ?',
        [nome],
      );

      await connection.execute(
        'INSERT INTO questao_tag (questao_id, tag_id) VALUES (?, ?)',
        [questaoId, rows[0].id],
      );
    }
  }

  async function salvarAlternativas(connection, questaoId, alternativas) {
    await connection.execute(
      'DELETE FROM alternativa WHERE questao_id = ?',
      [questaoId],
    );

    for (const [ordem, alternativa] of alternativas.entries()) {
      await connection.execute(
        `INSERT INTO alternativa (questao_id, texto, correta, ordem)
         VALUES (?, ?, ?, ?)`,
        [questaoId, alternativa.texto, alternativa.correta ? 1 : 0, ordem],
      );
    }
  }

  async function montarQuestao(row, pool) {
    const [tagRows] = await pool.execute(
      `SELECT t.nome
       FROM tag t
       INNER JOIN questao_tag qt ON qt.tag_id = t.id
       WHERE qt.questao_id = ?
       ORDER BY t.nome`,
      [row.id],
    );

    const [alternativaRows] = await pool.execute(
      `SELECT texto, correta, ordem
       FROM alternativa
       WHERE questao_id = ?
       ORDER BY ordem`,
      [row.id],
    );

    return {
      id: row.id,
      excerpt: row.enunciado,
      tags: tagRows.map((tag) => tag.nome),
      imageUrl: row.imagem_url,
      alternatives: alternativaRows.map((alternativa) => ({
        text: alternativa.texto,
        correct: Boolean(alternativa.correta),
      })),
    };
  }

  router.get('/', async (req, res, next) => {
    try {
      const professorId = validarId(req.query.professor_id, 'ID do professor');

      const [rows] = await pool.execute(
        `SELECT id, enunciado, imagem_url
         FROM questao
         WHERE professor_id = ? AND excluida_em IS NULL
         ORDER BY id DESC`,
        [professorId],
      );

      const questoes = [];
      for (const row of rows) {
        questoes.push(await montarQuestao(row, pool));
      }

      res.json(questoes);
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (req, res, next) => {
    let connection;

    try {
      const professorId = validarId(req.body?.professor_id, 'ID do professor');
      const questao = validarQuestao(req.body);

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [result] = await connection.execute(
        `INSERT INTO questao (professor_id, tipo, enunciado, imagem_url)
         VALUES (?, 'OBJETIVA', ?, ?)`,
        [professorId, questao.enunciado, questao.imagemUrl],
      );

      await salvarTags(connection, result.insertId, questao.tags);
      await salvarAlternativas(connection, result.insertId, questao.alternativas);
      await connection.commit();

      res.status(201).json({
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
      });
    } catch (error) {
      if (connection) await connection.rollback();
      next(error);
    } finally {
      connection?.release();
    }
  });

  router.put('/:id', async (req, res, next) => {
    let connection;

    try {
      const id = validarId(req.params.id, 'ID da questão');
      const professorId = validarId(req.body?.professor_id, 'ID do professor');
      const questao = validarQuestao(req.body);

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [existentes] = await connection.execute(
        `SELECT id FROM questao
         WHERE id = ? AND professor_id = ? AND excluida_em IS NULL
         FOR UPDATE`,
        [id, professorId],
      );

      if (existentes.length === 0) {
        throw AppError.notFound('Questão não encontrada para este professor.');
      }

      await connection.execute(
        `UPDATE questao
         SET enunciado = ?, imagem_url = ?
         WHERE id = ? AND professor_id = ?`,
        [questao.enunciado, questao.imagemUrl, id, professorId],
      );

      await salvarTags(connection, id, questao.tags);
      await salvarAlternativas(connection, id, questao.alternativas);
      await connection.commit();

      res.json({
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
      });
    } catch (error) {
      if (connection) await connection.rollback();
      next(error);
    } finally {
      connection?.release();
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const id = validarId(req.params.id, 'ID da questão');
      const professorId = validarId(req.query.professor_id, 'ID do professor');

      const [result] = await pool.execute(
        `UPDATE questao
         SET excluida_em = CURRENT_TIMESTAMP
         WHERE id = ? AND professor_id = ? AND excluida_em IS NULL`,
        [id, professorId],
      );

      if (result.affectedRows === 0) {
        throw AppError.notFound('Questão não encontrada para este professor.');
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
