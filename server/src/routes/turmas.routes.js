
import { Router } from 'express';
import { AppError } from '../errors/AppError.js';

export function createTurmasRoutes({ pool }) {
  const router = Router();

  function mapTurma(row) {
    return {
      id: row.id,
      name: row.nome,
      subject: row.disciplina,
      period: row.periodo,
      status: row.status === 'ARQUIVADA' ? 'Arquivada' : 'Ativa',
      students: [],
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

    if (nome.trim().length > 100 ||
        disciplina.trim().length > 80 ||
        periodo.trim().length > 10) {
      throw AppError.badRequest(
        'O nome aceita até 100 caracteres, a disciplina 80 e o período 10.',
      );
    }
  }

  function validarProfessorId(value) {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
      throw AppError.badRequest('Informe um professor_id válido.');
    }
    return id;
  }

  // Listar turmas do professor.
  router.get('/', async (req, res, next) => {
    try {
      const professorId = validarProfessorId(req.query.professor_id);

      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status
         FROM turma
         WHERE professor_id = ?
         ORDER BY id DESC`,
        [professorId],
      );

      res.json(rows.map(mapTurma));
    } catch (error) {
      next(error);
    }
  });

  // Criar turma.
  router.post('/', async (req, res, next) => {
    try {
      const professorId = validarProfessorId(req.body.professor_id);
      const { nome, disciplina, periodo } = req.body;
      validarDados({ nome, disciplina, periodo });

      const [result] = await pool.execute(
        `INSERT INTO turma (professor_id, nome, disciplina, periodo)
         VALUES (?, ?, ?, ?)`,
        [professorId, nome.trim(), disciplina.trim(), periodo.trim()],
      );

      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status
         FROM turma WHERE id = ? AND professor_id = ?`,
        [result.insertId, professorId],
      );

      res.status(201).json(mapTurma(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  // Editar turma.
  router.put('/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const professorId = validarProfessorId(req.body.professor_id);
      const { nome, disciplina, periodo } = req.body;

      if (!Number.isInteger(id) || id <= 0) {
        throw AppError.badRequest('ID de turma inválido.');
      }

      validarDados({ nome, disciplina, periodo });

      const [result] = await pool.execute(
        `UPDATE turma
         SET nome = ?, disciplina = ?, periodo = ?
         WHERE id = ? AND professor_id = ? AND status = 'ATIVA'`,
        [nome.trim(), disciplina.trim(), periodo.trim(), id, professorId],
      );

      if (result.affectedRows === 0) {
        const [rows] = await pool.execute(
          'SELECT id FROM turma WHERE id = ? AND professor_id = ?',
          [id, professorId],
        );
        if (!rows.length) throw AppError.notFound('Turma não encontrada.');
        throw AppError.badRequest('Turmas arquivadas não podem ser editadas.');
      }

      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status
         FROM turma WHERE id = ? AND professor_id = ?`,
        [id, professorId],
      );

      res.json(mapTurma(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  // Arquivar turma sem apagar seu histórico.
  router.patch('/:id/arquivar', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const professorId = validarProfessorId(req.body.professor_id);

      if (!Number.isInteger(id) || id <= 0) {
        throw AppError.badRequest('ID de turma inválido.');
      }

      const [result] = await pool.execute(
        `UPDATE turma SET status = 'ARQUIVADA'
         WHERE id = ? AND professor_id = ? AND status = 'ATIVA'`,
        [id, professorId],
      );

      if (result.affectedRows === 0) {
        const [rows] = await pool.execute(
          'SELECT id FROM turma WHERE id = ? AND professor_id = ?',
          [id, professorId],
        );
        if (!rows.length) throw AppError.notFound('Turma não encontrada.');
      }

      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status
         FROM turma WHERE id = ? AND professor_id = ?`,
        [id, professorId],
      );

      res.json(mapTurma(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
