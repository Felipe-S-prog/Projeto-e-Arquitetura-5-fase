import { AppError } from '../errors/AppError.js';
import { buildConsolidatedPdf } from '../pdf/buildConsolidatedPdf.js';
import { loadQuestionImages } from '../pdf/questionImages.js';

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

// Service do PDF consolidado (T25). Monta o arquivo de verdade a partir do banco:
// - a aplicação é do professor dono da prova (RNF04);
// - usa as cópias gravadas pela T23, cada uma com a sua ordem de questões e alternativas;
// - sem cópias geradas não há o que imprimir (409);
// - dado que o PDF não consegue imprimir (ex.: questão sem alternativas) volta como 409 com o motivo;
// - baixar não muda nada no banco: quem marca a aplicação como Aplicada é POST /aplicacoes/:id/aplicar.
export function createPdfService(
  { pdfRepository, copiaRepository },
  { montarPdf = buildConsolidatedPdf, carregarImagens = loadQuestionImages, agora = () => new Date() } = {}
) {
  return {
    async gerar(aplicacaoIdBruto, query, professorId) {
      const aplicacaoId = parseId(aplicacaoIdBruto, 'Aplicação inválida.');
      const { modo, frenteVerso } = parseOpcoes(query);

      const aplicacao = await pdfRepository.findAplicacao(aplicacaoId, professorId);
      if (!aplicacao) throw AppError.notFound('Aplicação não encontrada.');

      const copias = await copiaRepository.listByAplicacao(aplicacao.id, professorId);
      if (copias.length === 0) throw AppError.conflict('Gere as cópias da prova antes de baixar o PDF.');

      const [questoes, instituicao] = await Promise.all([
        pdfRepository.listQuestoesDaProva(aplicacao.prova.id),
        pdfRepository.findNomeInstituicao(),
      ]);
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
  };
}
