
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
    regenerateInviteCode,
    classesLoading,
    classesError,
  } = useData();

  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);

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
  const students = cls.students ?? [];

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

  const handleRegenerateCode = async () => {
    if (
      !window.confirm(
        'Regenerar o código? O código anterior deixará de funcionar.',
      )
    ) {
      return;
    }

    setError('');

    try {
      setRegeneratingCode(true);
      await regenerateInviteCode(cls.id);
    } catch (err) {
      setError(
        err.message || 'Não foi possível regenerar o código de convite.',
      );
    } finally {
      setRegeneratingCode(false);
    }
  };

  const joinUrl = `${window.location.origin}/turmas/ingresso`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setError('');
      window.alert('Link de ingresso copiado!');
    } catch {
      setError(
        'Não foi possível copiar automaticamente. Copie o link exibido manualmente.',
      );
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
          style={{
            color: '#b42318',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <section
        aria-labelledby="invite-title"
        style={{
          padding: 20,
          marginBottom: 28,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 14,
        }}
      >
        <h2
          id="invite-title"
          style={{
            fontSize: 17,
            fontWeight: 800,
            marginTop: 0,
            marginBottom: 12,
          }}
        >
          Código de convite
        </h2>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <code
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: 'var(--ink)',
            }}
          >
            {cls.codigoConvite || 'Não disponível'}
          </code>

          <SecondaryButton
            disabled={
              cls.status === 'Arquivada' ||
              regeneratingCode ||
              !regenerateInviteCode
            }
            onClick={handleRegenerateCode}
          >
            {regeneratingCode ? 'Regenerando...' : 'Regenerar código'}
          </SecondaryButton>
        </div>

        <p
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}
        >
          Compartilhe o código com os alunos. Ao regenerá-lo, o código
          anterior deixa de funcionar.
        </p>

        <div style={{ marginTop: 18 }}>
          <label
            htmlFor="invite-link"
            style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Link para o aluno entrar na turma
          </label>

          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <input
              id="invite-link"
              readOnly
              value={joinUrl}
              onFocus={(event) => event.target.select()}
              style={{
                flex: '1 1 260px',
                minWidth: 0,
                padding: 10,
                border: '1px solid var(--border)',
                borderRadius: 8,
                font: 'inherit',
              }}
            />

            <SecondaryButton onClick={handleCopyLink}>
              Copiar link
            </SecondaryButton>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="students-title"
        style={{
          padding: 20,
          marginBottom: 28,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 14,
        }}
      >
        <h2
          id="students-title"
          style={{
            fontSize: 17,
            fontWeight: 800,
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          Alunos matriculados ({students.length})
        </h2>

        {students.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {students.map((student) => (
              <div
                key={student.id}
                style={{
                  padding: 14,
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                  {student.name}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: 'var(--muted)',
                  }}
                >
                  {student.email}
                </div>

                {student.numeroMatricula && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: 'var(--muted)',
                    }}
                  >
                    Matrícula: {student.numeroMatricula}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Nenhum aluno matriculado nesta turma ainda.
          </p>
        )}
      </section>

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
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/aplicacoes/${application.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/aplicacoes/${application.id}`);
                }
              }}
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
                  {' '}geradas
                </div>
              </div>

              <Badge status={application.status} />

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
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