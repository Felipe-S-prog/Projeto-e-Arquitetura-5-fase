
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
    enrollStudent,
    classesLoading,
    classesError,
  } = useData();

  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [success, setSuccess] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  const cls = getClassById(id);

  if (classesLoading && !cls) {
    return <div>Carregando turma...</div>;
  }

  if (classesError && !cls) {
    return <div role="alert">{classesError}</div>;
  }

  if (!cls) {
    return <div>Turma n├úo encontrada.</div>;
  }

  const apps = classApplications(cls.id);
  const students = cls.students ?? [];
  const isArchived = cls.status === 'Arquivada';

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
      setError(err.message || 'N├úo foi poss├¡vel arquivar a turma.');
    } finally {
      setArchiving(false);
    }
  };

  const handleEnrollStudent = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!studentName.trim()) {
      setError('Informe o nome do aluno.');
      return;
    }

    if (!studentEmail.trim()) {
      setError('Informe o e-mail do aluno.');
      return;
    }

    try {
      setEnrolling(true);

      await enrollStudent(cls.id, {
        name: studentName,
        email: studentEmail,
      });

      setStudentName('');
      setStudentEmail('');
      setSuccess('Aluno matriculado com sucesso!');
    } catch (err) {
      setError(err.message || 'N├úo foi poss├¡vel matricular o aluno.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (
      !window.confirm(
        'Regenerar o c├│digo? O c├│digo anterior deixar├í de funcionar.',
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
        err.message || 'N├úo foi poss├¡vel regenerar o c├│digo de convite.',
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
        'N├úo foi poss├¡vel copiar automaticamente. Copie o link exibido manualmente.',
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
            {cls.subject} ┬À {cls.period}
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

      {success && (
        <div role="status" style={{ color: '#067647', marginBottom: 16, fontSize: 14 }}>
          {success}
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
          C├│digo de convite
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
            {cls.codigoConvite || 'N├úo dispon├¡vel'}
          </code>

          <SecondaryButton
            disabled={
              cls.status === 'Arquivada' ||
              regeneratingCode ||
              !regenerateInviteCode
            }
            onClick={handleRegenerateCode}
          >
            {regeneratingCode ? 'Regenerando...' : 'Regenerar c├│digo'}
          </SecondaryButton>
        </div>

        <p
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.5,
          }}
        >
          Compartilhe o c├│digo com os alunos. Ao regener├í-lo, o c├│digo
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

        <p
          style={{
            fontSize: 14,
            color: 'var(--muted)',
            margin: '0 0 20px',
          }}
        >
          Matricule um aluno informando seu nome e e-mail.
        </p>

        {isArchived ? (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            Esta turma est├í arquivada e n├úo aceita novas matr├¡culas.
          </p>
        ) : (
          <form
            onSubmit={handleEnrollStudent}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              maxWidth: 480,
              marginBottom: 24,
            }}
          >
            <div>
              <label
                htmlFor="student-name"
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                Nome do aluno
              </label>

              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                maxLength={120}
                placeholder="Digite o nome completo"
                required
                disabled={enrolling}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label
                htmlFor="student-email"
                style={{
                  display: 'block',
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                E-mail do aluno
              </label>

              <input
                id="student-email"
                type="email"
                value={studentEmail}
                onChange={(event) => setStudentEmail(event.target.value)}
                maxLength={160}
                placeholder="aluno@exemplo.com"
                required
                disabled={enrolling}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={enrolling}
                style={{
                  padding: '11px 16px',
                  border: 'none',
                  borderRadius: 8,
                  background: 'var(--primary, #344054)',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: enrolling ? 'wait' : 'pointer',
                  opacity: enrolling ? 0.7 : 1,
                }}
              >
                {enrolling ? 'Matriculando...' : 'Matricular aluno'}
              </button>
            </div>
          </form>
        )}

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
                    Matr├¡cula: {student.numeroMatricula}
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
        HIST├ôRICO DE APLICA├ç├òES NESTA TURMA
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
                  {exam?.title || 'Prova n├úo encontrada'}
                </div>

                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--muted-2)',
                    marginTop: 3,
                  }}
                >
                  {application.date || 'ÔÇö'} ┬À {application.quantity} provas
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
                Abrir ÔåÆ
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
