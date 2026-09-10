import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { PageHeader, PrimaryButton, Badge } from '../components/ui';
import { QrMarkerIcon } from '../components/icons';

export default function ApplicationsList() {
  const { applications, getExamById, getClassById } = useData();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Histórico de aplicações"
        description="Cada aplicação usa uma prova em uma turma e registra a geração de PDFs, correção e relatório."
        actions={<PrimaryButton onClick={() => navigate('/aplicacoes/nova')}>+ Criar aplicação</PrimaryButton>}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {applications.map((a) => {
          const exam = getExamById(a.examId);
          const cls = getClassById(a.classId);
          const hasPdf = a.status === 'Aplicada';
          return (
            <div
              key={a.id}
              onClick={() => navigate(`/aplicacoes/${a.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '20px 22px',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 14,
                cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>{exam?.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 3 }}>
                    {a.date || '—'} · {a.quantity} provas
                  </div>
                </div>
                <div style={{ width: 20, height: 1.5, background: 'var(--border-strong)', flexShrink: 0 }} />
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--navy)',
                    background: 'var(--navy-chip-tint-bg)',
                    padding: '6px 12px',
                    borderRadius: 100,
                    flexShrink: 0,
                  }}
                >
                  {cls?.name}
                </div>
              </div>
              <div style={{ color: hasPdf ? 'var(--navy)' : 'var(--border-strong)' }}>
                <QrMarkerIcon size={18} />
              </div>
              <Badge status={a.status} />
              <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Abrir →</span>
            </div>
          );
        })}
        {applications.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-3)', fontSize: 13.5 }}>
            Nenhuma aplicação registrada ainda.
          </div>
        )}
      </div>
    </div>
  );
}
