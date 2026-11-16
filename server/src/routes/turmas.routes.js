import { Router } from 'express';
import { AppError } from '../errors/AppError.js';
import { createMatriculasService } from '../services/matriculas.service.js';
import { professorContext } from '../middlewares/professorContext.js';

export function createTurmasRoutes({ pool }) {
  const router = Router();
  router.use(professorContext);
  const matriculas = createMatriculasService({ pool });

  async function mapTurma(row) {
  const [alunos] = await pool.execute(
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
    [row.id],
  );

  return {
    id: Number(row.id),
    name: row.nome,
    subject: row.disciplina,
    period: row.periodo,
    status: row.status === 'ARQUIVADA' ? 'Arquivada' : 'Ativa',
    codigoConvite: row.codigo_convite ?? null,
    students: alunos.map((aluno) => ({
      id: Number(aluno.id),
      name: aluno.nome,
      email: aluno.email,
      numeroMatricula: aluno.numero_matricula,
      matriculadoEm: aluno.matriculado_em,
    })),
  };
}

  function validarDados({ nome, disciplina, periodo }) {
    if (
      typeof nome !== 'string' ||
      !nome.trim() ||
      typeof disciplina !== 'string' ||
      !disciplina.trim() ||
      typeof periodo !== 'string' ||
      !periodo.trim()
    ) {
      throw AppError.badRequest(
        'Informe o nome, a disciplina e o período da turma.',
      );
    }

    if (
      nome.trim().length > 100 ||
      disciplina.trim().length > 80 ||
      periodo.trim().length > 10
    ) {
      throw AppError.badRequest(
        'O nome aceita até 100 caracteres, a disciplina 80 e o período 10.',
      );
    }
  }

  // Listar turmas do professor.
  router.get('/', async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status, codigo_convite
         FROM turma
         WHERE professor_id = ?
         ORDER BY id DESC`,
        [req.professorId],
      );

      res.json(await Promise.all(rows.map(mapTurma)));
    } catch (error) {
      next(error);
    }
  });

  // Criar turma. Alunos são cadastrados pelo professor.
  router.post('/', async (req, res, next) => {
    try {
      const { nome, disciplina, periodo } = req.body;
      validarDados({ nome, disciplina, periodo });


      const [result] = await pool.execute(
        `INSERT INTO turma
          (professor_id, nome, disciplina, periodo)
         VALUES (?, ?, ?, ?)`,
        [
          req.professorId,
          nome.trim(),
          disciplina.trim(),
          periodo.trim(),
        ],
      );

      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status, codigo_convite
         FROM turma
         WHERE id = ? AND professor_id = ?`,
        [result.insertId, req.professorId],
      );

      res.status(201).json(await mapTurma(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/matriculas', async (req, res, next) => {
    try { res.status(201).json(await matriculas.matricular(req.params.id, req.professorId, req.body)); }
    catch (error) { next(error); }
  });
  router.delete('/:id/matriculas/:alunoId', async (req, res, next) => {
    try { res.json(await matriculas.remover(req.params.id, req.professorId, req.params.alunoId)); }
    catch (error) { next(error); }
  });
  router.post('/:id/matriculas/importar', async (req, res, next) => {
    try { res.json(await matriculas.importar(req.params.id, req.professorId, req.body?.csv)); }
    catch (error) { next(error); }
  });

  // Editar turma.
  router.put('/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const { nome, disciplina, periodo } = req.body;

      if (!Number.isInteger(id) || id <= 0) {
        throw AppError.badRequest('ID de turma inválido.');
      }

      validarDados({ nome, disciplina, periodo });

      const [result] = await pool.execute(
        `UPDATE turma
         SET nome = ?, disciplina = ?, periodo = ?
         WHERE id = ? AND professor_id = ?`,
        [nome.trim(), disciplina.trim(), periodo.trim(), id, req.professorId],
      );

      if (result.affectedRows === 0) {
        const [rows] = await pool.execute(
          'SELECT id FROM turma WHERE id = ? AND professor_id = ?',
          [id, req.professorId],
        );

        if (!rows.length) throw AppError.notFound('Turma não encontrada.');

      }

      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status, codigo_convite
         FROM turma
         WHERE id = ? AND professor_id = ?`,
        [id, req.professorId],
      );

      res.json(await mapTurma(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  // Arquivar turma sem apagar seu histórico.
  router.patch('/:id/arquivar', async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw AppError.badRequest('ID de turma inválido.');
      }

      const [result] = await pool.execute(
        `UPDATE turma SET status = 'ARQUIVADA'
         WHERE id = ? AND professor_id = ? AND status = 'ATIVA'`,
        [id, req.professorId],
      );

      if (result.affectedRows === 0) {
        const [existing] = await pool.execute(
          'SELECT id FROM turma WHERE id = ? AND professor_id = ?',
          [id, req.professorId],
        );

        if (!existing.length) {
          throw AppError.notFound('Turma não encontrada.');
        }
      }

      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status, codigo_convite
         FROM turma
         WHERE id = ? AND professor_id = ?`,
        [id, req.professorId],
      );

      res.json(await mapTurma(rows[0]));
    } catch (error) {
      next(error);
    }
  });


  // Turmas com aplicações são arquivadas; o histórico nunca é apagado.
  router.delete('/:id', async (req, res, next) => {
    let connection;
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('ID de turma inválido.');
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [turmas] = await connection.execute(
        'SELECT id FROM turma WHERE id = ? AND professor_id = ? FOR UPDATE',
        [id, req.professorId],
      );
      if (!turmas.length) throw AppError.notFound('Turma não encontrada.');
      const [aplicacoes] = await connection.execute(
        'SELECT id FROM aplicacao WHERE turma_id = ? LIMIT 1', [id],
      );
      if (aplicacoes.length) {
        await connection.execute("UPDATE turma SET status = 'ARQUIVADA' WHERE id = ? AND professor_id = ?", [id, req.professorId]);
      } else {
        await connection.execute('DELETE FROM turma WHERE id = ? AND professor_id = ?', [id, req.professorId]);
      }
      await connection.commit();
      res.json({
        archived: aplicacoes.length > 0,
        message: aplicacoes.length
          ? 'Turma arquivada para preservar aplicações, cópias e notas.'
          : 'Turma excluída. Os cadastros dos alunos foram preservados.',
      });
    } catch (error) {
      if (connection) await connection.rollback();
      next(error);
    } finally {
      connection?.release();
    }
  });

  return router;
}
