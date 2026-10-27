import { toAplicacao } from '../models/aplicacao.model.js';

// Repository das Aplicações (T18 e T19): ÚNICA camada com SQL desta frente.
// A aplicação é do professor dono da PROVA (RNF04), então toda consulta passa por prova.professor_id.

const SELECT_APLICACAO = `
  SELECT a.id, a.turma_id, a.prova_id, a.status, a.quantidade, a.data_aplicacao,
         a.embaralhar_questoes, a.embaralhar_alternativas, a.vincular_alunos
    FROM aplicacao a
    JOIN prova p ON p.id = a.prova_id`;

export function createAplicacaoRepository(pool) {
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
      const [rows] = await pool.query(`${SELECT_APLICACAO} WHERE p.professor_id = ? ORDER BY a.id`, [professorId]);
      return rows.map(toAplicacao);
    },

    async findById(id, professorId) {
      const [rows] = await pool.query(`${SELECT_APLICACAO} WHERE a.id = ? AND p.professor_id = ?`, [id, professorId]);
      return rows.length ? toAplicacao(rows[0]) : null;
    },

    async findProva(provaId, professorId) {
      const [rows] = await pool.query('SELECT id, status FROM prova WHERE id = ? AND professor_id = ?', [provaId, professorId]);
      return rows[0] ?? null;
    },

    async findTurma(turmaId, professorId) {
      const [rows] = await pool.query('SELECT id, status FROM turma WHERE id = ? AND professor_id = ?', [turmaId, professorId]);
      return rows[0] ?? null;
    },

    // Cria a aplicação PENDENTE e, na MESMA transação, aplica a regra da T19:
    // a prova em Rascunho vira Pronta na primeira aplicação.
    async create({ provaId, turmaId, quantidade }) {
      const id = await comTransacao(async (conn) => {
        const [res] = await conn.query(
          "INSERT INTO aplicacao (turma_id, prova_id, status, quantidade) VALUES (?, ?, 'PENDENTE', ?)",
          [turmaId, provaId, quantidade]
        );
        await conn.query("UPDATE prova SET status = 'PRONTA' WHERE id = ? AND status = 'RASCUNHO'", [provaId]);
        return res.insertId;
      });
      const [rows] = await pool.query(
        `SELECT a.id, a.turma_id, a.prova_id, a.status, a.quantidade, a.data_aplicacao,
                a.embaralhar_questoes, a.embaralhar_alternativas, a.vincular_alunos, p.status AS prova_status
           FROM aplicacao a JOIN prova p ON p.id = a.prova_id WHERE a.id = ?`,
        [id]
      );
      return toAplicacao(rows[0]);
    },

    async updateConfig(id, campos) {
      const colunas = { quantity: 'quantidade', shuffleQuestions: 'embaralhar_questoes', shuffleAlternatives: 'embaralhar_alternativas', linkToRoster: 'vincular_alunos' };
      const sets = [];
      const valores = [];
      for (const [campo, coluna] of Object.entries(colunas)) {
        if (campos[campo] !== undefined) {
          sets.push(`${coluna} = ?`);
          valores.push(typeof campos[campo] === 'boolean' ? (campos[campo] ? 1 : 0) : campos[campo]);
        }
      }
      await pool.query(`UPDATE aplicacao SET ${sets.join(', ')} WHERE id = ?`, [...valores, id]);
    },

    async marcarAplicada(id, dataAplicacao) {
      await pool.query(
        "UPDATE aplicacao SET status = 'APLICADA', data_aplicacao = COALESCE(data_aplicacao, ?) WHERE id = ?",
        [dataAplicacao, id]
      );
    },
  };
}
