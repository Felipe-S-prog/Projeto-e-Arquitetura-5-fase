
import { Router } from 'express';
import { AppError } from '../errors/AppError.js';
import { professorContext } from '../middlewares/professorContext.js';

export function createTurmasRoutes({ pool }) {
  const router = Router();

  router.use(professorContext);

  function mapTurma(row, students = []) {
    return {
      id: row.id,
      name: row.nome,
      subject: row.disciplina,
      period: row.periodo,
      status: row.status === 'ARQUIVADA' ? 'Arquivada' : 'Ativa',
      students,
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

  function validarId(id) {
    const numero = Number(id);

    if (!Number.isInteger(numero) || numero <= 0) {
      throw AppError.badRequest('ID de turma inválido.');
    }

    return numero;
  }

  async function buscarAlunosDasTurmas(turmaIds) {
    if (turmaIds.length === 0) {
      return new Map();
    }

    const placeholders = turmaIds.map(() => '?').join(', ');

    const [rows] = await pool.execute(
      `SELECT
         m.turma_id,
         a.id,
         a.nome,
         a.email,
         a.numero_matricula
       FROM matricula m
       INNER JOIN aluno a ON a.id = m.aluno_id
       WHERE m.turma_id IN (${placeholders})
       ORDER BY a.nome`,
      turmaIds,
    );

    const alunosPorTurma = new Map();

    for (const row of rows) {
      if (!alunosPorTurma.has(row.turma_id)) {
        alunosPorTurma.set(row.turma_id, []);
      }

      alunosPorTurma.get(row.turma_id).push({
        id: row.id,
        name: row.nome,
        email: row.email,
        registration: row.numero_matricula,
      });
    }

    return alunosPorTurma;
  }

  async function buscarTurmaDoProfessor(turmaId, professorId) {
    const [rows] = await pool.execute(
      `SELECT id, nome, disciplina, periodo, status
       FROM turma
       WHERE id = ? AND professor_id = ?`,
      [turmaId, professorId],
    );

    if (!rows.length) {
      throw AppError.notFound('Turma não encontrada.');
    }

    return rows[0];
  }

  // Listar turmas do professor com os alunos matriculados.
  router.get('/', async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, nome, disciplina, periodo, status
         FROM turma
         WHERE professor_id = ?
         ORDER BY id DESC`,
        [req.professorId],
      );

      const alunosPorTurma = await buscarAlunosDasTurmas(
        rows.map((turma) => turma.id),
      );

      res.json(
        rows.map((turma) =>
          mapTurma(turma, alunosPorTurma.get(turma.id) || []),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  // Criar turma.
  router.post('/', async (req, res, next) => {
    try {
      const { nome, disciplina, periodo } = req.body;
      validarDados({ nome, disciplina, periodo });

      const [result] = await pool.execute(
        `INSERT INTO turma (professor_id, nome, disciplina, periodo)
         VALUES (?, ?, ?, ?)`,
        [
          req.professorId,
          nome.trim(),
          disciplina.trim(),
          periodo.trim(),
        ],
      );

      const turma = await buscarTurmaDoProfessor(
        result.insertId,
        req.professorId,
      );

      res.status(201).json(mapTurma(turma));
    } catch (error) {
      next(error);
    }
  });

  // Matricular um aluno pelo nome e e-mail.
  router.post('/:id/matriculas', async (req, res, next) => {
    try {
      const turmaId = validarId(req.params.id);
      const professorId = req.professorId;
      const nome = typeof req.body.nome === 'string'
        ? req.body.nome.trim()
        : '';
      const email = typeof req.body.email === 'string'
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

      const turma = await buscarTurmaDoProfessor(turmaId, professorId);

      if (turma.status === 'ARQUIVADA') {
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
        id: aluno.id,
        name: aluno.nome,
        email: aluno.email,
        registration: aluno.numero_matricula,
      });
    } catch (error) {
      next(error);
    }
  });

  // Editar turma.
  router.put('/:id', async (req, res, next) => {
    try {
      const id = validarId(req.params.id);
      const { nome, disciplina, periodo } = req.body;

      validarDados({ nome, disciplina, periodo });

      const [result] = await pool.execute(
        `UPDATE turma
         SET nome = ?, disciplina = ?, periodo = ?
         WHERE id = ? AND professor_id = ? AND status = 'ATIVA'`,
        [
          nome.trim(),
          disciplina.trim(),
          periodo.trim(),
          id,
          req.professorId,
        ],
      );

      if (result.affectedRows === 0) {
        const turma = await buscarTurmaDoProfessor(id, req.professorId);

        if (turma.status === 'ARQUIVADA') {
          throw AppError.badRequest(
            'Turmas arquivadas não podem ser editadas.',
          );
        }
      }

      const turma = await buscarTurmaDoProfessor(id, req.professorId);
      res.json(mapTurma(turma));
    } catch (error) {
      next(error);
    }
  });

  // Arquivar turma sem apagar seu histórico.
  router.patch('/:id/arquivar', async (req, res, next) => {
    try {
      const id = validarId(req.params.id);

      await buscarTurmaDoProfessor(id, req.professorId);

      await pool.execute(
        `UPDATE turma
         SET status = 'ARQUIVADA'
         WHERE id = ? AND professor_id = ? AND status = 'ATIVA'`,
        [id, req.professorId],
      );

      const turma = await buscarTurmaDoProfessor(id, req.professorId);
      res.json(mapTurma(turma));
    } catch (error) {
      next(error);
    }
  });

  return router;
}