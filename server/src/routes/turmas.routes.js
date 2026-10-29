import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { AppError } from '../errors/AppError.js';
import { professorContext } from '../middlewares/professorContext.js';

export function createTurmasRoutes({ pool }) {
  const router = Router();
  router.use(professorContext);

  async function gerarCodigoConvite() {
    for (let tentativa = 0; tentativa < 10; tentativa += 1) {
      const codigo = randomBytes(4).toString('hex').toUpperCase();

      const [rows] = await pool.execute(
        `SELECT id FROM turma WHERE codigo_convite = ? LIMIT 1`,
        [codigo],
      );

      if (rows.length === 0) return codigo;
    }

    throw AppError.conflict(
      'NÃ£o foi possÃ­vel gerar um cÃ³digo de convite. Tente novamente.',
    );
  }

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
        'Informe o nome, a disciplina e o perÃ­odo da turma.',
      );
    }

    if (
      nome.trim().length > 100 ||
      disciplina.trim().length > 80 ||
      periodo.trim().length > 10
    ) {
      throw AppError.badRequest(
        'O nome aceita atÃ© 100 caracteres, a disciplina 80 e o perÃ­odo 10.',
      );
    }
  }

  // Listar turmas do professor e gerar convite para turmas antigas
  // que ainda nÃ£o possuem cÃ³digo.
  router.get('/', async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status, codigo_convite
         FROM turma
         WHERE professor_id = ?
         ORDER BY id DESC`,
        [req.professorId],
      );

      for (const row of rows) {
        if (!row.codigo_convite) {
          const codigo = await gerarCodigoConvite();

          await pool.execute(
            `UPDATE turma
             SET codigo_convite = ?
             WHERE id = ? AND codigo_convite IS NULL`,
            [codigo, row.id],
          );

          const [updated] = await pool.execute(
            `SELECT codigo_convite FROM turma WHERE id = ?`,
            [row.id],
          );

          row.codigo_convite = updated[0]?.codigo_convite ?? codigo;
        }
      }

      res.json(await Promise.all(rows.map(mapTurma)));
    } catch (error) {
      next(error);
    }
  });

  // Criar turma jÃ¡ com cÃ³digo de convite.
  router.post('/', async (req, res, next) => {
    try {
      const { nome, disciplina, periodo } = req.body;
      validarDados({ nome, disciplina, periodo });

      const codigo = await gerarCodigoConvite();

      const [result] = await pool.execute(
        `INSERT INTO turma
          (professor_id, nome, disciplina, periodo, codigo_convite)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.professorId,
          nome.trim(),
          disciplina.trim(),
          periodo.trim(),
          codigo,
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

  // Regenerar o convite: o cÃ³digo anterior deixa de funcionar.
  router.post('/:id/codigo-convite/regenerar', async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw AppError.badRequest('ID de turma invÃ¡lido.');
      }

      const [existing] = await pool.execute(
        `SELECT id, status
         FROM turma
         WHERE id = ? AND professor_id = ?`,
        [id, req.professorId],
      );

      if (!existing.length) {
        throw AppError.notFound('Turma nÃ£o encontrada.');
      }

      if (existing[0].status !== 'ATIVA') {
        throw AppError.badRequest(
          'NÃ£o Ã© possÃ­vel regenerar o convite de uma turma arquivada.',
        );
      }

      const codigo = await gerarCodigoConvite();

      await pool.execute(
        `UPDATE turma
         SET codigo_convite = ?
         WHERE id = ? AND professor_id = ? AND status = 'ATIVA'`,
        [codigo, id, req.professorId],
      );

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

  // Editar turma.
  router.put('/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const { nome, disciplina, periodo } = req.body;

      if (!Number.isInteger(id) || id <= 0) {
        throw AppError.badRequest('ID de turma invÃ¡lido.');
      }

      validarDados({ nome, disciplina, periodo });

      const [result] = await pool.execute(
        `UPDATE turma
         SET nome = ?, disciplina = ?, periodo = ?
         WHERE id = ? AND professor_id = ? AND status = 'ATIVA'`,
        [nome.trim(), disciplina.trim(), periodo.trim(), id, req.professorId],
      );

      if (result.affectedRows === 0) {
        const [rows] = await pool.execute(
          'SELECT id FROM turma WHERE id = ? AND professor_id = ?',
          [id, req.professorId],
        );

        if (!rows.length) throw AppError.notFound('Turma nÃ£o encontrada.');
        throw AppError.badRequest('Turmas arquivadas nÃ£o podem ser editadas.');
      }

      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status, codigo_convite
         FROM turma
         WHERE id = ? AND professor_id = ?`,
        [id, req.professorId],
      );

      res.json(mapTurma(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  // Arquivar turma sem apagar seu histÃ³rico.
  router.patch('/:id/arquivar', async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw AppError.badRequest('ID de turma invÃ¡lido.');
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
          throw AppError.notFound('Turma nÃ£o encontrada.');
        }
      }

      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status, codigo_convite
         FROM turma
         WHERE id = ? AND professor_id = ?`,
        [id, req.professorId],
      );

      res.json(mapTurma(rows[0]));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
