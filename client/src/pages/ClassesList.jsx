
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  PageHeader,
  PrimaryButton,
  Badge,
  EmptyState,
} from '../components/ui';

export default function ClassesList() {
  const {
    classes,
    applications,
    classesLoading,
    classesError,
  } = useData();

  const navigate = useNavigate();

  return (
    <div>
      <PageHeader
        title="Turmas"
        description="Gerencie suas turmas. As turmas arquivadas preservam seu histórico."
        actions={
          <PrimaryButton onClick={() => navigate('/turmas/nova')}>
            + Criar turma
          </PrimaryButton>
        }
      />

      {classesLoading && <p>Carregando turmas...</p>}

      {classesError && (
        <div
          role="alert"
          style={{ color: '#b42318', marginBottom: 16, fontSize: 14 }}
        >
          Não foi possível carregar as turmas: {classesError}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginLeft: 8 }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!classesLoading && !classesError && classes.length === 0 && (
        <EmptyState>
          Nenhuma turma cadastrada. Clique em “Criar turma” para começar.
        </EmptyState>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {classes.map((cls) => {
          const appCount = applications.filter(
            (application) => application.classId === cls.id,
          ).length;

          return (
            <div
              key={cls.id}
              onClick={() => navigate(`/turmas/${cls.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  navigate(`/turmas/${cls.id}`);
                }
              }}
              role="button"
              tabIndex={0}
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--text-strong)',
                    lineHeight: 1.3,
                  }}
                >
                  {cls.name}
                </div>

                <Badge status={cls.status} />
              </div>

              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {cls.subject} · {cls.period}
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
                <div style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>
                  {appCount} aplicações
                </div>

                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  Abrir →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}