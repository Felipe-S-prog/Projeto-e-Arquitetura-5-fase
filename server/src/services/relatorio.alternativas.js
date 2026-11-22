import { percentual } from './correcao.calculo.js';

const LETRAS = ['A', 'B', 'C', 'D', 'E'];

// Estatística das respostas por questão (T74): quantas pessoas marcaram cada alternativa.
//
// A letra gravada na correção é a da ordem IMPRESSA na cópia (cada versão embaralha as
// alternativas). Para somar as versões, cada resposta volta para a alternativa original pela
// ordem da própria cópia. As letras do resultado são as da ordem cadastrada da questão.
//
// alternativas: [{ questaoId, ordem, texto, correta }] das questões objetivas da prova.
// respostas:    [{ questaoId, letraMarcada, alternativesOrder }] das correções automáticas
//               (letraMarcada nula = em branco ou anulada por marcação dupla).
// Devolve um Map questaoId -> { respostas, emBranco, alternativas, maisMarcadas }.
export function distribuicaoDasAlternativas(alternativas, respostas) {
  const porQuestao = new Map();
  for (const a of [...alternativas].sort((x, y) => x.questaoId - y.questaoId || x.ordem - y.ordem)) {
    if (!porQuestao.has(a.questaoId)) porQuestao.set(a.questaoId, []);
    porQuestao.get(a.questaoId).push(a);
  }

  const contagens = new Map(
    [...porQuestao].map(([questaoId, alts]) => [questaoId, { total: 0, emBranco: 0, marcadas: alts.map(() => 0) }]),
  );
  for (const r of respostas) {
    const contagem = contagens.get(r.questaoId);
    if (!contagem) continue; // discursiva ou questão que saiu da prova
    contagem.total += 1;
    if (!r.letraMarcada) {
      contagem.emBranco += 1;
      continue;
    }
    const impressa = LETRAS.indexOf(r.letraMarcada);
    const ordem = r.alternativesOrder?.[r.questaoId];
    const original = ordem ? ordem[impressa] : impressa;
    if (original === undefined || original < 0 || original >= contagem.marcadas.length) {
      contagem.emBranco += 1; // letra que não existe nesta questão: não conta como alternativa
      continue;
    }
    contagem.marcadas[original] += 1;
  }

  const resultado = new Map();
  for (const [questaoId, alts] of porQuestao) {
    const { total, emBranco, marcadas } = contagens.get(questaoId);
    const maior = Math.max(0, ...marcadas);
    resultado.set(questaoId, {
      respostas: total,
      emBranco: { quantidade: emBranco, percentual: total ? percentual(emBranco, total) : null },
      alternativas: alts.map((a, i) => ({
        letra: LETRAS[i],
        texto: a.texto,
        correta: Boolean(a.correta),
        quantidade: marcadas[i],
        percentual: total ? percentual(marcadas[i], total) : null,
      })),
      // empate: todas as mais marcadas; ninguém marcou nada: lista vazia
      maisMarcadas: maior > 0 ? alts.map((_, i) => i).filter((i) => marcadas[i] === maior).map((i) => LETRAS[i]) : [],
    });
  }
  return resultado;
}
