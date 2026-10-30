import QRCode from 'qrcode';

// QR Code impresso no quadro de resposta de cada cópia (T22, no servidor desde a T25).
// O texto gravado é "SGP1:<código da cópia>", o MESMO formato que o leitor do front decodifica
// (client/src/utils/qrPayload.js). Se o formato mudar, os dois lados precisam mudar juntos.
export const QR_PREFIX = 'SGP1:';

const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

// Nível de correção de erro Q: metade das palavras do QR é reservada para refazer dados
// perdidos (o QR ainda é lido com manchas pequenas na folha).
const ERROR_CORRECTION = 'Q';

export function buildQrPayload(code) {
  const normalized = String(code ?? '').trim().toUpperCase();
  if (!CODE_PATTERN.test(normalized)) {
    throw new Error(`Código inválido para QR Code: "${code}"`);
  }
  return QR_PREFIX + normalized;
}

// Devolve a matriz do QR da cópia: { size, isDark(row, col) }, para desenhar em vetor no PDF.
export function getQrMatrix(code) {
  const qr = QRCode.create(buildQrPayload(code), { errorCorrectionLevel: ERROR_CORRECTION });
  return {
    size: qr.modules.size,
    isDark: (row, col) => !!qr.modules.get(row, col),
  };
}

// Converte a matriz em um único caminho SVG: cada sequência horizontal de módulos escuros
// vira um retângulo de 1 de altura, o que deixa o desenho pequeno e nítido.
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
