import { AppError } from '../errors/AppError.js';

// Regras puras da correção (sem banco e sem HTTP), usadas pelo correcao.service.
// Ficam separadas para serem testadas com dados montados à mão.

export const LETRAS = ['A', 'B', 'C', 'D', 'E'];

// Notas e pontos sempre com 2 casas, como no banco (DECIMAL(5,2)).
export function arredondar(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function percentual(nota, notaMaxima) {
  if (!notaMaxima) return null;
  return arredondar((nota / notaMaxima) * 100);
}

// Monta as questões na ordem em que foram IMPRESSAS na cópia, com as alternativas
// na ordem embaralhada daquela cópia. É o mesmo cálculo do gerador de PDF
// (client/src/utils/answerKey.js): a letra A é a primeira alternativa impressa.
//
// ordem:        { questionIds: [idQuestao...], alternativesOrder: { [idQuestao]: [ordemOriginal...] } }
// questoes:     questões da prova (prova_questao + questao), em qualquer ordem
// alternativas: alternativas dessas questões, com a posição original em "ordem"
export function montarQuestoesImpressas(ordem, questoes, alternativas) {
  const porId = new Map(questoes.map((q) => [q.questaoId, q]));
  const idsImpressos = ordem.questionIds.length > 0 ? ordem.questionIds : [...questoes].sort((a, b) => a.posicao - b.posicao).map((q) => q.questaoId);

  if (idsImpressos.length !== questoes.length || idsImpressos.some((id) => !porId.has(id))) {
    throw AppError.conflict('A ordem gravada na cópia não corresponde às questões da prova.');
  }

  return idsImpressos.map((questaoId, i) => {
    const questao = porId.get(questaoId);
    const base = { numero: i + 1, questaoId, tipo: questao.tipo, enunciado: questao.enunciado, pontuacao: questao.pontuacao };
    if (questao.tipo !== 'OBJETIVA') return { ...base, alternativas: [], letraCorreta: null };

    const daQuestao = alternativas.filter((a) => a.questaoId === questaoId).sort((a, b) => a.ordem - b.ordem);
    const ordemOriginal = ordem.alternativesOrder[questaoId] ?? daQuestao.map((a) => a.ordem);
    const porOrdem = new Map(daQuestao.map((a) => [a.ordem, a]));
    if (ordemOriginal.length !== daQuestao.length || ordemOriginal.some((o) => !porOrdem.has(o))) {
      throw AppError.conflict(`As alternativas gravadas na cópia não correspondem às da questão ${i + 1}.`);
    }

    const impressas = ordemOriginal.map((o, idx) => ({ letra: LETRAS[idx], texto: porOrdem.get(o).texto, correta: porOrdem.get(o).correta }));
    const correta = impressas.find((a) => a.correta);
    if (!correta) throw AppError.conflict(`A questão ${i + 1} não tem alternativa correta cadastrada.`);

    return { ...base, alternativas: impressas.map(({ letra, texto }) => ({ letra, texto })), letraCorreta: correta.letra };
  });
}

// Corrige a cópia a partir do que o aluno marcou.
// respostas: [{ questaoId, letra }] nas objetivas (letra nula = em branco ou anulada)
//            [{ questaoId, pontos }] nas discursivas (o professor informa quanto vale a resposta)
// Questão objetiva sem resposta enviada conta como em branco; discursiva precisa dos pontos.
export function calcularCorrecao(questoesImpressas, respostas) {
  if (!Array.isArray(respostas)) throw AppError.badRequest('Envie as respostas em uma lista.');

  const porQuestao = new Map();
  for (const resposta of respostas) {
    const questaoId = Number(resposta?.questaoId);
    if (!questoesImpressas.some((q) => q.questaoId === questaoId)) {
      throw AppError.badRequest('Há resposta para uma questão que não está nesta prova.');
    }
    if (porQuestao.has(questaoId)) throw AppError.badRequest('Há mais de uma resposta para a mesma questão.');
    porQuestao.set(questaoId, resposta);
  }

  const itens = questoesImpressas.map((q) => {
    const resposta = porQuestao.get(q.questaoId);

    if (q.tipo !== 'OBJETIVA') {
      const pontos = Number(resposta?.pontos);
      if (resposta?.pontos === undefined || resposta?.pontos === null || resposta?.pontos === '' || !Number.isFinite(pontos)) {
        throw AppError.badRequest(`Informe os pontos da questão discursiva ${q.numero}.`);
      }
      if (pontos < 0 || pontos > q.pontuacao) {
        throw AppError.badRequest(`Os pontos da questão ${q.numero} devem ficar entre 0 e ${q.pontuacao}.`);
      }
      return { numero: q.numero, questaoId: q.questaoId, tipo: q.tipo, letraMarcada: null, letraCorreta: null, correta: null, pontos: arredondar(pontos), pontuacao: q.pontuacao };
    }

    const letra = normalizarLetra(resposta?.letra);
    if (letra && !q.alternativas.some((a) => a.letra === letra)) {
      throw AppError.badRequest(`A questão ${q.numero} só tem as alternativas ${q.alternativas.map((a) => a.letra).join(', ')}.`);
    }
    const correta = letra === q.letraCorreta;
    return {
      numero: q.numero,
      questaoId: q.questaoId,
      tipo: q.tipo,
      letraMarcada: letra,
      letraCorreta: q.letraCorreta,
      correta,
      pontos: correta ? q.pontuacao : 0,
      pontuacao: q.pontuacao,
    };
  });

  return { nota: arredondar(itens.reduce((soma, item) => soma + item.pontos, 0)), respostas: itens };
}

function normalizarLetra(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const letra = String(valor).trim().toUpperCase();
  if (!LETRAS.includes(letra)) throw AppError.badRequest(`Letra inválida: "${valor}". Use de A a E.`);
  return letra;
}

// Valida a nota digitada no lançamento manual (T31).
export function validarNotaManual(valor, notaMaxima) {
  const nota = Number(valor);
  if (valor === undefined || valor === null || valor === '' || !Number.isFinite(nota)) {
    throw AppError.badRequest('Informe a nota.');
  }
  if (nota < 0 || nota > notaMaxima) throw AppError.badRequest(`A nota deve ficar entre 0 e ${notaMaxima}.`);
  if (Math.abs(arredondar(nota) - nota) > 1e-9) throw AppError.badRequest('A nota aceita no máximo 2 casas decimais.');
  return arredondar(nota);
}
