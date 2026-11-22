import { withTransaction } from './transaction.js';

export function createTurmasRepository({ pool }) {
  return {
    withTransaction: (operation) => withTransaction(pool, operation),

    async listarAlunos(id) {
      const [result] = await pool.execute(
        `SELECT
        a.id,
        a.nome,
        a.email,
        a.numero_matricula,
        m.matriculado_em
        FROM matricula m
        INNER JOIN aluno a ON a.id = m.aluno_id
        WHERE m.turma_id = ?
        ORDER BY a.nome`,
        [id],
      );
      return result;
    },

    async listar(professorId) {
      const [result] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status, codigo_convite
        FROM turma
        WHERE professor_id = ?
        ORDER BY id DESC`,
        [professorId],
      );
      return result;
    },

    async inserir(professorId, nome, disciplina, periodo) {
      const [result] = await pool.execute(
        `INSERT INTO turma
        (professor_id, nome, disciplina, periodo)
        VALUES (?, ?, ?, ?)`,
        [professorId, nome, disciplina, periodo],
      );
      return result;
    },

    async buscar(id, professorId) {
      const [result] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status, codigo_convite
        FROM turma
        WHERE id = ? AND professor_id = ?`,
        [id, professorId],
      );
      return result;
    },

    async atualizar(nome, disciplina, periodo, id, professorId) {
      const [result] = await pool.execute(
        `UPDATE turma
        SET nome = ?, disciplina = ?, periodo = ?
        WHERE id = ? AND professor_id = ?`,
        [nome, disciplina, periodo, id, professorId],
      );
      return result;
    },

    async buscarId(id, professorId) {
      const [result] = await pool.execute(
        'SELECT id FROM turma WHERE id = ? AND professor_id = ?',
        [id, professorId],
      );
      return result;
    },

    async arquivar(id, professorId) {
      const [result] = await pool.execute(
        `UPDATE turma SET status = 'ARQUIVADA'
        WHERE id = ? AND professor_id = ? AND status = 'ATIVA'`,
        [id, professorId],
      );
      return result;
    },

    async bloquear(connection, id, professorId) {
      const [result] = await connection.execute(
        'SELECT id FROM turma WHERE id = ? AND professor_id = ? FOR UPDATE',
        [id, professorId],
      );
      return result;
    },

    async buscarAplicacoes(connection, id) {
      const [result] = await connection.execute(
        'SELECT id FROM aplicacao WHERE turma_id = ? LIMIT 1',
        [id],
      );
      return result;
    },

    async arquivarComHistorico(connection, id, professorId) {
      const [result] = await connection.execute(
        "UPDATE turma SET status = 'ARQUIVADA' WHERE id = ? AND professor_id = ?",
        [id, professorId],
      );
      return result;
    },

    async excluir(connection, id, professorId) {
      const [result] = await connection.execute(
        'DELETE FROM turma WHERE id = ? AND professor_id = ?',
        [id, professorId],
      );
      return result;
    },
  };
}
