import { PrimaryButton, SecondaryButton } from './ui';

export default function DownloadModal({ examTitle, className, quantity, shuffleSummary, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'oklch(20% 0.02 250 / 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div style={{ background: 'white', borderRadius: 14, padding: 30, width: '100%', maxWidth: 440 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>Confirmar download</div>
        <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginBottom: 20 }}>
          Revise as informações antes de baixar o PDF consolidado.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 24 }}>
          <Row label="Prova" value={examTitle} />
          <Row label="Turma" value={className} />
          <Row label="Quantidade de provas" value={quantity} />
          <Row label="Embaralhamento" value={shuffleSummary} last />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <PrimaryButton onClick={onConfirm} style={{ flex: 1 }}>
            Confirmar e baixar
          </PrimaryButton>
          <SecondaryButton onClick={onCancel} style={{ flex: 1 }}>
            Cancelar
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, last }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid var(--border-light)',
        fontSize: 14,
      }}
    >
      <span style={{ color: 'var(--muted-2)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
