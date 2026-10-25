import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { createProvaService } from '../src/services/prova.service.js';

// Repository falso, em memória: testa as regras do service sem MySQL.
// Professor 1 tem as questões 10, 11, 12 (a 12 está excluída); o professor 2 tem a 20.
function fakeRepository() {
  const questoesDoProfessor = { 1: [10, 11], 2: [20] }; // a 12 (excluída) não aparece como disponível
  const provas = [];
  let proximoId = 1;

  const repo = {
    provas,
    async listByProfessor(professorId) {
      return provas.filter((p) => p.professorId === professorId).map(({ professorId: _p, ...resto }) => resto);
    },
    async findById(id, professorId) {
      const prova = provas.find((p) => p.id === id && p.professorId === professorId);
      if (!prova) return null;
      const { professorId: _p, ...resto } = prova;
      return resto;
    },
    async findQuestoesDisponiveis(ids, professorId) {
      return ids.filter((id) => (questoesDoProfessor[professorId] ?? []).includes(id));
    },
    async create({ professorId, titulo, descricao, questoes }) {
      const prova = {
        id: proximoId++,
        professorId,
        title: titulo,
        description: descricao ?? '',
        status: 'Rascunho',
        questions: questoes.map((q) => ({ ...q })),
      };
      provas.push(prova);
      return repo.findById(prova.id, professorId);
    },
    async update(id, professorId, { titulo, descricao, questoes }) {
      const prova = provas.find((p) => p.id === id && p.professorId === professorId);
      Object.assign(prova, { title: titulo, description: descricao ?? '', questions: questoes.map((q) => ({ ...q })) });
      return repo.findById(id, professorId);
    },
    async updateStatus(id, professorId, status) {
      const prova = provas.find((p) => p.id === id && p.professorId === professorId);
      prova.status = { ARQUIVADA: 'Arquivada' }[status];
      return repo.findById(id, professorId);
    },
  };
  return repo;
}

const dadosValidos = () => ({
  title: '  Prova 1  ',
  description: 'Bimestral',
  questions: [
    { questionId: 10, score: 6 },
    { questionId: 11, score: 4 },
  ],
});

async function rejeita(promessa, statusEsperado) {
  await assert.rejects(promessa, (err) => {
    assert.ok(err instanceof AppError, `esperava AppError, veio ${err}`);
    assert.equal(err.statusCode, statusEsperado);
    return true;
  });
}

test('criar: grava em Rascunho, com título aparado e questões na ordem recebida', async () => {
  const service = createProvaService(fakeRepository());
  const prova = await service.criar(dadosValidos(), 1);
  assert.equal(prova.title, 'Prova 1');
  assert.equal(prova.status, 'Rascunho');
  assert.deepEqual(prova.questions, [
    { questionId: 10, score: 6 },
    { questionId: 11, score: 4 },
  ]);
});

test('criar: exige título', async () => {
  const service = createProvaService(fakeRepository());
  await rejeita(service.criar({ ...dadosValidos(), title: '   ' }, 1), 400);
});

test('criar: exige pelo menos uma questão', async () => {
  const service = createProvaService(fakeRepository());
  await rejeita(service.criar({ ...dadosValidos(), questions: [] }, 1), 400);
});

test('criar: recusa a 21ª questão (limite do RF04)', async () => {
  const service = createProvaService(fakeRepository());
  const muitas = Array.from({ length: 21 }, (_, i) => ({ questionId: i + 1, score: 1 }));
  await rejeita(service.criar({ ...dadosValidos(), questions: muitas }, 1), 400);
});

test('criar: aceita exatamente 20 questões (falha só por não serem do professor, nunca pelo limite)', async () => {
  const service = createProvaService(fakeRepository());
  const vinte = Array.from({ length: 20 }, (_, i) => ({ questionId: i + 1, score: 1 }));
  await assert.rejects(service.criar({ ...dadosValidos(), questions: vinte }, 1), (err) => {
    assert.match(err.message, /não existem|pertencem/);
    return true;
  });
});

test('criar: pontuação precisa ser maior que 0', async () => {
  const service = createProvaService(fakeRepository());
  await rejeita(service.criar({ ...dadosValidos(), questions: [{ questionId: 10, score: 0 }] }, 1), 400);
  await rejeita(service.criar({ ...dadosValidos(), questions: [{ questionId: 10, score: -2 }] }, 1), 400);
  await rejeita(service.criar({ ...dadosValidos(), questions: [{ questionId: 10, score: 'abc' }] }, 1), 400);
});

test('criar: não repete a mesma questão', async () => {
  const service = createProvaService(fakeRepository());
  const repetida = [{ questionId: 10, score: 5 }, { questionId: 10, score: 5 }];
  await rejeita(service.criar({ ...dadosValidos(), questions: repetida }, 1), 400);
});

test('criar: recusa questão de outro professor ou excluída (RNF04)', async () => {
  const service = createProvaService(fakeRepository());
  await rejeita(service.criar({ ...dadosValidos(), questions: [{ questionId: 20, score: 5 }] }, 1), 400);
  await rejeita(service.criar({ ...dadosValidos(), questions: [{ questionId: 12, score: 5 }] }, 1), 400);
});

test('buscar: um professor não enxerga a prova de outro (404)', async () => {
  const service = createProvaService(fakeRepository());
  const prova = await service.criar(dadosValidos(), 1);
  await rejeita(service.buscar(prova.id, 2), 404);
  await rejeita(service.buscar('abc', 1), 400);
});

test('listar: devolve só as provas do professor', async () => {
  const service = createProvaService(fakeRepository());
  await service.criar(dadosValidos(), 1);
  await service.criar({ title: 'Do outro', questions: [{ questionId: 20, score: 10 }] }, 2);
  assert.equal((await service.listar(1)).length, 1);
  assert.equal((await service.listar(2)).length, 1);
});

test('atualizar: edita uma prova em Rascunho', async () => {
  const service = createProvaService(fakeRepository());
  const prova = await service.criar(dadosValidos(), 1);
  const nova = await service.atualizar(prova.id, { title: 'Novo título', questions: [{ questionId: 11, score: 10 }] }, 1);
  assert.equal(nova.title, 'Novo título');
  assert.deepEqual(nova.questions, [{ questionId: 11, score: 10 }]);
});

test('atualizar: prova arquivada não pode ser editada (409)', async () => {
  const service = createProvaService(fakeRepository());
  const prova = await service.criar(dadosValidos(), 1);
  await service.arquivar(prova.id, 1);
  await rejeita(service.atualizar(prova.id, dadosValidos(), 1), 409);
});

test('arquivar: muda o status e não arquiva duas vezes (409)', async () => {
  const service = createProvaService(fakeRepository());
  const prova = await service.criar(dadosValidos(), 1);
  assert.equal((await service.arquivar(prova.id, 1)).status, 'Arquivada');
  await rejeita(service.arquivar(prova.id, 1), 409);
  await rejeita(service.arquivar(999, 1), 404);
});
