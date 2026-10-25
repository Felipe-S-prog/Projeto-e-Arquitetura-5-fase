
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  Breadcrumb,
  Badge,
  SecondaryButton,
  DangerButton,
  EmptyState,
} from '../components/ui';

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    getClassById,
    classApplications,
    getExamById,
    archiveClass,
    classesLoading,
    classesError,
  } = useData();

  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);

  const cls = getClassById(id);

  if (classesLoading && !cls) {
    return <div>Carregando turma...</div>;
  }

  if (classesError && !cls) {
    return <div role="alert">{classesError}</div>;
  }

  if (!cls) {
    return <div>Turma não encontrada.</div>;
  }

  const apps = classApplications(cls.id);

  const handleArchive = async () => {
    if (
      cls.status === 'Arquivada' ||
      !window.confirm('Arquivar esta turma?')
    ) {
      return;
    }

    setError('');

    try {
      setArchiving(true);
      await archiveClass(cls.id);
    } catch (err) {
      setError(err.message || 'Não foi possível arquivar a turma.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Turmas', to: '/turmas' },
          { label: cls.name },
        ]}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 26,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
            }}
          >
            {cls.name}
          </div>

          <div
            style={{
              fontSize: 14,
              color: 'var(--muted)',
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {cls.subject} · {cls.period}
            <Badge status={cls.status} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <SecondaryButton
            disabled={cls.status === 'Arquivada'}
            onClick={() => navigate(`/turmas/${cls.id}/editar`)}
          >
            Editar turma
          </SecondaryButton>

          <DangerButton
            disabled={cls.status === 'Arquivada' || archiving}
            onClick={handleArchive}
          >
            {archiving ? 'Arquivando...' : 'Arquivar'}
          </DangerButton>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{ color: '#b42318', marginBottom: 16, fontSize: 14 }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: 'var(--faint)',
          marginBottom: 14,
        }}
      >
        HISTÓRICO DE APLICAÇÕES NESTA TURMA
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {apps.map((application) => {
          const exam = getExamById(application.examId);

          return (
            <div
              key={application.id}
              onClick={() => navigate(`/aplicacoes/${application.id}`)}
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
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text-strong)',
                  }}
                >
                  {exam?.title || 'Prova não encontrada'}
                </div>

                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--muted-2)',
                    marginTop: 3,
                  }}
                >
                  {application.date || '—'} · {application.quantity} provas
                  geradas
                </div>
              </div>

              <Badge status={application.status} />

              <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                Abrir →
              </span>
            </div>
          );
        })}

        {apps.length === 0 && (
          <EmptyState>
            Nenhuma prova aplicada nesta turma ainda.
          </EmptyState>
        )}
      </div>
    </div>
  );
}