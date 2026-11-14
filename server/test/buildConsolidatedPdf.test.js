import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inflateSync } from 'node:zlib';
import { PDFArray, PDFDocument, PDFName } from 'pdf-lib';
import { buildConsolidatedPdf } from '../src/pdf/buildConsolidatedPdf.js';

// T60: o montador do PDF (T22/T25) testado direto, lendo o que foi impresso em cada página.
// O pdf-lib grava o texto em hexadecimal (WinAnsi) dentro do conteúdo comprimido da página.

const QUESTOES = Array.from({ length: 10 }, (_, i) => ({
  id: 100 + i,
  excerpt: `Enunciado da questao ${i + 1}.`,
  score: 1,
  imageUrl: null,
  alternatives: Array.from({ length: 5 }, (_, j) => ({ text: `Q${i + 1} alternativa ${j}`, correct: j === 0 })),
}));
const IDS = QUESTOES.map((q) => q.id);
const identidade = Object.fromEntries(IDS.map((id) => [id, [0, 1, 2, 3, 4]]));

const copia = (n, extra = {}) => ({
  code: `COD${String(n).padStart(3, '0')}`,
  label: `Prova #${String(n).padStart(2, '0')}`,
  studentName: null,
  questionIds: IDS,
  alternativesOrder: identidade,
  ...extra,
});

const ALUNOS = Array.from({ length: 35 }, (_, i) => `Aluno Numero ${String(i + 1).padStart(2, '0')}`);

function montar(copies, extra = {}) {
  return buildConsolidatedPdf({
    exam: { title: 'Calculo I - P1' },
    className: 'Turma A',
    date: '14/11/2026',
    institution: 'Catolica SC',
    questions: QUESTOES,
    copies,
    creationDate: new Date('2026-11-14T12:00:00Z'),
    ...extra,
  });
}

// Conteúdo (operadores de desenho) de cada página, já descomprimido.
async function conteudoDasPaginas(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents];
    return streams
      .map((s) => {
        const raw = Buffer.from(s.getContents());
        return (s.dict.get(PDFName.of('Filter')) ? inflateSync(raw) : raw).toString('latin1');
      })
      .join('\n');
  });
}

const hex = (texto) => Buffer.from(texto, 'latin1').toString('hex').toUpperCase();
const imprimiu = (pagina, texto) => pagina.includes(`<${hex(texto)}>`) || pagina.includes(hex(texto));
const paginasDa = (paginas, resumo) => paginas.slice(resumo.firstPage - 1, resumo.firstPage - 1 + resumo.pageCount);

test('com identificação: cada cópia traz o nome do próprio aluno em todas as suas páginas, e só o dele', async () => {
  const copias = ALUNOS.slice(0, 3).map((nome, i) => copia(i + 1, { label: nome, studentName: nome }));
  const pdf = await montar(copias);
  const paginas = await conteudoDasPaginas(pdf.bytes);

  pdf.copies.forEach((resumo, i) => {
    const minhas = paginasDa(paginas, resumo);
    assert.ok(minhas.length >= 2, 'folha de resposta + questões');
    for (const pagina of minhas) {
      assert.ok(imprimiu(pagina, ALUNOS[i]), `página da cópia ${i + 1} sem o nome do aluno`);
      ALUNOS.slice(0, 3)
        .filter((_, j) => j !== i)
        .forEach((outro) => assert.ok(!imprimiu(pagina, outro), `nome de outro aluno na cópia ${i + 1}`));
    }
    assert.ok(imprimiu(minhas[0], `Prova: ${resumo.code}`), 'código da cópia abaixo do QR');
  });
});

test('sem identificação: nenhuma página traz nome; a linha ESTUDANTE fica em branco e as páginas levam o código', async () => {
  const pdf = await montar([copia(1), copia(2)]);
  const paginas = await conteudoDasPaginas(pdf.bytes);

  assert.ok(paginas.every((p) => !ALUNOS.some((nome) => imprimiu(p, nome))));
  pdf.copies.forEach((resumo) => {
    const [folha, ...questoes] = paginasDa(paginas, resumo);
    assert.ok(imprimiu(folha, 'ESTUDANTE:'));
    assert.ok(imprimiu(folha, `Prova: ${resumo.code}`));
    questoes.forEach((p) => assert.ok(imprimiu(p, `Prova ${resumo.code}`), 'cabeçalho das questões com o código'));
  });
});

test('várias versões: cada cópia sai com a própria ordem de questões e de alternativas', async () => {
  const invertida = [...IDS].reverse();
  const alternativasInvertidas = Object.fromEntries(IDS.map((id) => [id, [4, 3, 2, 1, 0]]));
  const pdf = await montar([copia(1), copia(2, { questionIds: invertida, alternativesOrder: alternativasInvertidas })]);
  const paginas = await conteudoDasPaginas(pdf.bytes);
  const [v1, v2] = pdf.copies.map((resumo) => paginasDa(paginas, resumo).slice(1).join('\n'));
  const posicao = (texto, t) => texto.indexOf(hex(t));

  // versão 1 na ordem original, versão 2 de trás para frente
  assert.ok(posicao(v1, 'Enunciado da questao 1.') < posicao(v1, 'Enunciado da questao 10.'));
  assert.ok(posicao(v2, 'Enunciado da questao 10.') < posicao(v2, 'Enunciado da questao 1.'));
  assert.ok(posicao(v1, 'Q1 alternativa 0') < posicao(v1, 'Q1 alternativa 4'));
  assert.ok(posicao(v2, 'Q1 alternativa 4') < posicao(v2, 'Q1 alternativa 0'));
  // as duas versões têm as mesmas questões, só em outra ordem
  QUESTOES.forEach((q) => {
    assert.ok(posicao(v1, q.excerpt) >= 0 && posicao(v2, q.excerpt) >= 0);
  });
});

test('turma grande (35 alunos): uma cópia por aluno, em sequência, sem misturar páginas', async () => {
  const copias = ALUNOS.map((nome, i) => copia(i + 1, { label: nome, studentName: nome }));
  const pdf = await montar(copias);
  const paginas = await conteudoDasPaginas(pdf.bytes);

  assert.equal(pdf.copies.length, 35);
  assert.equal(pdf.pageCount, paginas.length);
  assert.equal(pdf.copies.reduce((total, c) => total + c.pageCount, 0), pdf.pageCount);
  pdf.copies.forEach((resumo, i) => {
    if (i > 0) assert.equal(resumo.firstPage, pdf.copies[i - 1].firstPage + pdf.copies[i - 1].pageCount);
    paginasDa(paginas, resumo).forEach((p) => assert.ok(imprimiu(p, ALUNOS[i]), `página trocada na cópia ${i + 1}`));
  });
  assert.deepEqual(pdf.warnings, []);
});

test('turma grande em frente e verso: toda cópia começa em página ímpar; só a folha de resposta dá uma página por aluno', async () => {
  const copias = ALUNOS.map((nome, i) => copia(i + 1, { label: nome, studentName: nome }));

  const frenteVerso = await montar(copias, { duplex: true });
  assert.ok(frenteVerso.copies.every((c) => c.firstPage % 2 === 1 && c.pageCount % 2 === 0));

  const folhas = await montar(copias, { mode: 'folha-de-resposta' });
  assert.equal(folhas.pageCount, 35);
  assert.ok(folhas.copies.every((c, i) => c.firstPage === i + 1 && c.pageCount === 1));
});
