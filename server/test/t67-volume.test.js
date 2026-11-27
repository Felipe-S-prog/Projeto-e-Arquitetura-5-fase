import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { createRelatorioService } from '../src/services/relatorio.service.js';

test('T67: histórico, médias e exportações com 32 alunos e três aplicações', async () => {
  const turma = { id: 9, nome: 'Turma A' };
  const alunos = Array.from({ length: 32 }, (_, index) => {
    const id = index + 1;
    return { id, nome: `Aluno ${String(id).padStart(2, '0')}`, matricula: String(id) };
  });
  const aplicacoes = [10, 20, 10].map((notaMaxima, index) => ({
    id: index + 1,
    prova: { id: index + 1, titulo: `Prova ${index + 1}` },
    dataAplicacao: `2026-11-${10 + index}`,
    turma,
    notaMaxima,
  }));
  const notas = alunos.slice(0, 31).flatMap((aluno) =>
    aplicacoes.slice(0, 2).map((aplicacao) => ({
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      alunoMatricula: aluno.matricula,
      aplicacaoId: aplicacao.id,
      correcaoId: aluno.id * 10 + aplicacao.id,
      nota: aplicacao.id === 1 ? 8 : 10,
      notaMaxima: aplicacao.notaMaxima,
      tipo: 'MANUAL',
    })),
  );
  const service = createRelatorioService({
    findTurma: async (id, professorId) => id === turma.id && professorId === 1 ? turma : null,
    listAplicacoesDaTurma: async () => aplicacoes,
    listAlunosDaTurma: async () => alunos.filter(({ id }) => id !== 31),
    listNotasDaTurma: async () => notas,
    findAlunoDoProfessor: async (id, professorId) => professorId === 1 ? alunos[id - 1] : null,
    listTurmasDoAluno: async () => [turma],
    listHistoricoDoAluno: async (id) => notas.filter(({ alunoId }) => alunoId === id),
  });

  const relatorio = await service.relatorioDaTurma(9, 1);
  assert.equal(relatorio.alunos.length, 32);
  assert.equal(relatorio.mediaPercentualDaTurma, 65);
  assert.deepEqual(relatorio.aplicacoes.map(({ estatisticas }) => estatisticas.corrigidas), [31, 31, 0]);
  assert.deepEqual(relatorio.alunos[30].notas.map(({ percentual }) => percentual), [80, 50, null]);
  assert.equal(relatorio.alunos[30].aluno.matriculado, false);
  assert.equal(relatorio.alunos[31].mediaPercentual, null);

  const historico = await service.historicoDoAluno(1, 1);
  assert.deepEqual(historico.resumo, {
    provas: 2, mediaPercentual: 65, melhorPercentual: 80, piorPercentual: 50,
  });
  assert.deepEqual((await service.historicoDoAluno(32, 1)).notas, []);
  await assert.rejects(service.historicoDoAluno(1, 2), { statusCode: 404 });

  const csv = await service.exportarTurma(9, 'csv', 1);
  const linhas = csv.conteudo.toString('utf8').trimEnd().split(/\r?\n/);
  assert.equal(linhas.length, 34);
  assert.match(linhas[0], /Prova 3/);
  assert.match(linhas[31], /Aluno 31/);
  assert.match(linhas[32], /Aluno 32/);
  assert.match(linhas[33], /Média da aplicação;;8;10;;;65/);

  const excel = await service.exportarTurma(9, 'xlsx', 1);
  assert.equal(Buffer.from(excel.conteudo).subarray(0, 2).toString(), 'PK');
  const pdf = await service.exportarTurma(9, 'pdf', 1);
  assert.ok((await PDFDocument.load(pdf.conteudo)).getPageCount() >= 1);
});
