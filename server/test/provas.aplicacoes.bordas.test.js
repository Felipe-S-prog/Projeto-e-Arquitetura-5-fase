import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { statusParaApi } from '../src/models/prova.model.js';
import { createAplicacaoService } from '../src/services/aplicacao.service.js';
import { createProvaService, MAX_QUESTOES_POR_PROVA } from '../src/services/prova.service.js';

// Casos de borda de Provas e Aplicações (T50). Os dois services usam o MESMO banco em memória,
// como no MySQL: a aplicação muda o status da prova, e a prova decide se pode ser editada.
// Professor 1: questões 1..25 e turmas 1 e 2 (ativas). Professor 2: questão 99 e turma 9.
function fakeBanco() {
  const questoes = { 1: Array.from({ length: 25 }, (_, i) => i + 1), 2: [99] };
  const turmas = {
    1: { id: 1, professorId: 1, status: 'ATIVA' },
    2: { id: 2, professorId: 1, status: 'ATIVA' },
    9: { id: 9, professorId: 2, status: 'ATIVA' },
  };
  const provas = {}; // status no formato do banco: RASCUNHO, PRONTA, ARQUIVADA
  const aplicacoes = [];
  let proximaProva = 1;
  let proximaAplicacao = 1;

  const verProva = (p) => ({
    id: p.id,
    title: p.titulo,
    description: p.descricao ?? '',
    status: statusParaApi(p.status),
    questions: p.questoes.map((q) => ({ ...q })),
  });
  const provaDoProfessor = (id, professorId) => (provas[id]?.professorId === professorId ? provas[id] : null);
  const donoDaAplicacao = (a) => provas[a.examId].professorId;

  const provaRepository = {
    async listByProfessor(professorId) {
      return Object.values(provas).filter((p) => p.professorId === professorId).map(verProva);
    },
    async findById(id, professorId) {
      const p = provaDoProfessor(id, professorId);
      return p ? verProva(p) : null;
    },
    async findQuestoesDisponiveis(ids, professorId) {
      return ids.filter((id) => (questoes[professorId] ?? []).includes(id));
    },
    async create({ professorId, titulo, descricao, questoes: lista }) {
      const p = { id: proximaProva++, professorId, titulo, descricao, status: 'RASCUNHO', questoes: lista.map((q) => ({ ...q })) };
      provas[p.id] = p;
      return verProva(p);
    },
    // Como o repository real: só grava se a prova ainda está em Rascunho; senão devolve null.
    async update(id, professorId, { titulo, descricao, questoes: lista }) {
      await provaRepository.antesDeGravar?.();
      const p = provaDoProfessor(id, professorId);
      if (p?.status !== 'RASCUNHO') return null;
      Object.assign(p, { titulo, descricao, questoes: lista.map((q) => ({ ...q })) });
      return verProva(p);
    },
    async updateStatus(id, professorId, status) {
      provaDoProfessor(id, professorId).status = status;
      return verProva(provas[id]);
    },
  };

  const aplicacaoRepository = {
    async listByProfessor(professorId) {
      return aplicacoes.filter((a) => donoDaAplicacao(a) === professorId).map((a) => ({ ...a }));
    },
    async findById(id, professorId) {
      const a = aplicacoes.find((x) => x.id === id && donoDaAplicacao(x) === professorId);
      return a ? { ...a } : null;
    },
    async findProva(id, professorId) {
      const p = provaDoProfessor(id, professorId);
      return p ? { id: p.id, status: p.status } : null;
    },
    async findTurma(id, professorId) {
      const t = turmas[id];
      return t && t.professorId === professorId ? { id: t.id, status: t.status } : null;
    },
    // Mesma transação do banco: grava a aplicação e passa a prova de Rascunho para Pronta (T19).
    async create({ provaId, turmaId, quantidade }) {
      const a = {
        id: proximaAplicacao++, examId: provaId, classId: turmaId, status: 'Pendente', quantity: quantidade, date: null,
        shuffleQuestions: true, shuffleAlternatives: true, linkToRoster: false,
      };
      aplicacoes.push(a);
      if (provas[provaId].status === 'RASCUNHO') provas[provaId].status = 'PRONTA';
      return { ...a };
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

  return {
    turmas,
    provaRepository,
    provas: createProvaService(provaRepository),
    aplicacoes: createAplicacaoService(aplicacaoRepository, { hoje: () => '2026-11-19' }),
  };
}

async function rejeita(promessa, statusEsperado, trechoDaMensagem) {
  await assert.rejects(promessa, (err) => {
    assert.ok(err instanceof AppError, `esperava AppError, veio ${err}`);
    assert.equal(err.statusCode, statusEsperado);
    if (trechoDaMensagem) assert.match(err.message, trechoDaMensagem);
    return true;
  });
}

const questoesDe = (...ids) => ids.map((questionId) => ({ questionId, score: 1 }));
const dadosDaProva = (extra = {}) => ({ title: 'Prova bimestral', questions: questoesDe(1, 2, 3), ...extra });
const aplicar = (banco, provaId, turmaId, quantity = 30) =>
  banco.aplicacoes.criar({ examId: provaId, classId: turmaId, quantity }, 1);

// --- Reaplicação ---

test('reaplicação: a mesma prova na mesma turma gera aplicações independentes (segunda chamada)', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  const primeira = await aplicar(banco, prova.id, 1, 30);
  const segunda = await aplicar(banco, prova.id, 1, 4);

  assert.notEqual(primeira.id, segunda.id);
  assert.equal((await banco.aplicacoes.listar(1)).length, 2);

  // Aplicar a primeira não mexe na segunda, que continua Pendente e configurável.
  await banco.aplicacoes.aplicar(primeira.id, 1);
  await rejeita(banco.aplicacoes.atualizar(primeira.id, { quantity: 10 }, 1), 409);
  const segundaAtualizada = await banco.aplicacoes.atualizar(segunda.id, { quantity: 5, linkToRoster: true }, 1);
  assert.equal(segundaAtualizada.status, 'Pendente');
  assert.equal(segundaAtualizada.quantity, 5);
  assert.equal((await banco.aplicacoes.buscar(primeira.id, 1)).quantity, 30);
});

test('reaplicação: uma prova já Pronta (com aplicação) pode ser aplicada de novo e continua Pronta', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  const primeira = await aplicar(banco, prova.id, 1);
  await banco.aplicacoes.aplicar(primeira.id, 1);

  await aplicar(banco, prova.id, 1);
  assert.equal((await banco.provas.buscar(prova.id, 1)).status, 'Pronta');
});

// --- Aplicação em mais de uma turma ---

test('mais de uma turma: a mesma prova aplicada em duas turmas, cada uma com a sua configuração', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  const turmaA = await aplicar(banco, prova.id, 1, 30);
  const turmaB = await aplicar(banco, prova.id, 2, 25);

  assert.deepEqual([turmaA.classId, turmaB.classId], [1, 2]);
  await banco.aplicacoes.atualizar(turmaB.id, { shuffleQuestions: false }, 1);
  assert.equal((await banco.aplicacoes.buscar(turmaA.id, 1)).shuffleQuestions, true);
  assert.equal((await banco.aplicacoes.buscar(turmaB.id, 1)).shuffleQuestions, false);
  assert.equal((await banco.provas.buscar(prova.id, 1)).status, 'Pronta');
});

test('mais de uma turma: turma de outro professor não recebe a minha prova (404)', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  await rejeita(aplicar(banco, prova.id, 9), 404);
  assert.equal((await banco.provas.buscar(prova.id, 1)).status, 'Rascunho'); // a tentativa não muda o status
});

test('mais de uma turma: turma arquivada depois da aplicação não recebe outra, mas a que já existe segue', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  const existente = await aplicar(banco, prova.id, 2);
  banco.turmas[2].status = 'ARQUIVADA';

  await rejeita(aplicar(banco, prova.id, 2), 409, /turma arquivada/i);
  await banco.aplicacoes.atualizar(existente.id, { quantity: 12 }, 1);
  assert.equal((await banco.aplicacoes.aplicar(existente.id, 1)).status, 'Aplicada');
});

// --- Edição de prova que já tem aplicação ---

test('edição: em Rascunho a prova é editada; depois da primeira aplicação, não (409)', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  const editada = await banco.provas.atualizar(prova.id, dadosDaProva({ questions: questoesDe(3, 1) }), 1);
  assert.deepEqual(editada.questions.map((q) => q.questionId), [3, 1]);

  await aplicar(banco, prova.id, 1);
  await rejeita(
    banco.provas.atualizar(prova.id, dadosDaProva({ title: 'Outro título', questions: questoesDe(4) }), 1),
    409,
    /Rascunho \(esta está Pronta\)/
  );
  const depois = await banco.provas.buscar(prova.id, 1);
  assert.equal(depois.title, 'Prova bimestral');
  assert.deepEqual(depois.questions.map((q) => q.questionId), [3, 1]); // as cópias impressas continuam valendo
});

test('edição: a aplicação criada no meio da edição vence; a edição é recusada sem gravar nada (409)', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  // Simula a corrida: o service já conferiu "Rascunho", e a aplicação entra antes da gravação.
  banco.provaRepository.antesDeGravar = () => {
    banco.provaRepository.antesDeGravar = null;
    return aplicar(banco, prova.id, 1);
  };

  await rejeita(banco.provas.atualizar(prova.id, dadosDaProva({ questions: questoesDe(7) }), 1), 409, /Pronta/);
  const depois = await banco.provas.buscar(prova.id, 1);
  assert.equal(depois.status, 'Pronta');
  assert.deepEqual(depois.questions.map((q) => q.questionId), [1, 2, 3]);
});

test('edição: prova arquivada com aplicação não é editada nem aplicada de novo, mas a aplicação existente segue', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  const existente = await aplicar(banco, prova.id, 1);
  await banco.provas.arquivar(prova.id, 1);

  await rejeita(banco.provas.atualizar(prova.id, dadosDaProva(), 1), 409, /Arquivada/);
  await rejeita(aplicar(banco, prova.id, 2), 409, /arquivada/);
  assert.equal((await banco.aplicacoes.aplicar(existente.id, 1)).status, 'Aplicada');
});

test('edição: outro professor não edita a minha prova (404), nem antes nem depois da aplicação', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  await rejeita(banco.provas.atualizar(prova.id, dadosDaProva({ questions: questoesDe(99) }), 2), 404);
  await aplicar(banco, prova.id, 1);
  await rejeita(banco.provas.atualizar(prova.id, dadosDaProva({ questions: questoesDe(99) }), 2), 404);
});

// --- Limite de questões ---

const ate = (n) => Array.from({ length: n }, (_, i) => i + 1);

test('limite: a edição aceita exatamente 20 questões', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);
  const editada = await banco.provas.atualizar(prova.id, dadosDaProva({ questions: questoesDe(...ate(MAX_QUESTOES_POR_PROVA)) }), 1);
  assert.equal(editada.questions.length, 20);
});

test('limite: a edição recusa a 21ª questão e a prova sem questões, sem alterar a prova (400)', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);

  await rejeita(banco.provas.atualizar(prova.id, dadosDaProva({ questions: questoesDe(...ate(21)) }), 1), 400, /no máximo 20/);
  await rejeita(banco.provas.atualizar(prova.id, dadosDaProva({ questions: [] }), 1), 400);
  assert.deepEqual((await banco.provas.buscar(prova.id, 1)).questions.map((q) => q.questionId), [1, 2, 3]);
});

test('limite: na edição continuam valendo questão repetida, de outro professor e pontuação zero (400)', async () => {
  const banco = fakeBanco();
  const prova = await banco.provas.criar(dadosDaProva(), 1);

  await rejeita(banco.provas.atualizar(prova.id, dadosDaProva({ questions: questoesDe(1, 1) }), 1), 400);
  await rejeita(banco.provas.atualizar(prova.id, dadosDaProva({ questions: questoesDe(1, 99) }), 1), 400);
  await rejeita(
    banco.provas.atualizar(prova.id, dadosDaProva({ questions: [{ questionId: 1, score: 0 }] }), 1),
    400
  );
});
