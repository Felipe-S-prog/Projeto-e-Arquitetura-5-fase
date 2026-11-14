// Medição de desempenho do PDF consolidado (T60): tempo de geração e tamanho do arquivo.
// Roda o montador de verdade (buildConsolidatedPdf), sem banco e sem rede, para o número ficar
// reproduzível em qualquer máquina. Uso, na pasta server:  npm run pdf:medir
// Opcional: --repeticoes=5 (padrão) e --json para a saída em JSON.
import os from 'node:os';
import { deflateSync } from 'node:zlib';
import { buildConsolidatedPdf } from '../src/pdf/buildConsolidatedPdf.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const REPETICOES = Number(args.repeticoes ?? 5);

// PNG de 400x300 com ruído (~40 KB), no lugar da imagem de uma questão.
function pngDeTeste(largura = 400, altura = 300, semente = 1) {
  let s = semente;
  const aleatorio = () => ((s = (s * 1664525 + 1013904223) >>> 0) & 0xff);
  const linhas = Buffer.alloc((largura * 3 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    const base = y * (largura * 3 + 1);
    for (let x = 0; x < largura * 3; x++) linhas[base + 1 + x] = (x + y + aleatorio()) & 0xff;
  }
  const crcTabela = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTabela[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const bloco = (tipo, dados) => {
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length);
    const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados]);
    const fim = Buffer.alloc(4);
    fim.writeUInt32BE(crc(corpo));
    return Buffer.concat([tamanho, corpo, fim]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(linhas)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

// Prova típica: 10 objetivas de 5 alternativas, enunciados de duas linhas.
const QUESTOES = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  excerpt:
    `Questão ${i + 1}: considere a função f(x) = x² - ${i + 2}x + ${i}. Assinale a alternativa que apresenta ` +
    'corretamente o valor da derivada no ponto indicado e justifique mentalmente o raciocínio usado.',
  score: 1,
  imageUrl: null,
  alternatives: Array.from({ length: 5 }, (_, j) => ({ text: `f'(${j}) = ${2 * j - (i + 2)}, pela regra da potência`, correct: j === 0 })),
}));

// Cada cópia com a própria ordem, como a geração das cópias (T23) faz.
function copias(quantidade, identificadas) {
  return Array.from({ length: quantidade }, (_, n) => {
    const desloca = (lista, k) => lista.map((_, i) => lista[(i + k) % lista.length]);
    const ids = desloca(QUESTOES.map((q) => q.id), n % 10);
    return {
      code: `C${String(n + 1).padStart(5, '0')}`,
      label: identificadas ? `Aluno ${n + 1}` : `Prova #${n + 1}`,
      studentName: identificadas ? `Aluno de Teste Número ${String(n + 1).padStart(3, '0')}` : null,
      questionIds: ids,
      alternativesOrder: Object.fromEntries(ids.map((id) => [id, desloca([0, 1, 2, 3, 4], (n + id) % 5)])),
    };
  });
}

const CENARIOS = [
  { copias: 4, identificadas: false, modo: 'completo', imagens: 0 },
  { copias: 4, identificadas: true, modo: 'completo', imagens: 0 },
  { copias: 30, identificadas: false, modo: 'completo', imagens: 0 },
  { copias: 30, identificadas: true, modo: 'completo', imagens: 0 },
  { copias: 40, identificadas: true, modo: 'completo', imagens: 0 },
  { copias: 100, identificadas: true, modo: 'completo', imagens: 0 },
  { copias: 4, identificadas: true, modo: 'completo', imagens: 2 },
  { copias: 40, identificadas: true, modo: 'completo', imagens: 2 },
  { copias: 100, identificadas: true, modo: 'completo', imagens: 2 },
  { copias: 40, identificadas: true, modo: 'folha-de-resposta', imagens: 0 },
  { copias: 100, identificadas: true, modo: 'folha-de-resposta', imagens: 0 },
];

async function medir(cenario) {
  const questions = QUESTOES.map((q, i) => (i < cenario.imagens ? { ...q, imageUrl: `img-${q.id}` } : q));
  const images = Object.fromEntries(
    questions.filter((q) => q.imageUrl).map((q) => [q.id, { type: 'png', bytes: pngDeTeste(400, 300, q.id) }]),
  );
  const entrada = {
    exam: { title: 'Cálculo I - P1 (medição T60)' },
    className: 'Turma de medição',
    date: '14/11/2026',
    institution: 'Católica SC',
    questions,
    copies: copias(cenario.copias, cenario.identificadas),
    images,
    mode: cenario.modo,
    creationDate: new Date('2026-11-14T12:00:00Z'),
  };

  await buildConsolidatedPdf(entrada); // aquecimento
  const tempos = [];
  let ultimo;
  for (let i = 0; i < REPETICOES; i++) {
    const inicio = process.hrtime.bigint();
    ultimo = await buildConsolidatedPdf(entrada);
    tempos.push(Number(process.hrtime.bigint() - inicio) / 1e6);
  }
  tempos.sort((a, b) => a - b);
  const mediana = tempos[Math.floor(tempos.length / 2)];
  return { ...cenario, paginas: ultimo.pageCount, kb: ultimo.bytes.length / 1024, medianaMs: mediana, msPorCopia: mediana / cenario.copias };
}

const resultados = [];
for (const cenario of CENARIOS) resultados.push(await medir(cenario));

if ('json' in args) {
  console.log(JSON.stringify(resultados, null, 2));
} else {
  const fmt = (n, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  console.log(`Node ${process.version}, ${os.cpus()[0]?.model?.trim()} (${os.cpus().length} núcleos), ${os.platform()}`);
  console.log(`Mediana de ${REPETICOES} execuções por cenário, depois de uma de aquecimento.\n`);
  console.log('| Cópias | Identificação | Modo | Imagens | Páginas | Tamanho | Tempo (mediana) | Por cópia |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of resultados) {
    console.log(
      `| ${r.copias} | ${r.identificadas ? 'com nome' : 'sem nome'} | ${r.modo === 'completo' ? 'completo' : 'só folha'} | ${r.imagens} | ` +
        `${r.paginas} | ${fmt(r.kb)} KB | ${fmt(r.medianaMs)} ms | ${fmt(r.msPorCopia, 1)} ms |`,
    );
  }
}
