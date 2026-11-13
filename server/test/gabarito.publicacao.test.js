import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { createCopiaService } from '../src/services/copia.service.js';
import { createGabaritoService } from '../src/services/gabarito.service.js';

// T59: publicar, consultar pelo link público, despublicar e consultar de novo, com versões diferentes
// da mesma prova. Os dois services leem a MESMA base em memória, como fazem com o banco.
//
// Prova 1: questão 10 (4 alternativas, a correta é a original 1) e questão 20 (2 alternativas, a
// correta é a original 0). Aplicação 1 tem três versões embaralhadas; a aplicação 2 aplica a mesma
// prova a outra turma, com uma cópia só.
function base() {
  let relogio = 0;
  const copias = [
    { aplicacaoId: 1, codigo: 'VERSAO1', questionIds: [10, 20], alternativesOrder: { 10: [0, 1, 2, 3], 20: [0, 1] } },
    { aplicacaoId: 1, codigo: 'VERSAO2', questionIds: [20, 10], alternativesOrder: { 10: [3, 2, 1, 0], 20: [1, 0] } },
    { aplicacaoId: 1, codigo: 'VERSAO3', questionIds: [10, 20], alternativesOrder: { 10: [2, 3, 0, 1], 20: [1, 0] } },
    { aplicacaoId: 2, codigo: 'OUTRA1', questionIds: [10, 20], alternativesOrder: { 10: [0, 1, 2, 3], 20: [0, 1] } },
  ].map((c) => ({ ...c, publicado: false, publicadoEm: null }));
  const aplicacoes = { 1: { id: 1, professorId: 1, provaId: 1 }, 2: { id: 2, professorId: 1, provaId: 1 } };
  const alvo = (aplicacaoId, codigo) => copias.filter((c) => c.aplicacaoId === aplicacaoId && (!codigo || c.codigo === codigo));

  const copiaRepository = {
    async findAplicacao(id, professorId) {
      const a = aplicacoes[id];
      return a && a.professorId === professorId ? { ...a } : null;
    },
    async listByAplicacao(aplicacaoId) {
      return alvo(aplicacaoId).map((c) => ({ code: c.codigo, answerKeyPublished: c.publicado, answerKeyPublishedAt: c.publicadoEm }));
    },
    // como o UPDATE do repository real: quem já estava publicado mantém a data
    async publicarGabarito(aplicacaoId, codigo) {
      for (const c of alvo(aplicacaoId, codigo)) {
        if (!c.publicado) Object.assign(c, { publicado: true, publicadoEm: `2026-11-13T12:00:0${++relogio}.000Z` });
      }
    },
    async despublicarGabarito(aplicacaoId, codigo) {
      for (const c of alvo(aplicacaoId, codigo)) Object.assign(c, { publicado: false, publicadoEm: null });
    },
  };

  const gabaritoRepository = {
    async findCopiaPorCodigo(codigo) {
      const c = copias.find((x) => x.codigo === codigo);
      if (!c) return null;
      return {
        code: c.codigo,
        provaId: 1,
        provaTitulo: 'Cálculo I — P1',
        answerKeyPublished: c.publicado,
        answerKeyPublishedAt: c.publicadoEm,
        questionIds: c.questionIds,
        alternativesOrder: c.alternativesOrder,
      };
    },
    async listAlternativasDaProva() {
      return new Map([
        [10, [false, true, false, false]],
        [20, [true, false]],
      ]);
    },
  };

  return {
    copias: createCopiaService(copiaRepository),
    gabarito: createGabaritoService(gabaritoRepository),
  };
}

// Letras que o aluno vê no link público, ou o status HTTP da recusa.
async function linkPublico(gabarito, codigo) {
  try {
    const r = await gabarito.consultar(codigo);
    return r.answers.map((a) => a.correctLetter).join('');
  } catch (err) {
    assert.ok(err instanceof AppError, `esperava AppError, veio ${err}`);
    return err.statusCode;
  }
}

async function situacao(gabarito, codigos) {
  return Object.fromEntries(await Promise.all(codigos.map(async (c) => [c, await linkPublico(gabarito, c)])));
}

const TODAS = ['VERSAO1', 'VERSAO2', 'VERSAO3', 'OUTRA1'];

test('antes de publicar, nenhuma versão aparece no link público (403)', async () => {
  const { gabarito } = base();
  assert.deepEqual(await situacao(gabarito, TODAS), { VERSAO1: 403, VERSAO2: 403, VERSAO3: 403, OUTRA1: 403 });
});

test('por versão: publicar uma cópia libera só ela, com as letras da própria ordem', async () => {
  const { copias, gabarito } = base();
  await copias.publicarGabarito(1, { code: 'VERSAO2' }, 1);
  assert.deepEqual(await situacao(gabarito, TODAS), { VERSAO1: 403, VERSAO2: 'BC', VERSAO3: 403, OUTRA1: 403 });
});

test('por aplicação: publicar todas libera as três versões, cada uma com o seu gabarito, e não mexe na outra aplicação', async () => {
  const { copias, gabarito } = base();
  await copias.publicarGabarito(1, {}, 1);
  assert.deepEqual(await situacao(gabarito, TODAS), { VERSAO1: 'BA', VERSAO2: 'BC', VERSAO3: 'DB', OUTRA1: 403 });
});

test('despublicar uma versão tira só ela do ar; as outras continuam respondendo', async () => {
  const { copias, gabarito } = base();
  await copias.publicarGabarito(1, {}, 1);
  await copias.despublicarGabarito(1, 'VERSAO3', 1);
  assert.deepEqual(await situacao(gabarito, TODAS), { VERSAO1: 'BA', VERSAO2: 'BC', VERSAO3: 403, OUTRA1: 403 });
});

test('despublicar a aplicação tira todas as versões do ar, sem mexer na outra aplicação', async () => {
  const { copias, gabarito } = base();
  await copias.publicarGabarito(1, {}, 1);
  await copias.publicarGabarito(2, {}, 1);
  const lista = await copias.despublicarGabarito(1, undefined, 1);
  assert.ok(lista.every((c) => !c.answerKeyPublished && c.answerKeyPublishedAt === null));
  assert.deepEqual(await situacao(gabarito, TODAS), { VERSAO1: 403, VERSAO2: 403, VERSAO3: 403, OUTRA1: 'BA' });
});

test('publicar de novo depois de despublicar volta a responder, com nova data', async () => {
  const { copias, gabarito } = base();
  await copias.publicarGabarito(1, { code: 'VERSAO1' }, 1);
  const primeira = (await gabarito.consultar('VERSAO1')).publishedAt;
  await copias.despublicarGabarito(1, 'VERSAO1', 1);
  await copias.publicarGabarito(1, { code: 'VERSAO1' }, 1);
  const segunda = await gabarito.consultar('VERSAO1');
  assert.equal(segunda.answers.map((a) => a.correctLetter).join(''), 'BA');
  assert.ok(segunda.publishedAt > primeira);
});
