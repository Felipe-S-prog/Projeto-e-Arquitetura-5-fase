import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { createCorrecaoService } from '../src/services/correcao.service.js';

// Repository falso, em memória: testa as regras do service sem MySQL.
function fakeRepository() {
  const copias = [
    { id: 1, codigo: 'ANA123', rotulo: 'Ana', aluno: { id: 7, nome: 'Ana' }, ordem: { questionIds: [], alternativesOrder: {} } },
    { id: 2, codigo: 'ANON22', rotulo: 'Prova #01', aluno: null, ordem: { questionIds: [], alternativesOrder: {} } },
    { id: 3, codigo: 'ANON33', rotulo: 'Prova #02', aluno: null, ordem: { questionIds: [], alternativesOrder: {} } },
  ].map((c) => ({ ...c, aplicacao: { id: 50 }, prova: { id: 5, titulo: 'P1' }, turma: { id: 9, nome: 'Turma A' } }));
  const correcoes = [];
  let proximoId = 1;

  return {
    correcoes,
    async findCopiaByCodigo(codigo, professorId) {
      return professorId === 1 ? (copias.find((c) => c.codigo === codigo) ?? null) : null;
    },
    async findCopiaById(id) {
      return copias.find((c) => c.id === id) ?? null;
    },
    async listQuestoesDaProva() {
      return [
        { questaoId: 100, posicao: 1, pontuacao: 6, tipo: 'OBJETIVA', enunciado: 'Q1' },
        { questaoId: 200, posicao: 2, pontuacao: 4, tipo: 'OBJETIVA', enunciado: 'Q2' },
      ];
    },
    async listAlternativas() {
      return [
        { questaoId: 100, ordem: 0, texto: 'certa', correta: true },
        { questaoId: 100, ordem: 1, texto: 'errada', correta: false },
        { questaoId: 200, ordem: 0, texto: 'errada', correta: false },
        { questaoId: 200, ordem: 1, texto: 'certa', correta: true },
      ];
    },
    async listAlunosDaTurma() {
      return [{ id: 7, nome: 'Ana' }, { id: 8, nome: 'Bruno' }];
    },
    async isAlunoMatriculado(alunoId) {
      return [7, 8].includes(alunoId);
    },
    async findCorrecaoDoAlunoNaAplicacao(alunoId, aplicacaoId, ignorarCopiaId) {
      const outra = correcoes.find((c) => c.alunoId === alunoId && c.copiaId !== ignorarCopiaId);
      return outra ? copias.find((c) => c.id === outra.copiaId).codigo : null;
    },
    async findCorrecaoByCopia(copiaId) {
      return correcoes.find((c) => c.copiaId === copiaId) ?? null;
    },
    async findCorrecaoById(id) {
      const c = correcoes.find((item) => item.id === id);
      return c ? { id: c.id, copiaId: c.copiaId, aluno: c.alunoId ? { id: c.alunoId } : null, nota: c.nota, tipo: c.tipo } : null;
    },
    async listRespostas(correcaoId) {
      return correcoes.find((c) => c.id === correcaoId).respostas;
    },
    async salvarCorrecao(dados) {
      const existente = correcoes.findIndex((c) => c.copiaId === dados.copiaId);
      if (existente >= 0) correcoes.splice(existente, 1);
      const id = proximoId++;
      correcoes.push({ id, ...dados });
      return id;
    },
    async removerCorrecao(id) {
      correcoes.splice(correcoes.findIndex((c) => c.id === id), 1);
      return true;
    },
  };
}

async function rejeitaCom(promise, statusCode, trecho) {
  await assert.rejects(promise, (err) => err instanceof AppError && err.statusCode === statusCode && err.message.includes(trecho));
}

test('buscarCopiaParaCorrecao: não revela o gabarito e lista os alunos só para cópia anônima', async () => {
  const service = createCorrecaoService(fakeRepository());
  const nominal = await service.buscarCopiaParaCorrecao(' ana123 ', 1);
  assert.equal(nominal.notaMaxima, 10);
  assert.equal(nominal.questoes.length, 2);
  assert.ok(nominal.questoes.every((q) => !('letraCorreta' in q)));
  assert.deepEqual(nominal.alunos, []);
  assert.equal(nominal.correcao, null);

  const anonima = await service.buscarCopiaParaCorrecao('ANON22', 1);
  assert.equal(anonima.alunos.length, 2);
});

test('buscarCopiaParaCorrecao: código inválido é 400 e prova de outro professor é 404', async () => {
  const service = createCorrecaoService(fakeRepository());
  await rejeitaCom(service.buscarCopiaParaCorrecao('a-b', 1), 400, 'Código');
  await rejeitaCom(service.buscarCopiaParaCorrecao('ANA123', 2), 404, 'não encontrada');
});

test('corrigirAutomaticamente: calcula a nota, grava como AUTOMATICA e devolve o gabarito', async () => {
  const repo = fakeRepository();
  const service = createCorrecaoService(repo);
  const resultado = await service.corrigirAutomaticamente(
    { codigo: 'ANA123', respostas: [{ questaoId: 100, letra: 'A' }, { questaoId: 200, letra: 'A' }] },
    1
  );
  assert.equal(resultado.nota, 6);
  assert.equal(resultado.percentual, 60);
  assert.equal(resultado.tipo, 'AUTOMATICA');
  assert.deepEqual(
    resultado.respostas.map((r) => [r.letraMarcada, r.letraCorreta, r.correta]),
    [
      ['A', 'A', true],
      ['A', 'B', false],
    ]
  );
  assert.equal(repo.correcoes[0].alunoId, 7); // cópia nominal: sempre o aluno dela
});

test('corrigirAutomaticamente: recorrigir exige confirmação e então substitui a nota', async () => {
  const repo = fakeRepository();
  const service = createCorrecaoService(repo);
  const dados = { codigo: 'ANA123', respostas: [] };
  await service.corrigirAutomaticamente(dados, 1);
  await rejeitaCom(service.corrigirAutomaticamente(dados, 1), 409, 'já foi corrigida');

  const nova = await service.corrigirAutomaticamente({ ...dados, substituir: true, respostas: [{ questaoId: 200, letra: 'B' }] }, 1);
  assert.equal(nova.nota, 4);
  assert.equal(repo.correcoes.length, 1);
});

test('aluno da nota: cópia nominal não troca de dono; anônima exige aluno matriculado e sem nota na aplicação', async () => {
  const service = createCorrecaoService(fakeRepository());
  await rejeitaCom(service.lancarNotaManual({ codigo: 'ANA123', nota: 5, alunoId: 8 }, 1), 400, 'nominal de outro aluno');
  await rejeitaCom(service.lancarNotaManual({ codigo: 'ANON22', nota: 5 }, 1), 400, 'Selecione o aluno');
  await rejeitaCom(service.lancarNotaManual({ codigo: 'ANON22', nota: 5, alunoId: 99 }, 1), 400, 'não está matriculado');

  const manual = await service.lancarNotaManual({ codigo: 'ANON22', nota: '8.25', alunoId: '8' }, 1);
  assert.equal(manual.nota, 8.25);
  assert.equal(manual.tipo, 'MANUAL');
  assert.deepEqual(manual.respostas, []);

  await rejeitaCom(service.lancarNotaManual({ codigo: 'ANON33', nota: 5, alunoId: 8 }, 1), 409, 'já tem nota nesta aplicação (prova ANON22)');
});

test('corrigirAutomaticamente: cópia anônima pode ficar sem aluno (associação opcional)', async () => {
  const repo = fakeRepository();
  const service = createCorrecaoService(repo);
  const resultado = await service.corrigirAutomaticamente({ codigo: 'ANON33', respostas: [{ questaoId: 100, letra: 'A' }] }, 1);
  assert.equal(resultado.aluno, null);
  assert.equal(repo.correcoes[0].alunoId, null);
});

test('removerCorrecao: apaga a correção existente e responde 404 para id desconhecido', async () => {
  const repo = fakeRepository();
  const service = createCorrecaoService(repo);
  const { id } = await service.lancarNotaManual({ codigo: 'ANA123', nota: 3 }, 1);
  await service.removerCorrecao(String(id), 1);
  assert.equal(repo.correcoes.length, 0);
  await rejeitaCom(service.removerCorrecao(id, 1), 404, 'não encontrada');
  await rejeitaCom(service.removerCorrecao('abc', 1), 400, 'inválida');
});

test('listarAplicacao: uma linha por cópia com o estado e "sem folha" para quem não tem cópia nem nota', async () => {
  const repo = {
    async findAplicacao(id, professorId) {
      return id === 50 && professorId === 1
        ? { id: 50, prova: { id: 5, titulo: 'P1' }, turma: { id: 9, nome: 'Turma A' }, notaMaxima: 10 }
        : null;
    },
    async listCopiasDaAplicacao() {
      return [
        { codigo: 'BBB222', rotulo: 'Bruno', aluno: { id: 8, nome: 'Bruno' }, correcao: { id: 1, nota: 7.5, tipo: 'AUTOMATICA' } },
        { codigo: 'ANON11', rotulo: 'Prova #01', aluno: null, correcao: null },
        { codigo: 'ANON22', rotulo: 'Prova #02', aluno: { id: 6, nome: 'Carla' }, correcao: { id: 2, nota: 5, tipo: 'MANUAL' } },
        { codigo: 'AAA111', rotulo: 'Ana', aluno: { id: 7, nome: 'Ana' }, correcao: null },
      ];
    },
    async listAlunosDaTurma() {
      return [{ id: 7, nome: 'Ana' }, { id: 8, nome: 'Bruno' }, { id: 6, nome: 'Carla' }, { id: 5, nome: 'Diego', matricula: '04' }];
    },
  };
  const service = createCorrecaoService(repo);
  const r = await service.listarAplicacao('50', 1);
  assert.deepEqual(
    r.linhas.map((l) => [l.aluno?.nome ?? l.rotulo, l.estado, l.codigo, l.correcao?.percentual ?? null]),
    [
      ['Ana', 'PENDENTE', 'AAA111', null],
      ['Bruno', 'CORRIGIDA', 'BBB222', 75],
      ['Carla', 'CORRIGIDA', 'ANON22', 50],
      ['Diego', 'SEM_FOLHA', null, null],
      ['Prova #01', 'PENDENTE', 'ANON11', null],
    ]
  );
  assert.deepEqual(r.resumo, { corrigidas: 2, pendentes: 2, semFolha: 1, totalCopias: 4 });
  await rejeitaCom(service.listarAplicacao(50, 2), 404, 'não encontrada');
  await rejeitaCom(service.listarAplicacao('x', 1), 400, 'inválida');
});

test('buscarCopiaParaCorrecao: devolve a geometria da folha na ordem impressa, igual à do PDF', async () => {
  const service = createCorrecaoService(fakeRepository());
  const { folha, questoes } = await service.buscarCopiaParaCorrecao('ANA123', 1);
  assert.equal(folha.marcadores.length, 4);
  assert.deepEqual(folha.questoes.map((q) => [q.numero, q.questaoId, q.opcoes.map((o) => o.letra).join('')]), [
    [1, 100, 'AB'],
    [2, 200, 'AB'],
  ]);
  assert.deepEqual(questoes.map((q) => q.questaoId), [100, 200]);
  // mesmos centros que o PDF desenha (pdf/sheetLayout.js)
  const { getSheetGeometry, markerCenters } = await import('../src/pdf/sheetLayout.js');
  const geometria = getSheetGeometry([2, 2]);
  assert.deepEqual(folha.marcadores, markerCenters(geometria));
  assert.equal(folha.questoes[1].opcoes[1].x, geometria.rows[1].options[1].cx);
  assert.equal(folha.questoes[1].opcoes[1].y, geometria.rows[1].options[1].cy);
});
