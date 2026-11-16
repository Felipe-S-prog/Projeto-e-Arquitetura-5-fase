import { AppError } from '../errors/AppError.js';
import { lerAlunosCsv, validarAluno } from '../utils/alunosCsv.js';

function idValido(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw AppError.badRequest('ID inválido.');
  return id;
}

export function createMatriculasService({ pool }) {
  async function transaction(turmaId, professorId, action) {
    const id = idValido(turmaId);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [turmas] = await conn.execute('SELECT id, status FROM turma WHERE id = ? AND professor_id = ? FOR UPDATE', [id, professorId]);
      if (!turmas.length) throw AppError.notFound('Turma não encontrada.');
      if (turmas[0].status !== 'ATIVA') throw AppError.badRequest('Esta turma está arquivada e não permite alterar matrículas.');
      const result = await action(conn, id);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally { conn.release(); }
  }

  async function enroll(conn, turmaId, aluno) {
    // O e-mail é único. Uma disputa entre turmas reutiliza o cadastro sem
    // alterar dados pessoais que possam estar associados a outro professor.
    await conn.execute('INSERT INTO aluno (nome, email, numero_matricula) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)', [aluno.nome, aluno.email, aluno.numero_matricula]);
    const [rows] = await conn.execute('SELECT id, nome, email, numero_matricula FROM aluno WHERE email = ?', [aluno.email]);
    const saved = rows[0];
    const [result] = await conn.execute('INSERT IGNORE INTO matricula (turma_id, aluno_id) VALUES (?, ?)', [turmaId, saved.id]);
    return { duplicate: result.affectedRows === 0, student: { id: Number(saved.id), name: saved.nome, email: saved.email, numeroMatricula: saved.numero_matricula } };
  }

  return {
    async matricular(turmaId, professorId, body) {
      const aluno = validarAluno(body);
      return transaction(turmaId, professorId, async (conn, id) => {
        const result = await enroll(conn, id, aluno);
        if (result.duplicate) throw AppError.badRequest('Este aluno já está matriculado nesta turma.');
        return result.student;
      });
    },
    async remover(turmaId, professorId, alunoId) {
      const studentId = idValido(alunoId);
      return transaction(turmaId, professorId, async (conn, id) => {
        const [result] = await conn.execute('DELETE FROM matricula WHERE turma_id = ? AND aluno_id = ?', [id, studentId]);
        if (!result.affectedRows) throw AppError.notFound('Matrícula não encontrada.');
        return { message: 'Aluno removido da turma. Cadastro, cópias e notas foram preservados.' };
      });
    },
    async importar(turmaId, professorId, csv) {
      const rows = lerAlunosCsv(csv);
      return transaction(turmaId, professorId, async (conn, id) => {
        const imported = [], rejected = [], seen = new Set();
        for (const row of rows) {
          let aluno;
          try {
            if (row.invalidColumns) throw AppError.badRequest('Quantidade de colunas diferente do cabeçalho.');
            aluno = validarAluno(row.body);
            if (seen.has(aluno.email)) throw AppError.badRequest('E-mail repetido no arquivo.');
            seen.add(aluno.email);
          } catch (error) {
            rejected.push({ line: row.line, message: error.message });
            continue;
          }
          const result = await enroll(conn, id, aluno);
          if (result.duplicate) rejected.push({ line: row.line, message: 'Aluno já matriculado nesta turma.' });
          else imported.push(result.student);
        }
        return { total: rows.length, imported, rejected };
      });
    },
  };
}
