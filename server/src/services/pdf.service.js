import { AppError } from '../errors/AppError.js';
import { buildAnswerKeyPdf } from '../pdf/buildAnswerKeyPdf.js';
import { buildConsolidatedPdf } from '../pdf/buildConsolidatedPdf.js';
import { loadQuestionImages } from '../pdf/questionImages.js';
import { resolverGabarito } from './gabarito.service.js';

const MODOS = ['completo', 'folha-de-resposta'];

function parseId(valor, mensagem) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest(mensagem);
  return id;
}

function parseOpcoes(query) {
  const modo = query?.modo ?? 'completo';
  if (!MODOS.includes(modo)) throw AppError.badRequest(`Modo de PDF inválido. Use: ${MODOS.join(' ou ')}.`);
  const frenteVerso = query?.frenteVerso === 'true' || query?.frenteVerso === '1';
  return { modo, frenteVerso };
}

// "AAAA-MM-DD" -> "DD/MM/AAAA", como as telas mostram.
function formatarData(data) {
  if (!data) return null;
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function nomeDoArquivo(...partes) {
  const base = partes
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'provas'}.pdf`;
}

// Service dos PDFs da aplicação. Monta os arquivos de verdade a partir do banco:
// - a aplicação é do professor dono da prova (RNF04);
// - usa as cópias gravadas pela T23, cada uma com a sua ordem de questões e alternativas;
// - sem cópias geradas não há o que imprimir (409);
// - dado que o PDF não consegue imprimir (ex.: questão sem alternativas) volta como 409 com o motivo;
// - baixar não muda nada no banco: quem marca a aplicação como Aplicada é POST /aplicacoes/:id/aplicar.
// gerar: provas consolidadas (T25). gerarGabarito: gabarito de todas as cópias para enviar às pessoas (T27).
export function createPdfService(
  { pdfRepository, copiaRepository },
  {
    montarPdf = buildConsolidatedPdf,
    montarGabarito = buildAnswerKeyPdf,
    carregarImagens = loadQuestionImages,
    agora = () => new Date(),
  } = {}
) {
  // Aplicação do professor, suas cópias e as questões da prova, já validadas.
  async function carregarDados(aplicacaoIdBruto, professorId, mensagemSemCopias) {
    const aplicacaoId = parseId(aplicacaoIdBruto, 'Aplicação inválida.');

    const aplicacao = await pdfRepository.findAplicacao(aplicacaoId, professorId);
    if (!aplicacao) throw AppError.notFound('Aplicação não encontrada.');

    const copias = await copiaRepository.listByAplicacao(aplicacao.id, professorId);
    if (copias.length === 0) throw AppError.conflict(mensagemSemCopias);

    const [questoes, instituicao] = await Promise.all([
      pdfRepository.listQuestoesDaProva(aplicacao.prova.id),
      pdfRepository.findNomeInstituicao(),
    ]);
    return { aplicacao, copias, questoes, instituicao };
  }

  return {
    async gerar(aplicacaoIdBruto, query, professorId) {
      const { modo, frenteVerso } = parseOpcoes(query);
      const { aplicacao, copias, questoes, instituicao } = await carregarDados(
        aplicacaoIdBruto,
        professorId,
        'Gere as cópias da prova antes de baixar o PDF.'
      );
      const { images, failed } = await carregarImagens(questoes);

      let pdf;
      try {
        pdf = await montarPdf({
          exam: { title: aplicacao.prova.titulo },
          className: aplicacao.turma.nome,
          date: formatarData(aplicacao.dataAplicacao),
          institution: instituicao,
          questions: questoes,
          copies: copias,
          images,
          mode: modo,
          duplex: frenteVerso,
          creationDate: agora(),
        });
      } catch (err) {
        // O montador valida os dados antes de desenhar e explica o problema (ex.: alternativas).
        throw AppError.conflict(`Não foi possível montar o PDF: ${err.message}`);
      }

      return {
        nomeArquivo: nomeDoArquivo('provas', aplicacao.prova.titulo, aplicacao.turma.nome),
        bytes: pdf.bytes,
        paginas: pdf.pageCount,
        avisos: [...pdf.warnings, ...failed.map((id) => `A imagem da questão ${id} não pôde ser incluída.`)],
      };
    },

    // Gabarito de todas as cópias da aplicação (T27). As letras saem do mesmo cálculo da
    // consulta pública (T26), então o PDF e a página /gabarito nunca divergem.
    async gerarGabarito(aplicacaoIdBruto, professorId) {
      const { aplicacao, copias, questoes, instituicao } = await carregarDados(
        aplicacaoIdBruto,
        professorId,
        'Gere as cópias da prova antes de exportar o gabarito.'
      );

      const corretasPorQuestao = new Map(questoes.map((q) => [q.id, q.alternatives.map((a) => Boolean(a.correct))]));
      const pdf = await montarGabarito({
        exam: { title: aplicacao.prova.titulo },
        className: aplicacao.turma.nome,
        date: formatarData(aplicacao.dataAplicacao),
        institution: instituicao,
        copies: copias.map((copia) => ({
          code: copia.code,
          label: copia.label,
          answers: resolverGabarito(copia, corretasPorQuestao),
        })),
        creationDate: agora(),
      });

      return {
        nomeArquivo: nomeDoArquivo('gabarito', aplicacao.prova.titulo, aplicacao.turma.nome),
        bytes: pdf.bytes,
        paginas: pdf.pageCount,
        avisos: [],
      };
    },
  };
}
