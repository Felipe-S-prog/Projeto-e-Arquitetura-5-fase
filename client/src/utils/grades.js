// Formatação de notas e datas vindas da API de Correção e Notas.
const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function formatScore(value) {
  return value === null || value === undefined ? '—' : numberFormat.format(value);
}

export function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${numberFormat.format(value)}%`;
}

// "2026-10-20" -> "20/10/2026" (data sem horário, sem conversão de fuso).
export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function formatDateTime(isoDateTime) {
  if (!isoDateTime) return '—';
  return new Date(isoDateTime).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export const GRADING_TYPE_LABEL = { AUTOMATICA: 'Automática', MANUAL: 'Manual' };

// Cor da nota pelo percentual: verde a partir de 70%, âmbar de 50% a 70%, vermelho abaixo.
export function scoreColor(percent) {
  if (percent === null || percent === undefined) return 'var(--muted-3)';
  if (percent >= 70) return 'var(--green-text)';
  if (percent >= 50) return 'var(--amber-text)';
  return 'var(--red-text-strong)';
}
