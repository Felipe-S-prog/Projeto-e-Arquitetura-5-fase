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
      'Não foi possível gerar um código de convite. Tente novamente.',
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

  // Listar turmas do professor e gerar convite para turmas antigas
  // que ainda não possuem código.
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

  // Criar turma já com código de convite.
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

  // Regenerar o convite: o código anterior deixa de funcionar.
  router.post('/:id/codigo-convite/regenerar', async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        throw AppError.badRequest('ID de turma inválido.');
      }

      const [existing] = await pool.execute(
        `SELECT id, status
         FROM turma
         WHERE id = ? AND professor_id = ?`,
        [id, req.professorId],
      );

      if (!existing.length) {
        throw AppError.notFound('Turma não encontrada.');
      }

      if (existing[0].status !== 'ATIVA') {
        throw AppError.badRequest(
          'Não é possível regenerar o convite de uma turma arquivada.',
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

  // Matricular um aluno pelo nome e e-mail (T15).
  router.post('/:id/matriculas', async (req, res, next) => {
    try {
      const turmaId = Number(req.params.id);

      if (!Number.isInteger(turmaId) || turmaId <= 0) {
        throw AppError.badRequest('ID de turma inválido.');
      }

      const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
      const email =
        typeof req.body.email === 'string'
          ? req.body.email.trim().toLowerCase()
          : '';
      const numeroMatricula =
        typeof req.body.numero_matricula === 'string'
          ? req.body.numero_matricula.trim() || null
          : null;

      if (!nome || nome.length > 120) {
        throw AppError.badRequest(
          'Informe o nome do aluno (máximo de 120 caracteres).',
        );
      }

      if (
        !email ||
        email.length > 160 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        throw AppError.badRequest('Informe um e-mail válido.');
      }

      if (numeroMatricula && numeroMatricula.length > 30) {
        throw AppError.badRequest(
          'O número de matrícula aceita até 30 caracteres.',
        );
      }

      const [turmas] = await pool.execute(
        `SELECT id, status
         FROM turma
         WHERE id = ? AND professor_id = ?`,
        [turmaId, req.professorId],
      );

      if (!turmas.length) {
        throw AppError.notFound('Turma não encontrada.');
      }

      if (turmas[0].status === 'ARQUIVADA') {
        throw AppError.badRequest(
          'Não é possível matricular alunos em uma turma arquivada.',
        );
      }

      // Reutiliza o cadastro se esse e-mail já existir.
      const [alunosExistentes] = await pool.execute(
        `SELECT id, nome, email, numero_matricula
         FROM aluno
         WHERE email = ?`,
        [email],
      );

      let aluno = alunosExistentes[0];

      if (!aluno) {
        const [resultadoAluno] = await pool.execute(
          `INSERT INTO aluno (nome, email, numero_matricula)
           VALUES (?, ?, ?)`,
          [nome, email, numeroMatricula],
        );

        aluno = {
          id: resultadoAluno.insertId,
          nome,
          email,
          numero_matricula: numeroMatricula,
        };
      }

      const [matriculasExistentes] = await pool.execute(
        `SELECT 1
         FROM matricula
         WHERE turma_id = ? AND aluno_id = ?`,
        [turmaId, aluno.id],
      );

      if (matriculasExistentes.length > 0) {
        throw AppError.badRequest(
          'Este aluno já está matriculado nesta turma.',
        );
      }

      await pool.execute(
        `INSERT INTO matricula (turma_id, aluno_id)
         VALUES (?, ?)`,
        [turmaId, aluno.id],
      );

      res.status(201).json({
        id: Number(aluno.id),
        name: aluno.nome,
        email: aluno.email,
        registration: aluno.numero_matricula,
        numeroMatricula: aluno.numero_matricula,
      });
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
        throw AppError.badRequest('ID de turma inválido.');
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

        if (!rows.length) throw AppError.notFound('Turma não encontrada.');
        throw AppError.badRequest('Turmas arquivadas não podem ser editadas.');
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

  return router;
}
