import { withTransaction } from './transaction.js';

export function createQuestoesRepository({ pool }) {
  return {
    withTransaction: (operation) => withTransaction(pool, operation),

    async limparTags(connection, questaoId) {
      const [result] = await connection.execute(
        'DELETE FROM questao_tag WHERE questao_id = ?',
        [questaoId],
      );
      return result;
    },

    async inserirTag(connection, nome) {
      const [result] = await connection.execute(
        'INSERT IGNORE INTO tag (nome) VALUES (?)',
        [nome],
      );
      return result;
    },

    async buscarTag(connection, nome) {
      const [result] = await connection.execute(
        'SELECT id FROM tag WHERE nome = ?',
        [nome],
      );
      return result;
    },

    async vincularTag(connection, questaoId, tagId) {
      const [result] = await connection.execute(
        'INSERT IGNORE INTO questao_tag (questao_id, tag_id) VALUES (?, ?)',
        [questaoId, tagId],
      );
      return result;
    },

    async limparAlternativas(connection, questaoId) {
      const [result] = await connection.execute(
        'DELETE FROM alternativa WHERE questao_id = ?',
        [questaoId],
      );
      return result;
    },

    async inserirAlternativa(connection, questaoId, texto, correta, ordem) {
      const [result] = await connection.execute(
        `INSERT INTO alternativa (questao_id, texto, correta, ordem)
        VALUES (?, ?, ?, ?)`,
        [questaoId, texto, correta, ordem],
      );
      return result;
    },

    async listarTags(questaoId) {
      const [result] = await pool.execute(
        `SELECT t.nome
        FROM tag t
        INNER JOIN questao_tag qt ON qt.tag_id = t.id
        WHERE qt.questao_id = ?
        ORDER BY t.nome`,
        [questaoId],
      );
      return result;
    },

    async listarAlternativas(questaoId) {
      const [result] = await pool.execute(
        `SELECT texto, correta, ordem
        FROM alternativa
        WHERE questao_id = ?
        ORDER BY ordem`,
        [questaoId],
      );
      return result;
    },

    async listar(professorId) {
      const [result] = await pool.execute(
        `SELECT id, enunciado, imagem_url
        FROM questao
        WHERE professor_id = ? AND excluida_em IS NULL
        ORDER BY id DESC`,
        [professorId],
      );
      return result;
    },

    async inserir(connection, professorId, enunciado, imagemUrl) {
      const [result] = await connection.execute(
        `INSERT INTO questao (professor_id, tipo, enunciado, imagem_url)
        VALUES (?, 'OBJETIVA', ?, ?)`,
        [professorId, enunciado, imagemUrl],
      );
      return result;
    },

    async bloquear(connection, id, professorId) {
      const [result] = await connection.execute(
        `SELECT id FROM questao
        WHERE id = ? AND professor_id = ? AND excluida_em IS NULL
        FOR UPDATE`,
        [id, professorId],
      );
      return result;
    },

    async atualizar(connection, enunciado, imagemUrl, id, professorId) {
      const [result] = await connection.execute(
        `UPDATE questao
        SET enunciado = ?, imagem_url = ?
        WHERE id = ? AND professor_id = ?`,
        [enunciado, imagemUrl, id, professorId],
      );
      return result;
    },

    async excluir(id, professorId) {
      const [result] = await pool.execute(
        `UPDATE questao
        SET excluida_em = CURRENT_TIMESTAMP
        WHERE id = ? AND professor_id = ? AND excluida_em IS NULL`,
        [id, professorId],
      );
      return result;
    },
  };
}
