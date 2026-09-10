import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { PageHeader, PrimaryButton, Badge } from '../components/ui';

export default function ClassesList() {
  const { classes, applications } = useData();
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Turmas"
        description="Contexto usado para organizar provas e aplicações. Turmas arquivadas preservam o histórico."
        actions={<PrimaryButton onClick={() => navigate('/turmas/nova')}>+ Criar turma</PrimaryButton>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {classes.map((c) => {
          const appCount = applications.filter((a) => a.classId === c.id).length;
          return (
            <div
              key={c.id}
              onClick={() => navigate(`/turmas/${c.id}`)}
              style={{
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 20,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.3 }}>{c.name}</div>
                <Badge status={c.status} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {c.subject} · {c.period}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-light)',
                }}
              >
                <div style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>{appCount} aplicações</div>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Abrir →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
