// Formato do texto gravado dentro do QR Code de cada cópia da prova.
// "SGP1" identifica o sistema e a versão do formato; depois dos dois pontos vem o
// código da cópia (o mesmo gerado em utils/answerKey.js). Gerador e leitor usam
// este arquivo, então o formato só precisa ser alterado aqui.
export const QR_PREFIX = 'SGP1:';

const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

function normalizeCode(code) {
  return String(code ?? '')
    .trim()
    .toUpperCase();
}

// Monta o texto do QR a partir do código da cópia. Lança erro se o código for inválido.
export function buildQrPayload(code) {
  const normalized = normalizeCode(code);
  if (!CODE_PATTERN.test(normalized)) {
    throw new Error(`Código inválido para QR Code: "${code}"`);
  }
  return QR_PREFIX + normalized;
}

// Faz o caminho inverso: recebe o texto lido de um QR e devolve o código da cópia,
// ou null se o texto não for um QR do SGP (por exemplo, o QR de outro sistema).
export function parseQrPayload(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed.toUpperCase().startsWith(QR_PREFIX)) return null;
  const code = normalizeCode(trimmed.slice(QR_PREFIX.length));
  return CODE_PATTERN.test(code) ? code : null;
}
