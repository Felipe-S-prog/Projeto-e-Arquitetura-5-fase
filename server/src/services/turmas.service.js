import { AppError } from '../errors/AppError.js';
import { createTurmasRepository } from '../repositories/turmas.repository.js';

export function createTurmasService({ pool }) {
  const repository = createTurmasRepository({ pool });

  async function mapTurma(row) {
    const alunos = await repository.listarAlunos(row.id);

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
  async function listar(professorId) {
    const rows = await repository.listar(professorId);

    return Promise.all(rows.map(mapTurma));
  }

  // Criar turma. Alunos são cadastrados pelo professor.
  async function criar(professorId, dados) {
    const { nome, disciplina, periodo } = dados;
    validarDados({ nome, disciplina, periodo });

    const result = await repository.inserir(professorId, nome.trim(), disciplina.trim(), periodo.trim());

    const rows = await repository.buscar(result.insertId, professorId);

    return mapTurma(rows[0]);
  }

  // Editar turma.
  async function editar(turmaId, professorId, dados) {
    const id = Number(turmaId);
    const { nome, disciplina, periodo } = dados;

    if (!Number.isInteger(id) || id <= 0) {
      throw AppError.badRequest('ID de turma inválido.');
    }

    validarDados({ nome, disciplina, periodo });

    const result = await repository.atualizar(nome.trim(), disciplina.trim(), periodo.trim(), id, professorId);

    if (result.affectedRows === 0) {
      const rows = await repository.buscarId(id, professorId);

      if (!rows.length) throw AppError.notFound('Turma não encontrada.');
    }

    const rows = await repository.buscar(id, professorId);

    return mapTurma(rows[0]);
  }

  // Arquivar turma sem apagar seu histórico.
  async function arquivar(turmaId, professorId) {
    const id = Number(turmaId);

    if (!Number.isInteger(id) || id <= 0) {
      throw AppError.badRequest('ID de turma inválido.');
    }

    const result = await repository.arquivar(id, professorId);

    if (result.affectedRows === 0) {
      const existing = await repository.buscarId(id, professorId);

      if (!existing.length) {
        throw AppError.notFound('Turma não encontrada.');
      }
    }

    const rows = await repository.buscar(id, professorId);

    return mapTurma(rows[0]);
  }

  // Turmas com aplicações são arquivadas; o histórico nunca é apagado.
  async function excluir(turmaId, professorId) {
    const id = Number(turmaId);
    if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('ID de turma inválido.');
    return repository.withTransaction(async (connection) => {
      const turmas = await repository.bloquear(connection, id, professorId);
      if (!turmas.length) throw AppError.notFound('Turma não encontrada.');
      const aplicacoes = await repository.buscarAplicacoes(connection, id);
      if (aplicacoes.length) {
        await repository.arquivarComHistorico(connection, id, professorId);
      } else {
        await repository.excluir(connection, id, professorId);
      }
      return {
        archived: aplicacoes.length > 0,
        message: aplicacoes.length
          ? 'Turma arquivada para preservar aplicações, cópias e notas.'
          : 'Turma excluída. Os cadastros dos alunos foram preservados.',
      };
    });
  }

  return { listar, criar, editar, arquivar, excluir };
}
