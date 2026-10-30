
import { Router } from 'express';
import { AppError } from '../errors/AppError.js';

export function createIngressoTurmaRoutes({ pool }) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    let connection;
    let transactionStarted = false;

    try {
      const nome =
        typeof req.body?.nome === 'string'
          ? req.body.nome.trim()
          : '';

      const email =
        typeof req.body?.email === 'string'
          ? req.body.email.trim().toLowerCase()
          : '';

      const codigo =
        typeof req.body?.codigo_convite === 'string'
          ? req.body.codigo_convite.trim().toUpperCase()
          : '';

      const numeroMatricula =
        typeof req.body?.numero_matricula === 'string'
          ? req.body.numero_matricula.trim() || null
          : null;

      if (!nome || nome.length > 120) {
        throw AppError.badRequest(
          'Informe o nome do aluno, com até 120 caracteres.',
        );
      }

      if (
        !email ||
        email.length > 160 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        throw AppError.badRequest('Informe um e-mail válido.');
      }

      if (!/^[A-F0-9]{8}$/.test(codigo)) {
        throw AppError.badRequest(
          'Informe um código de convite válido.',
        );
      }

      if (numeroMatricula && numeroMatricula.length > 30) {
        throw AppError.badRequest(
          'O número de matrícula aceita até 30 caracteres.',
        );
      }

      connection = await pool.getConnection();
      await connection.beginTransaction();
      transactionStarted = true;

      const [turmas] = await connection.execute(
        `SELECT id, nome, disciplina, periodo, status
         FROM turma
         WHERE codigo_convite = ?
         LIMIT 1`,
        [codigo],
      );

      const turma = turmas[0];

      if (!turma) {
        throw AppError.notFound(
          'Código de convite não encontrado.',
        );
      }

      if (turma.status !== 'ATIVA') {
        throw AppError.badRequest(
          'Esta turma está arquivada e não aceita novas matrículas.',
        );
      }

      const [alunoResult] = await connection.execute(
        `INSERT INTO aluno (nome, email, numero_matricula)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [nome, email, numeroMatricula],
      );

      const alunoId = Number(alunoResult.insertId);

      const [matriculas] = await connection.execute(
        `SELECT aluno_id
         FROM matricula
         WHERE turma_id = ? AND aluno_id = ?
         LIMIT 1`,
        [turma.id, alunoId],
      );

      if (matriculas.length > 0) {
        throw AppError.conflict(
          'Este aluno já está matriculado nesta turma.',
        );
      }

      await connection.execute(
        `INSERT INTO matricula (turma_id, aluno_id)
         VALUES (?, ?)`,
        [turma.id, alunoId],
      );

      await connection.commit();
      transactionStarted = false;

      return res.status(201).json({
        message: 'Matrícula realizada com sucesso.',
        aluno: {
          id: alunoId,
          nome,
          email,
          numero_matricula: numeroMatricula,
        },
        turma: {
          id: Number(turma.id),
          nome: turma.nome,
          disciplina: turma.disciplina,
          periodo: turma.periodo,
        },
      });
    } catch (error) {
      if (transactionStarted && connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          return next(rollbackError);
        }
      }

      return next(error);
    } finally {
      connection?.release();
    }
  });

  return router;
}