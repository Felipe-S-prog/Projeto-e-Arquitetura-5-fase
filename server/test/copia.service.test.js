import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { createCopiaService } from '../src/services/copia.service.js';

// Repository falso, em memória. Professor 1: aplicação 1 (Pendente, prova 1 com 2 questões),
// aplicação 2 (Aplicada), aplicação 3 (Pendente, vinculada aos alunos) e aplicação 4 (Pendente,
// prova sem questões). O professor 2 tem a aplicação 9.
function fakeRepository() {
  const aplicacoes = {
    1: { id: 1, professorId: 1, provaId: 1, status: 'PENDENTE', quantidade: 3, embaralharQuestoes: true, embaralharAlternativas: true, vincularAlunos: false },
    2: { id: 2, professorId: 1, provaId: 1, status: 'APLICADA', quantidade: 2, embaralharQuestoes: true, embaralharAlternativas: true, vincularAlunos: false },
    3: { id: 3, professorId: 1, provaId: 1, status: 'PENDENTE', quantidade: 5, embaralharQuestoes: true, embaralharAlternativas: true, vincularAlunos: true },
    4: { id: 4, professorId: 1, provaId: 2, status: 'PENDENTE', quantidade: 5, embaralharQuestoes: true, embaralharAlternativas: true, vincularAlunos: false },
    9: { id: 9, professorId: 2, provaId: 1, status: 'PENDENTE', quantidade: 1, embaralharQuestoes: true, embaralharAlternativas: true, vincularAlunos: false },
  };
  const questoesDaProva = { 1: [{ id: 10, totalAlternativas: 4 }, { id: 20, totalAlternativas: 2 }], 2: [] };
  const copias = [{ aplicacaoId: 2, codigo: 'ANTIGA', rotulo: 'Prova #01', ordem: {}, publicado: false }];
  const correcoes = new Set();
  let proximoId = 1;

  const toApi = (c) => ({ id: c.id, applicationId: c.aplicacaoId, code: c.codigo, label: c.rotulo, answerKeyPublished: c.publicado });
  const dono = (aplicacaoId) => aplicacoes[aplicacaoId]?.professorId;

  return {
    copias,
    correcoes,
    async listByProfessor(professorId) {
      return copias.filter((c) => dono(c.aplicacaoId) === professorId).map(toApi);
    },
    async listByAplicacao(aplicacaoId, professorId) {
      return copias.filter((c) => c.aplicacaoId === aplicacaoId && dono(aplicacaoId) === professorId).map(toApi);
    },
    async findAplicacao(id, professorId) {
      const a = aplicacoes[id];
      return a && a.professorId === professorId ? { ...a } : null;
    },
    async listQuestoesDaProva(provaId) {
      return questoesDaProva[provaId] ?? [];
    },
    async listCodigos() {
      return copias.map((c) => c.codigo);
    },
    async countCorrecoes(aplicacaoId) {
      return correcoes.has(aplicacaoId) ? 1 : 0;
    },
    async substituirCopias(aplicacaoId, novas) {
      for (let i = copias.length - 1; i >= 0; i--) if (copias[i].aplicacaoId === aplicacaoId) copias.splice(i, 1);
      for (const c of novas) copias.push({ id: proximoId++, aplicacaoId, ...c, publicado: false });
      aplicacoes[aplicacaoId].quantidade = novas.length;
    },
    async publicarGabarito(aplicacaoId, codigo) {
      for (const c of copias) if (c.aplicacaoId === aplicacaoId && (!codigo || c.codigo === codigo)) c.publicado = true;
    },
  };
}

async function rejeita(promessa, statusEsperado) {
  await assert.rejects(promessa, (err) => {
    assert.ok(err instanceof AppError, `esperava AppError, veio ${err}`);
    assert.equal(err.statusCode, statusEsperado);
    return true;
  });
}

test('gerar: cria a quantidade da aplicação, com códigos que não repetem os do banco', async () => {
  const repo = fakeRepository();
  const service = createCopiaService(repo);
  const copias = await service.gerar(1, 1);
  assert.equal(copias.length, 3);
  assert.ok(copias.every((c) => c.code !== 'ANTIGA'));
  assert.equal(new Set(copias.map((c) => c.code)).size, 3);
});

test('gerar: passa as questões e o embaralhamento da aplicação para o gerador', async () => {
  let recebido;
  const service = createCopiaService(fakeRepository(), {
    gerar: (dados) => {
      recebido = dados;
      return [];
    },
  });
  await service.gerar(1, 1);
  assert.deepEqual(recebido.questoes, [{ id: 10, totalAlternativas: 4 }, { id: 20, totalAlternativas: 2 }]);
  assert.equal(recebido.quantidade, 3);
  assert.equal(recebido.embaralharQuestoes, true);
  assert.deepEqual(recebido.codigosEmUso, ['ANTIGA']);
});

test('gerar de novo troca todas as cópias da aplicação', async () => {
  const repo = fakeRepository();
  const service = createCopiaService(repo);
  const primeira = await service.gerar(1, 1);
  const segunda = await service.gerar(1, 1);
  assert.equal(segunda.length, 3);
  assert.equal(repo.copias.filter((c) => c.aplicacaoId === 1).length, 3);
  assert.ok(segunda.every((c) => !primeira.some((p) => p.code === c.code)));
});

test('gerar: aplicação já Aplicada fica com as cópias impressas (409)', async () => {
  await rejeita(createCopiaService(fakeRepository()).gerar(2, 1), 409);
});

test('gerar: aplicação com correção lançada não pode ser regerada (409)', async () => {
  const repo = fakeRepository();
  repo.correcoes.add(1);
  await rejeita(createCopiaService(repo).gerar(1, 1), 409);
});

test('gerar: vincular aos alunos fica para a T24 e prova sem questões é recusada (409)', async () => {
  const service = createCopiaService(fakeRepository());
  await rejeita(service.gerar(3, 1), 409);
  await rejeita(service.gerar(4, 1), 409);
});

test('isolamento entre professores e id inválido', async () => {
  const service = createCopiaService(fakeRepository());
  await rejeita(service.gerar(9, 1), 404);
  await rejeita(service.listarDaAplicacao(9, 1), 404);
  await rejeita(service.gerar('abc', 1), 400);
  assert.equal((await service.listar(2)).length, 0);
  assert.equal((await service.listar(1)).length, 1);
});

test('publicarGabarito: uma cópia pelo código ou todas', async () => {
  const repo = fakeRepository();
  const service = createCopiaService(repo);
  const [primeira] = await service.gerar(1, 1);
  const depoisDeUma = await service.publicarGabarito(1, { code: primeira.code.toLowerCase() }, 1);
  assert.equal(depoisDeUma.filter((c) => c.answerKeyPublished).length, 1);
  const depoisDeTodas = await service.publicarGabarito(1, {}, 1);
  assert.ok(depoisDeTodas.every((c) => c.answerKeyPublished));
});

test('publicarGabarito: sem cópias (409), código de outra aplicação (404) ou inválido (400)', async () => {
  const service = createCopiaService(fakeRepository());
  await rejeita(service.publicarGabarito(1, {}, 1), 409);
  await service.gerar(1, 1);
  await rejeita(service.publicarGabarito(1, { code: 'ANTIGA' }, 1), 404);
  await rejeita(service.publicarGabarito(1, { code: 'ab' }, 1), 400);
  await rejeita(service.publicarGabarito(9, {}, 1), 404);
});
