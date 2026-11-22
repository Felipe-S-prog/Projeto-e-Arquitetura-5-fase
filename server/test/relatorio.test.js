import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import { calcularEstatisticas, createRelatorioService } from '../src/services/relatorio.service.js';
import { inflateRawSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
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
        { codigo: 'AAA111', rotulo: 'Ana', aluno: { id: 7, nome: 'Ana', matricula: '01' }, correcaoId: 1, nota: 8, tipo: 'AUTOMATICA' },
        { codigo: 'BBB222', rotulo: 'Prova #02', aluno: null, correcaoId: 2, nota: 5.5, tipo: 'AUTOMATICA' },
        { codigo: 'CCC333', rotulo: 'Prova #03', aluno: null, nota: null, tipo: null },
      ];
    },
    async listDesempenhoPorQuestao() {
      return [
        { questaoId: 100, posicao: 1, tipo: 'OBJETIVA', pontuacao: 5, corrigidas: 4, acertos: 3, emBranco: 0, mediaPontos: 3.75 },
        { questaoId: 200, posicao: 2, tipo: 'DISCURSIVA', pontuacao: 5, corrigidas: 0, acertos: 0, emBranco: 0, mediaPontos: null },
      ];
    },
    async listAlternativasDaProva() {
      return [
        { questaoId: 100, ordem: 0, texto: 'Sim', correta: true },
        { questaoId: 100, ordem: 1, texto: 'Não', correta: false },
      ];
    },
    async listRespostasObjetivas() {
      return [
        { questaoId: 100, letraMarcada: 'A', alternativesOrder: { 100: [0, 1] } },
        { questaoId: 100, letraMarcada: 'A', alternativesOrder: { 100: [1, 0] } },
        { questaoId: 100, letraMarcada: 'B', alternativesOrder: { 100: [1, 0] } },
        { questaoId: 100, letraMarcada: null, alternativesOrder: { 100: [0, 1] } },
      ];
    },
    async listRespostasPorCorrecao() {
      return [
        // Ana marcou B impresso; na cópia dela o B é a alternativa original 0 (A)
        { correcaoId: 1, questaoId: 100, letraMarcada: 'B', pontos: 5, tipo: 'OBJETIVA', alternativesOrder: { 100: [1, 0] } },
        { correcaoId: 1, questaoId: 200, letraMarcada: null, pontos: 3.5, tipo: 'DISCURSIVA', alternativesOrder: {} },
        { correcaoId: 2, questaoId: 100, letraMarcada: null, pontos: 0, tipo: 'OBJETIVA', alternativesOrder: { 100: [0, 1] } },
      ];
    },
    async listTurmas() {
      return [{ id: 9, nome: 'Turma A', totalAplicacoes: 2 }, { id: 10, nome: 'Turma sem provas', totalAplicacoes: 0 }];
    },
    async listNotasDoProfessor() {
      return [{ turma: 'Turma A', aluno: 'Ana', matricula: '01', prova: 'Prova 1', dataAplicacao: '2026-10-20', nota: 8, notaMaxima: 10, tipo: 'AUTOMATICA' }];
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

test('relatorioDaAplicacao (T74): cada objetiva traz quantas pessoas marcaram cada alternativa; discursiva não', async () => {
  const r = await createRelatorioService(fakeRepository()).relatorioDaAplicacao(1, 1);
  const [objetiva, discursiva] = r.questoes;
  assert.deepEqual(
    objetiva.distribuicao.alternativas.map((a) => [a.letra, a.quantidade, a.percentual, a.correta]),
    [['A', 2, 50, true], ['B', 1, 25, false]],
  );
  assert.deepEqual(objetiva.distribuicao.emBranco, { quantidade: 1, percentual: 25 });
  assert.deepEqual(objetiva.distribuicao.maisMarcadas, ['A']);
  assert.equal(discursiva.distribuicao, null);
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

test('exportarTurma (CSV): cabeçalho com a data de cada aplicação e nome de arquivo sem acentos', async () => {
  const service = createRelatorioService(fakeRepository());
  const { nomeArquivo, conteudo } = await service.exportarTurma(9, 'csv', 1);
  assert.equal(nomeArquivo, 'notas-consolidadas-turma-a.csv');
  const [cabecalho, primeira] = conteudo.replace('﻿', '').split('\r\n');
  assert.equal(cabecalho, 'Aluno;Matrícula;Prova 1 (20/10/2026) - máx. 10;Prova 2 - máx. 10;Provas feitas;Média (%)');
  assert.equal(primeira, 'Ana;01;8;6;2;70');
});

// Lê os arquivos de um .xlsx (ZIP) para conferir o conteúdo.
function unzip(buffer) {
  const files = {};
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + extra;
    files[name] = inflateRawSync(buffer.subarray(start, start + size)).toString('utf8');
    offset = start + size;
  }
  return files;
}

test('exportarAplicacao (CSV): uma linha por aluno com a alternativa marcada na ordem cadastrada', async () => {
  const service = createRelatorioService(fakeRepository());
  const { nomeArquivo, tipoConteudo, conteudo } = await service.exportarAplicacao(1, 'csv', 1);
  assert.equal(nomeArquivo, 'notas-prova-1-turma-a.csv');
  assert.match(tipoConteudo, /text\/csv/);
  assert.deepEqual(conteudo.replace('\uFEFF', '').trim().split('\r\n'), [
    'Aluno;Matrícula;Código;Correção;Nota;%;Q1 (A);Q2 (pts)',
    'Ana;01;AAA111;Automática;8;80;A;3,5',
    'Prova #02 (sem aluno);;BBB222;Automática;5,5;55;Em branco;',
    'Prova #03 (sem aluno);;CCC333;Pendente;;;;',
  ]);
});

test('exportarAplicacao (Excel): abas de notas e de questões, números como número', async () => {
  const service = createRelatorioService(fakeRepository());
  const { nomeArquivo, tipoConteudo, conteudo } = await service.exportarAplicacao(1, 'xlsx', 1);
  assert.equal(nomeArquivo, 'notas-prova-1-turma-a.xlsx');
  assert.match(tipoConteudo, /spreadsheetml/);
  const files = unzip(conteudo);
  assert.ok(files['[Content_Types].xml'] && files['xl/styles.xml']);
  assert.match(files['xl/workbook.xml'], /<sheet name="Notas" sheetId="1"/);
  assert.match(files['xl/workbook.xml'], /<sheet name="Questões" sheetId="2"/);
  assert.match(files['xl/worksheets/sheet1.xml'], /<t xml:space="preserve">Ana<\/t>/);
  assert.match(files['xl/worksheets/sheet1.xml'], /<c r="E2" s="2"><v>8<\/v><\/c>/); // nota da Ana é número
  assert.match(files['xl/worksheets/sheet2.xml'], /<c r="G2" s="2"><v>75<\/v><\/c>/); // taxa de acerto da Q1 (colunas: Nº, enunciado, correta, A, B, em branco, acerto)
});

test('exportarAplicacao (PDF) e consolidado do professor (Excel com uma aba por turma)', async () => {
  const service = createRelatorioService(fakeRepository());
  const pdf = await service.exportarAplicacao(1, 'pdf', 1);
  assert.equal(pdf.tipoConteudo, 'application/pdf');
  assert.equal(pdf.conteudo.subarray(0, 4).toString(), '%PDF');
  assert.ok((await PDFDocument.load(pdf.conteudo)).getPageCount() >= 1);

  const consolidado = await service.exportarConsolidado('xlsx', 1);
  assert.equal(consolidado.nomeArquivo, 'notas-todas-as-turmas.xlsx');
  const workbook = unzip(consolidado.conteudo)['xl/workbook.xml'];
  assert.match(workbook, /<sheet name="Todas as notas"/);
  assert.match(workbook, /<sheet name="Turma A"/);
  assert.doesNotMatch(workbook, /Turma sem provas/);

  await assert.rejects(service.exportarAplicacao(1, 'docx', 1), { statusCode: 400 });
  await assert.rejects(service.exportarAplicacao(1, 'pdf', 2), { statusCode: 404 });
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
