import QRCode from 'qrcode';
import { buildQrPayload } from './qrPayload';

// Nível de correção de erro Q: metade das palavras do QR é reservada para refazer dados
// perdidos. Em testes, com o texto "SGP1:CÓDIGO" (QR versão 1, 21x21 módulos), o QR ainda
// foi lido com manchas pequenas (até uns 5% da área); manchas maiores já impedem a leitura.
// O que mais ajuda a leitura é imprimir com bom contraste, sem cobrir a margem branca.
const ERROR_CORRECTION = 'Q';

// Devolve a matriz do QR da cópia: { size, isDark(row, col) }.
// É a forma mais direta de desenhar o QR em vetor, seja em SVG (componente QrCode)
// ou direto no PDF (T22), sem passar por imagem.
export function getQrMatrix(code) {
  const qr = QRCode.create(buildQrPayload(code), { errorCorrectionLevel: ERROR_CORRECTION });
  return {
    size: qr.modules.size,
    isDark: (row, col) => !!qr.modules.get(row, col),
  };
}

// Devolve o QR da cópia como imagem PNG (data URL), para quem precisar de um arquivo
// de imagem, por exemplo para inserir no PDF. margin é a margem branca em módulos.
export function qrToDataUrl(code, { width = 300, margin = 4 } = {}) {
  return QRCode.toDataURL(buildQrPayload(code), {
    errorCorrectionLevel: ERROR_CORRECTION,
    margin,
    width,
    color: { dark: '#000000', light: '#ffffff' },
  });
}
