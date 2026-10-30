import { toCopiaDaProva } from '../models/copia.model.js';

// Repository das Cópias da Prova (T23): ÚNICA camada com SQL desta frente.
// A cópia é do professor dono da PROVA da aplicação (RNF04), então toda consulta passa por prova.professor_id.

const SELECT_COPIA = `
  SELECT cp.id, cp.aplicacao_id, cp.codigo, cp.rotulo, cp.ordem_embaralhamento,
         cp.gabarito_publicado, cp.gabarito_publicado_em, cp.aluno_id, al.nome AS aluno_nome
    FROM copia_prova cp
    JOIN aplicacao a ON a.id = cp.aplicacao_id
    JOIN prova p ON p.id = a.prova_id
    LEFT JOIN aluno al ON al.id = cp.aluno_id`;

export function createCopiaRepository(pool) {
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
      const [rows] = await pool.query(`${SELECT_COPIA} WHERE p.professor_id = ? ORDER BY cp.aplicacao_id, cp.id`, [professorId]);
      return rows.map(toCopiaDaProva);
    },

    async listByAplicacao(aplicacaoId, professorId) {
      const [rows] = await pool.query(`${SELECT_COPIA} WHERE cp.aplicacao_id = ? AND p.professor_id = ? ORDER BY cp.id`, [
        aplicacaoId,
        professorId,
      ]);
      return rows.map(toCopiaDaProva);
    },

    async findAplicacao(aplicacaoId, professorId) {
      const [rows] = await pool.query(
        `SELECT a.id, a.prova_id, a.turma_id, a.status, a.quantidade, a.embaralhar_questoes, a.embaralhar_alternativas, a.vincular_alunos
           FROM aplicacao a
           JOIN prova p ON p.id = a.prova_id
          WHERE a.id = ? AND p.professor_id = ?`,
        [aplicacaoId, professorId]
      );
      if (!rows.length) return null;
      const row = rows[0];
      return {
        id: row.id,
        provaId: row.prova_id,
        turmaId: row.turma_id,
        status: row.status,
        quantidade: row.quantidade,
        embaralharQuestoes: Boolean(row.embaralhar_questoes),
        embaralharAlternativas: Boolean(row.embaralhar_alternativas),
        vincularAlunos: Boolean(row.vincular_alunos),
      };
    },

    // Questões da prova na ordem da prova, com quantas alternativas cada uma tem.
    async listQuestoesDaProva(provaId) {
      const [rows] = await pool.query(
        `SELECT pq.questao_id AS id, COUNT(alt.id) AS total_alternativas
           FROM prova_questao pq
           LEFT JOIN alternativa alt ON alt.questao_id = pq.questao_id
          WHERE pq.prova_id = ?
          GROUP BY pq.questao_id, pq.posicao
          ORDER BY pq.posicao`,
        [provaId]
      );
      return rows.map((r) => ({ id: r.id, totalAlternativas: Number(r.total_alternativas) }));
    },

    // Alunos matriculados na turma (T15), em ordem alfabética: uma cópia nominal para cada (T24).
    async listAlunosDaTurma(turmaId) {
      const [rows] = await pool.query(
        `SELECT al.id, al.nome
           FROM matricula m
           JOIN aluno al ON al.id = m.aluno_id
          WHERE m.turma_id = ?
          ORDER BY al.nome, al.id`,
        [turmaId]
      );
      return rows.map((r) => ({ id: r.id, nome: r.nome }));
    },

    // Todos os códigos já usados no banco: os de cópias antigas também, para um código impresso
    // e depois descartado nunca voltar a valer para outra pessoa.
    async listCodigos() {
      const [rows] = await pool.query('SELECT codigo FROM copia_prova');
      return rows.map((r) => r.codigo);
    },

    async countCorrecoes(aplicacaoId) {
      const [rows] = await pool.query(
        'SELECT COUNT(*) AS total FROM correcao c JOIN copia_prova cp ON cp.id = c.copia_prova_id WHERE cp.aplicacao_id = ?',
        [aplicacaoId]
      );
      return Number(rows[0].total);
    },

    // Troca as cópias da aplicação pelas novas, na mesma transação, e ajusta a quantidade.
    async substituirCopias(aplicacaoId, copias) {
      await comTransacao(async (conn) => {
        await conn.query('DELETE FROM copia_prova WHERE aplicacao_id = ?', [aplicacaoId]);
        if (copias.length > 0) {
          const valores = copias.map((c) => [aplicacaoId, c.alunoId ?? null, c.codigo, c.rotulo, JSON.stringify(c.ordem)]);
          await conn.query(
            'INSERT INTO copia_prova (aplicacao_id, aluno_id, codigo, rotulo, ordem_embaralhamento) VALUES ?',
            [valores]
          );
        }
        await conn.query('UPDATE aplicacao SET quantidade = ? WHERE id = ?', [copias.length, aplicacaoId]);
      });
    },

    // codigo nulo publica todas as cópias da aplicação; quem já estava publicado mantém a data.
    async publicarGabarito(aplicacaoId, codigo) {
      const [res] = await pool.query(
        `UPDATE copia_prova
            SET gabarito_publicado = 1, gabarito_publicado_em = UTC_TIMESTAMP()
          WHERE aplicacao_id = ? AND gabarito_publicado = 0 ${codigo ? 'AND codigo = ?' : ''}`,
        codigo ? [aplicacaoId, codigo] : [aplicacaoId]
      );
      return res.affectedRows;
    },
  };
}
