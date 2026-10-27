import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { createAplicacaoService } from '../src/services/aplicacao.service.js';

// Repository falso, em memória. Professor 1: provas 1 (Rascunho), 2 (Arquivada) e 3 (Pronta);
// turmas 1 (Ativa) e 2 (Arquivada). O professor 2 tem a prova 9 e a turma 9.
function fakeRepository() {
  const provas = {
    1: { id: 1, professorId: 1, status: 'RASCUNHO' },
    2: { id: 2, professorId: 1, status: 'ARQUIVADA' },
    3: { id: 3, professorId: 1, status: 'PRONTA' },
    9: { id: 9, professorId: 2, status: 'RASCUNHO' },
  };
  const turmas = {
    1: { id: 1, professorId: 1, status: 'ATIVA' },
    2: { id: 2, professorId: 1, status: 'ARQUIVADA' },
    9: { id: 9, professorId: 2, status: 'ATIVA' },
  };
  const aplicacoes = [];
  let proximoId = 1;
  const dono = (a) => provas[a.examId].professorId;

  return {
    aplicacoes,
    provas,
    async listByProfessor(professorId) {
      return aplicacoes.filter((a) => dono(a) === professorId);
    },
    async findById(id, professorId) {
      const a = aplicacoes.find((x) => x.id === id && dono(x) === professorId);
      return a ? { ...a } : null;
    },
    async findProva(id, professorId) {
      const p = provas[id];
      return p && p.professorId === professorId ? { id: p.id, status: p.status } : null;
    },
    async findTurma(id, professorId) {
      const t = turmas[id];
      return t && t.professorId === professorId ? { id: t.id, status: t.status } : null;
    },
    async create({ provaId, turmaId, quantidade }) {
      const aplicacao = {
        id: proximoId++, examId: provaId, classId: turmaId, status: 'Pendente', quantity: quantidade, date: null,
        shuffleQuestions: true, shuffleAlternatives: true, linkToRoster: false,
      };
      aplicacoes.push(aplicacao);
      if (provas[provaId].status === 'RASCUNHO') provas[provaId].status = 'PRONTA'; // regra da T19 (no banco, na mesma transação)
      return { ...aplicacao };
    },
    async updateConfig(id, campos) {
      Object.assign(aplicacoes.find((a) => a.id === id), campos);
    },
    async marcarAplicada(id, data) {
      const a = aplicacoes.find((x) => x.id === id);
      a.status = 'Aplicada';
      a.date = a.date ?? data;
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

const novo = (extra = {}) => ({ examId: 1, classId: 1, quantity: 30, ...extra });

test('criar: nasce Pendente, com os padrões de embaralhamento', async () => {
  const service = createAplicacaoService(fakeRepository());
  const a = await service.criar(novo(), 1);
  assert.equal(a.status, 'Pendente');
  assert.equal(a.quantity, 30);
  assert.equal(a.shuffleQuestions, true);
  assert.equal(a.linkToRoster, false);
});

test('criar: a prova em Rascunho vira Pronta na primeira aplicação (T19)', async () => {
  const repo = fakeRepository();
  const service = createAplicacaoService(repo);
  await service.criar(novo({ examId: 1 }), 1);
  assert.equal(repo.provas[1].status, 'PRONTA');
  await service.criar(novo({ examId: 1 }), 1); // segunda aplicação da mesma prova é permitida
  assert.equal(repo.provas[1].status, 'PRONTA');
  await service.criar(novo({ examId: 3 }), 1);
  assert.equal(repo.provas[3].status, 'PRONTA');
});

test('criar: prova arquivada e turma arquivada são recusadas (409)', async () => {
  const service = createAplicacaoService(fakeRepository());
  await rejeita(service.criar(novo({ examId: 2 }), 1), 409);
  await rejeita(service.criar(novo({ classId: 2 }), 1), 409);
});

test('criar: prova ou turma de outro professor não existem para mim (404)', async () => {
  const service = createAplicacaoService(fakeRepository());
  await rejeita(service.criar(novo({ examId: 9 }), 1), 404);
  await rejeita(service.criar(novo({ classId: 9 }), 1), 404);
  await rejeita(service.criar(novo({ examId: 999 }), 1), 404);
});

test('criar: valida os campos (400)', async () => {
  const service = createAplicacaoService(fakeRepository());
  await rejeita(service.criar(novo({ examId: 'x' }), 1), 400);
  await rejeita(service.criar(novo({ classId: undefined }), 1), 400);
  await rejeita(service.criar(novo({ quantity: 0 }), 1), 400);
  await rejeita(service.criar(novo({ quantity: 1.5 }), 1), 400);
  await rejeita(service.criar(novo({ quantity: 1001 }), 1), 400);
});

test('buscar/listar: isolamento entre professores', async () => {
  const service = createAplicacaoService(fakeRepository());
  const a = await service.criar(novo(), 1);
  assert.equal((await service.listar(1)).length, 1);
  assert.equal((await service.listar(2)).length, 0);
  await rejeita(service.buscar(a.id, 2), 404);
  await rejeita(service.buscar('abc', 1), 400);
});

test('atualizar: muda quantidade e opções enquanto Pendente', async () => {
  const service = createAplicacaoService(fakeRepository());
  const a = await service.criar(novo(), 1);
  const atualizada = await service.atualizar(a.id, { quantity: 12, shuffleAlternatives: false, linkToRoster: true }, 1);
  assert.equal(atualizada.quantity, 12);
  assert.equal(atualizada.shuffleAlternatives, false);
  assert.equal(atualizada.linkToRoster, true);
  assert.equal(atualizada.shuffleQuestions, true);
});

test('atualizar: exige algum campo válido (400)', async () => {
  const service = createAplicacaoService(fakeRepository());
  const a = await service.criar(novo(), 1);
  await rejeita(service.atualizar(a.id, {}, 1), 400);
  await rejeita(service.atualizar(a.id, { shuffleQuestions: 'sim' }, 1), 400);
  await rejeita(service.atualizar(a.id, { quantity: -3 }, 1), 400);
});

test('aplicar: marca como Aplicada com a data de hoje, uma vez só', async () => {
  const service = createAplicacaoService(fakeRepository(), { hoje: () => '2026-10-27' });
  const a = await service.criar(novo(), 1);
  const aplicada = await service.aplicar(a.id, 1);
  assert.equal(aplicada.status, 'Aplicada');
  assert.equal(aplicada.date, '2026-10-27');
  const denovo = await service.aplicar(a.id, 1); // repetir não muda nada
  assert.equal(denovo.date, '2026-10-27');
});

test('atualizar: depois de Aplicada a configuração trava (409)', async () => {
  const service = createAplicacaoService(fakeRepository());
  const a = await service.criar(novo(), 1);
  await service.aplicar(a.id, 1);
  await rejeita(service.atualizar(a.id, { quantity: 5 }, 1), 409);
});

test('aplicar: outro professor não consegue (404)', async () => {
  const service = createAplicacaoService(fakeRepository());
  const a = await service.criar(novo(), 1);
  await rejeita(service.aplicar(a.id, 2), 404);
});
