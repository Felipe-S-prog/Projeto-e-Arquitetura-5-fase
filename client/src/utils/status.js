const STATUS_COLORS = {
  Ativa: ['var(--green-bg)', 'var(--green-text)'],
  Arquivada: ['var(--neutral-bg)', 'var(--neutral-text)'],
  Rascunho: ['var(--neutral-bg)', 'var(--neutral-text)'],
  Pronta: ['var(--green-bg)', 'var(--green-text)'],
  Aplicada: ['var(--green-bg)', 'var(--green-text)'],
  Pendente: ['var(--neutral-bg)', 'var(--neutral-text)'],
  Administrador: ['var(--amber-bg)', 'var(--amber-text)'],
  Professor: ['var(--navy-chip-bg)', 'var(--navy)'],
  Ativo: ['var(--green-bg)', 'var(--green-text)'],
  Convidado: ['var(--neutral-bg)', 'var(--neutral-text)'],
};

export function statusColors(status) {
  return STATUS_COLORS[status] || ['var(--neutral-bg)', 'var(--neutral-text)'];
}

export function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function todayBR() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
