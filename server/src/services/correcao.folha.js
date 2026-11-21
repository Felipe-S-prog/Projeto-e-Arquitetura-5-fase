import { getSheetGeometry, markerCenters, MARKER_SIZE, PAGE } from '../pdf/sheetLayout.js';

// Geometria da folha de resposta de uma cópia, para a leitura automática pela foto (T63/T64).
// A posição de tudo sai de pdf/sheetLayout.js, o mesmo arquivo que desenha a folha no PDF,
// então leitura e impressão nunca divergem. O front não importa arquivos do servidor; por isso
// a geometria vai junto com a cópia na rota de correção.
//
// questoesImpressas: questões na ordem impressa da cópia (correcao.calculo.js).
// Devolve null quando a folha não pode ser lida (questão sem alternativas ou fora do limite do quadro).
export function folhaDaCopia(questoesImpressas) {
  if (questoesImpressas.some((q) => q.tipo !== 'OBJETIVA')) return null;

  let geometria;
  try {
    geometria = getSheetGeometry(questoesImpressas.map((q) => q.alternativas.length));
  } catch {
    return null;
  }

  return {
    pagina: { largura: PAGE.width, altura: PAGE.height },
    qr: { x: geometria.qr.x, y: geometria.qr.y, tamanho: geometria.qr.size },
    tamanhoMarcador: MARKER_SIZE,
    marcadores: markerCenters(geometria), // superior esquerdo, superior direito, inferior direito, inferior esquerdo
    questoes: geometria.rows.map((row, i) => ({
      numero: row.number,
      questaoId: questoesImpressas[i].questaoId,
      opcoes: row.options.map((o) => ({ letra: o.letter, x: o.cx, y: o.cy, raio: o.r })),
    })),
  };
}
