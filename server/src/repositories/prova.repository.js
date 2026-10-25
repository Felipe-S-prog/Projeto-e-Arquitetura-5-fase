import { toProva } from '../models/prova.model.js';

// Repository das Provas (T17): ÚNICA camada com SQL desta frente.
// Toda consulta filtra pelo professor dono da prova (RNF04: cada professor só vê o que é dele).

const SELECT_PROVA = 'SELECT id, titulo, descricao, status, criada_em FROM prova';

export function createProvaRepository(pool) {
  async function listQuestoes(executor, provaId) {
    const [rows] = await executor.query(
      'SELECT questao_id, posicao, pontuacao FROM prova_questao WHERE prova_id = ? ORDER BY posicao',
      [provaId]
    );
    return rows;
  }

  // prova_questao tem PK (prova_id, questao_id) e UNIQUE (prova_id, posicao):
  // gravamos sempre o conjunto inteiro, com posições 1..N na ordem recebida.
  async function insertQuestoes(conn, provaId, questoes) {
    if (questoes.length === 0) return;
    const valores = questoes.map((q, i) => [provaId, q.questionId, i + 1, q.score]);
    await conn.query('INSERT INTO prova_questao (prova_id, questao_id, posicao, pontuacao) VALUES ?', [valores]);
  }

  async function comTransacao(trabalho) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const resultado = await trabalho(conn);
      await conn.commit();
      return resultado;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  return {
    async listByProfessor(professorId) {
      const [provas] = await pool.query(`${SELECT_PROVA} WHERE professor_id = ? ORDER BY id`, [professorId]);
      if (provas.length === 0) return [];
      const [questoes] = await pool.query(
        `SELECT pq.prova_id, pq.questao_id, pq.posicao, pq.pontuacao
           FROM prova_questao pq JOIN prova p ON p.id = pq.prova_id
          WHERE p.professor_id = ? ORDER BY pq.prova_id, pq.posicao`,
        [professorId]
      );
      return provas.map((p) => toProva(p, questoes.filter((q) => q.prova_id === p.id)));
    },

    async findById(id, professorId) {
      const [rows] = await pool.query(`${SELECT_PROVA} WHERE id = ? AND professor_id = ?`, [id, professorId]);
      if (rows.length === 0) return null;
      return toProva(rows[0], await listQuestoes(pool, id));
    },

    // Quais destes ids são questões do professor e ainda não foram excluídas (soft-delete)?
    async findQuestoesDisponiveis(questaoIds, professorId) {
      if (questaoIds.length === 0) return [];
      const [rows] = await pool.query(
        'SELECT id FROM questao WHERE id IN (?) AND professor_id = ? AND excluida_em IS NULL',
        [questaoIds, professorId]
      );
      return rows.map((r) => r.id);
    },

    async countAplicacoes(provaId) {
      const [rows] = await pool.query('SELECT COUNT(*) AS total FROM aplicacao WHERE prova_id = ?', [provaId]);
      return Number(rows[0].total);
    },

    async create({ professorId, titulo, descricao, questoes }) {
      const provaId = await comTransacao(async (conn) => {
        const [res] = await conn.query(
          "INSERT INTO prova (professor_id, titulo, descricao, status) VALUES (?, ?, ?, 'RASCUNHO')",
          [professorId, titulo, descricao]
        );
        await insertQuestoes(conn, res.insertId, questoes);
        return res.insertId;
      });
      return this.findById(provaId, professorId);
    },

    async update(provaId, professorId, { titulo, descricao, questoes }) {
      await comTransacao(async (conn) => {
        await conn.query('UPDATE prova SET titulo = ?, descricao = ? WHERE id = ? AND professor_id = ?', [
          titulo,
          descricao,
          provaId,
          professorId,
        ]);
        await conn.query('DELETE FROM prova_questao WHERE prova_id = ?', [provaId]);
        await insertQuestoes(conn, provaId, questoes);
      });
      return this.findById(provaId, professorId);
    },

    async updateStatus(provaId, professorId, status) {
      await pool.query('UPDATE prova SET status = ? WHERE id = ? AND professor_id = ?', [status, provaId, professorId]);
      return this.findById(provaId, professorId);
    },
  };
}
