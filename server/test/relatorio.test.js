import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { calcularEstatisticas, createRelatorioService } from '../src/services/relatorio.service.js';
import { toCsv } from '../src/utils/csv.js';

const aplicacao = (id, titulo, dataAplicacao) => ({
  id,
  dataAplicacao,
  prova: { id: id * 10, titulo },
  turma: { id: 9, nome: 'Turma A' },
  notaMaxima: 10,
});

function fakeRepository() {
  return {
    async findAplicacao(id, professorId) {
      return id === 1 && professorId === 1 ? aplicacao(1, 'Prova 1', '2026-10-20') : null;
    },
    async listNotasDaAplicacao() {
      return [
        { codigo: 'AAA111', rotulo: 'Ana', aluno: { id: 7, nome: 'Ana', matricula: '01' }, nota: 8, tipo: 'AUTOMATICA' },
        { codigo: 'BBB222', rotulo: 'Prova #02', aluno: null, nota: 5.5, tipo: 'AUTOMATICA' },
        { codigo: 'CCC333', rotulo: 'Prova #03', aluno: null, nota: null, tipo: null },
      ];
    },
    async listDesempenhoPorQuestao() {
      return [
        { questaoId: 100, posicao: 1, tipo: 'OBJETIVA', pontuacao: 5, corrigidas: 4, acertos: 3, emBranco: 0, mediaPontos: 3.75 },
        { questaoId: 200, posicao: 2, tipo: 'DISCURSIVA', pontuacao: 5, corrigidas: 0, acertos: 0, emBranco: 0, mediaPontos: null },
      ];
    },
    async findTurma(id, professorId) {
      return id === 9 && professorId === 1 ? { id: 9, nome: 'Turma A' } : null;
    },
    async listAplicacoesDaTurma() {
      return [aplicacao(1, 'Prova 1', '2026-10-20'), aplicacao(2, 'Prova 2', null)];
    },
    async listAlunosDaTurma() {
      return [{ id: 8, nome: 'Bruno', matricula: '02' }, { id: 7, nome: 'Ana', matricula: '01' }];
    },
    async listNotasDaTurma() {
      return [
        { correcaoId: 1, alunoId: 7, alunoNome: 'Ana', aplicacaoId: 1, nota: 8, tipo: 'AUTOMATICA' },
        { correcaoId: 2, alunoId: 7, alunoNome: 'Ana', aplicacaoId: 2, nota: 6, tipo: 'MANUAL' },
        { correcaoId: 3, alunoId: 5, alunoNome: 'Carlos (saiu da turma)', alunoMatricula: '03', aplicacaoId: 1, nota: 4, tipo: 'MANUAL' },
      ];
    },
  };
}

test('calcularEstatisticas: média, mediana, maior, menor e média em %', () => {
  assert.deepEqual(calcularEstatisticas([8, 5.5, 7, 10], 10), {
    corrigidas: 4,
    media: 7.63,
    mediana: 7.5,
    maior: 10,
    menor: 5.5,
    mediaPercentual: 76.3,
  });
  assert.equal(calcularEstatisticas([], 10).media, null);
});

test('relatorioDaAplicacao: estatísticas só das corrigidas e taxa de acerto só nas objetivas', async () => {
  const service = createRelatorioService(fakeRepository());
  const r = await service.relatorioDaAplicacao('1', 1);
  assert.equal(r.estatisticas.corrigidas, 2);
  assert.equal(r.estatisticas.pendentes, 1);
  assert.equal(r.estatisticas.semAluno, 1);
  assert.equal(r.estatisticas.media, 6.75);
  assert.deepEqual(r.notas.map((n) => n.percentual), [80, 55, null]);
  assert.deepEqual(r.questoes.map((q) => q.taxaAcerto), [75, null]);
});

test('relatorioDaAplicacao: aplicação de outro professor é 404 e id inválido é 400', async () => {
  const service = createRelatorioService(fakeRepository());
  await assert.rejects(service.relatorioDaAplicacao(1, 2), { statusCode: 404 });
  await assert.rejects(service.relatorioDaAplicacao('x', 1), { statusCode: 400, message: 'Aplicação inválida.' });
});

test('relatorioDaTurma: matriz alunos x aplicações em ordem alfabética, mantendo quem saiu da turma', async () => {
  const service = createRelatorioService(fakeRepository());
  const r = await service.relatorioDaTurma(9, 1);
  assert.deepEqual(r.alunos.map((l) => [l.aluno.nome, l.aluno.matriculado, l.notas.map((n) => n.nota), l.mediaPercentual]), [
    ['Ana', true, [8, 6], 70],
    ['Bruno', true, [null, null], null],
    ['Carlos (saiu da turma)', false, [4, null], 40],
  ]);
  assert.equal(r.mediaPercentualDaTurma, 55);
  assert.equal(r.aplicacoes[0].estatisticas.media, 6);
});

test('csvDaTurma: cabeçalho com a data de cada aplicação e nome de arquivo sem acentos', async () => {
  const service = createRelatorioService(fakeRepository());
  const { nomeArquivo, conteudo } = await service.csvDaTurma(9, 1);
  assert.equal(nomeArquivo, 'notas-consolidadas-turma-a.csv');
  const [cabecalho, primeira] = conteudo.replace('﻿', '').split('\r\n');
  assert.equal(cabecalho, 'Aluno;Matrícula;Prova 1 (20/10/2026) - máx. 10;Prova 2 - máx. 10;Provas feitas;Média (%)');
  assert.equal(primeira, 'Ana;01;8;6;2;70');
});

test('toCsv: BOM, ";" como separador, vírgula decimal, aspas e proteção contra fórmula', () => {
  const csv = toCsv(['Nome', 'Nota'], [['Ana "Bia"; Souza', 7.5], ['=HYPERLINK("x")', null]]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv.slice(1), 'Nome;Nota\r\n"Ana ""Bia""; Souza";7,5\r\n"\'=HYPERLINK(""x"")";\r\n');
});

test('rotas de correção e relatórios exigem o professor (401 sem professor_id)', async () => {
  const config = loadConfig({ DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'sgp_teste', NODE_ENV: 'test' });
  const pool = { query: async () => assert.fail('não deveria consultar o banco') };
  const server = createApp({ pool, config }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api`;
  try {
    for (const path of ['/correcoes/copias/ABC123', '/relatorios/aplicacoes', '/alunos/1/historico', '/correcoes/copias/ABC123?professor_id=abc']) {
      const res = await fetch(url + path);
      assert.equal(res.status, 401, path);
      assert.equal((await res.json()).error.code, 'UNAUTHORIZED');
    }
  } finally {
    server.close();
  }
});
