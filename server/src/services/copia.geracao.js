// Geração das cópias de uma aplicação (T23): regra pura, sem banco, para ser testada isolada.
// Era feita no navegador (client/src/utils/answerKey.js); agora roda no servidor, que grava o
// resultado em copia_prova. O formato de ordem_embaralhamento é o mesmo que a correção (T30) lê:
// { questionIds: [...], alternativesOrder: { [idQuestao]: [índices originais das alternativas] } }.

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, pra evitar confusão na hora de digitar
export const CODE_LENGTH = 6; // copia_prova.codigo é CHAR(6)

// Embaralha uma lista sem alterar o array original (Fisher-Yates).
function shuffle(list, random) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomCode(random) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
  return code;
}

// questoes: [{ id, totalAlternativas }] na ordem da prova (discursiva tem 0 alternativas).
// codigosEmUso: códigos que já existem no banco; nenhum é repetido, nem entre as cópias novas.
// Devolve uma cópia por pessoa: { codigo, rotulo, ordem: { questionIds, alternativesOrder } }.
export function gerarCopias({ questoes, quantidade, embaralharQuestoes, embaralharAlternativas, codigosEmUso = [], random = Math.random }) {
  const usados = new Set(codigosEmUso);

  return Array.from({ length: quantidade }, (_, i) => {
    const ordemQuestoes = embaralharQuestoes ? shuffle(questoes, random) : questoes;
    const alternativesOrder = {};
    for (const questao of ordemQuestoes) {
      const original = Array.from({ length: questao.totalAlternativas }, (_, idx) => idx);
      alternativesOrder[questao.id] = embaralharAlternativas ? shuffle(original, random) : original;
    }

    let codigo;
    do {
      codigo = randomCode(random);
    } while (usados.has(codigo));
    usados.add(codigo);

    return {
      codigo,
      rotulo: `Prova #${String(i + 1).padStart(2, '0')}`,
      ordem: { questionIds: ordemQuestoes.map((q) => q.id), alternativesOrder },
    };
  });
}
