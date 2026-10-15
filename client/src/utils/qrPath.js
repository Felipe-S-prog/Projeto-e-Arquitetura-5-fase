// Converte a matriz de um QR Code (size x size módulos) em um único desenho SVG.
// Cada sequência horizontal de módulos escuros vira um retângulo de 1 de altura,
// o que gera um SVG pequeno e nítido em qualquer tamanho de impressão.
// isDark(row, col) deve devolver true quando o módulo é escuro.
export function buildQrPath(size, isDark) {
  let path = '';
  for (let row = 0; row < size; row++) {
    let col = 0;
    while (col < size) {
      if (!isDark(row, col)) {
        col++;
        continue;
      }
      const start = col;
      while (col < size && isDark(row, col)) col++;
      const length = col - start;
      path += `M${start} ${row}h${length}v1h-${length}z`;
    }
  }
  return path;
}
