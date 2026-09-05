import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, Badge, SecondaryButton, DangerButton, EmptyState } from '../components/ui';

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getClassById, classApplications, getExamById, archiveClass } = useData();

  const cls = getClassById(id);
  if (!cls) return <div>Turma não encontrada.</div>;

  const apps = classApplications(cls.id);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Turmas', to: '/turmas' }, { label: cls.name }]} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{cls.name}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            {cls.subject} · {cls.period} <Badge status={cls.status} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <SecondaryButton onClick={(e) => e.preventDefault()}>Editar turma</SecondaryButton>
          <DangerButton
            onClick={() => {
              if (cls.status !== 'Arquivada' && window.confirm('Arquivar esta turma?')) archiveClass(cls.id);
            }}
          >
            Arquivar
          </DangerButton>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--faint)', marginBottom: 14 }}>
        HISTÓRICO DE APLICAÇÕES NESTA TURMA
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {apps.map((a) => {
          const exam = getExamById(a.examId);
          return (
            <div
              key={a.id}
              onClick={() => navigate(`/aplicacoes/${a.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                padding: '18px 20px',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 14,
                cursor: 'pointer',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>{exam?.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 3 }}>
                  {a.date || '—'} · {a.quantity} provas geradas
                </div>
              </div>
              <Badge status={a.status} />
              <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Abrir →</span>
            </div>
          );
        })}
        {apps.length === 0 && <EmptyState>Nenhuma prova aplicada nesta turma ainda.</EmptyState>}
      </div>
    </div>
  );
}
