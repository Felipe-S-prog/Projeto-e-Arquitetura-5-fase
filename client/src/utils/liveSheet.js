// Leitura da folha de resposta pela câmera ao vivo.
//
// A câmera manda vários quadros por segundo. Um quadro tremido pode achar o QR e os quadrados
// dos cantos e ainda assim ler errado uma bolinha. Por isso só aceitamos a leitura quando
// quadros seguidos dão exatamente o mesmo resultado: mesma prova e mesma letra em cada questão.
// Estas funções são puras (sem câmera nem DOM), para poderem ser testadas.

// Duas leituras são iguais quando são da mesma prova e têm a mesma letra em todas as questões.
export function sameReading(a, b) {
  if (!a || !b || a.code !== b.code) return false;
  const ra = a.reading.respostas;
  const rb = b.reading.respostas;
  if (ra.length !== rb.length) return false;
  return ra.every((r, i) => r.questaoId === rb[i].questaoId && r.letra === rb[i].letra && r.situacao === rb[i].situacao);
}

// Conta leituras iguais em sequência. push(leitura) devolve true quando já houve `needed`
// leituras iguais seguidas; push(null) (quadro sem leitura) zera a contagem.
export function createStabilityTracker(needed = 2) {
  let last = null;
  let count = 0;
  return {
    push(result) {
      if (!result) {
        last = null;
        count = 0;
        return false;
      }
      count = sameReading(last, result) ? count + 1 : 1;
      last = result;
      return count >= needed;
    },
    get count() {
      return count;
    },
    reset() {
      last = null;
      count = 0;
    },
  };
}

// Converte os cantos do QR encontrados numa imagem reduzida para a imagem inteira.
// Procurar o QR na imagem menor é bem mais rápido no celular; a leitura das bolinhas
// continua na imagem inteira.
export function scaleQr(qr, factor) {
  if (!qr || factor === 1) return qr;
  const up = (p) => ({ x: p.x * factor, y: p.y * factor });
  return { ...qr, corners: { tl: up(qr.corners.tl), tr: up(qr.corners.tr), bl: up(qr.corners.bl) } };
}
