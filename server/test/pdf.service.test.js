import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { AppError } from '../src/errors/AppError.js';
import { createPdfService } from '../src/services/pdf.service.js';

// Repositories falsos, em memória. Professor 1: aplicação 1 (2 cópias, prova com 2 objetivas),
// aplicação 2 (sem cópias) e aplicação 3 (prova com uma questão sem alternativas).
// O montador do PDF é o de verdade (T22), rodando no Node.
function fakeRepositories() {
  const aplicacoes = {
    1: { id: 1, status: 'PENDENTE', dataAplicacao: '2026-10-27', prova: { id: 1, titulo: 'Cálculo I — P1' }, turma: { nome: 'Turma A' } },
    2: { id: 2, status: 'PENDENTE', dataAplicacao: null, prova: { id: 1, titulo: 'Cálculo I — P1' }, turma: { nome: 'Turma A' } },
    3: { id: 3, status: 'PENDENTE', dataAplicacao: null, prova: { id: 2, titulo: 'Discursiva' }, turma: { nome: 'Turma A' } },
  };
  const objetivas = [
    { id: 10, excerpt: 'Quanto é 2 + 2?', imageUrl: null, score: 5, alternatives: [{ text: '3' }, { text: '4' }, { text: '5' }] },
    { id: 20, excerpt: 'A derivada de x² é:', imageUrl: 'https://exemplo.test/grafico.png', score: 5, alternatives: [{ text: '2x' }, { text: 'x' }] },
  ];
  const questoes = { 1: objetivas, 2: [{ id: 30, excerpt: 'Explique.', imageUrl: null, score: 10, alternatives: [] }] };
  const copia = (code, questionIds, alternativesOrder) => ({ code, label: code, studentName: null, questionIds, alternativesOrder });
  const copias = {
    1: [copia('ABC234', [20, 10], { 10: [2, 0, 1], 20: [1, 0] }), copia('XYZ789', [10, 20], { 10: [0, 1, 2], 20: [0, 1] })],
    2: [],
    3: [copia('DIS234', [30], { 30: [] })],
  };

  return {
    pdfRepository: {
      async findAplicacao(id, professorId) {
        return professorId === 1 ? aplicacoes[id] ?? null : null;
      },
      async listQuestoesDaProva(provaId) {
        return questoes[provaId] ?? [];
      },
      async findNomeInstituicao() {
        return 'Católica SC';
      },
    },
    copiaRepository: {
      async listByAplicacao(id) {
        return copias[id] ?? [];
      },
    },
  };
}

const semImagens = async () => ({ images: {}, failed: [] });

async function rejeita(promessa, statusEsperado) {
  await assert.rejects(promessa, (err) => {
    assert.ok(err instanceof AppError, `esperava AppError, veio ${err}`);
    assert.equal(err.statusCode, statusEsperado);
    return true;
  });
}

test('gera o PDF de verdade com todas as cópias do banco, em sequência', async () => {
  const service = createPdfService(fakeRepositories(), { carregarImagens: semImagens });
  const pdf = await service.gerar('1', {}, 1);
  const doc = await PDFDocument.load(pdf.bytes);
  assert.equal(doc.getPageCount(), pdf.paginas);
  assert.equal(pdf.paginas, 4); // 2 cópias x (folha de resposta + 1 página de questões)
  assert.equal(doc.getTitle(), 'Cálculo I — P1');
  assert.equal(pdf.nomeArquivo, 'provas-calculo-i-p1-turma-a.pdf');
  assert.deepEqual(pdf.avisos, []);
});

test('só a folha de resposta e frente e verso mudam as páginas', async () => {
  const service = createPdfService(fakeRepositories(), { carregarImagens: semImagens });
  assert.equal((await service.gerar(1, { modo: 'folha-de-resposta' }, 1)).paginas, 2);
  assert.equal((await service.gerar(1, { modo: 'folha-de-resposta', frenteVerso: 'true' }, 1)).paginas, 4);
});

test('passa ao montador os dados do banco: cabeçalho, cópias e data no formato das telas', async () => {
  let recebido;
  const service = createPdfService(fakeRepositories(), {
    carregarImagens: semImagens,
    montarPdf: async (dados) => {
      recebido = dados;
      return { bytes: new Uint8Array([1]), pageCount: 1, warnings: [] };
    },
  });
  await service.gerar(1, {}, 1);
  assert.equal(recebido.className, 'Turma A');
  assert.equal(recebido.institution, 'Católica SC');
  assert.equal(recebido.date, '27/10/2026');
  assert.deepEqual(recebido.copies.map((c) => c.code), ['ABC234', 'XYZ789']);
  assert.equal(recebido.mode, 'completo');
  assert.equal(recebido.duplex, false);
});

test('imagem que não carregou vira aviso, sem derrubar o PDF', async () => {
  const service = createPdfService(fakeRepositories(), { carregarImagens: async () => ({ images: {}, failed: [20] }) });
  const pdf = await service.gerar(1, {}, 1);
  assert.deepEqual(pdf.avisos, ['A imagem da questão 20 não pôde ser incluída.']);
});

test('sem cópias geradas (409), aplicação de outro professor (404) e parâmetros inválidos (400)', async () => {
  const service = createPdfService(fakeRepositories(), { carregarImagens: semImagens });
  await rejeita(service.gerar(2, {}, 1), 409);
  await rejeita(service.gerar(1, {}, 2), 404);
  await rejeita(service.gerar('abc', {}, 1), 400);
  await rejeita(service.gerar(1, { modo: 'gabarito' }, 1), 400);
});

test('dado que o PDF não consegue imprimir volta 409 com o motivo do montador', async () => {
  const service = createPdfService(fakeRepositories(), { carregarImagens: semImagens });
  await assert.rejects(service.gerar(3, {}, 1), (err) => {
    assert.equal(err.statusCode, 409);
    assert.match(err.message, /Não foi possível montar o PDF/);
    return true;
  });
});
