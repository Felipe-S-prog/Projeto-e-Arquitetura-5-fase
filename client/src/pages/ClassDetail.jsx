
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
    deleteClass,
    removeStudent,
    importStudents,
    enrollStudent,
    classesLoading,
    classesError,
  } = useData();

  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
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
    return <div>Turma não encontrada.</div>;
  }

  const apps = classApplications(cls.id);
  const students = cls.students ?? [];
  const isArchived = cls.status === 'Arquivada';

  const handleDelete = async () => {
    if (!window.confirm('Excluir esta turma? Matrículas serão removidas, mas os cadastros dos alunos serão mantidos. Se houver aplicações vinculadas, a turma será arquivada para preservar cópias e notas.')) return;
    setError('');
    setDeleting(true);
    try {
      const result = await deleteClass(cls.id);
      if (result.archived) setSuccess(result.message);
      else navigate('/turmas');
    } catch (err) {
      setError(err.message || 'Não foi possível excluir a turma.');
    } finally { setDeleting(false); }
  };

  const handleArchive = async () => {
    if (
      cls.status === 'Arquivada' ||
      !window.confirm('Arquivar esta turma? Alunos, aplicações e notas serão preservados. Você continuará podendo editar os dados da turma.')
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
      setError(err.message || 'Não foi possível matricular o aluno.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemoveStudent = async (student) => {
    if (!window.confirm(`Remover ${student.name} desta turma? Cadastro, cópias e notas serão preservados.`)) return;
    setError(''); setSuccess(''); setRemovingId(student.id);
    try { const result = await removeStudent(cls.id, student.id); setSuccess(result.message); }
    catch (err) { setError(err.message); }
    finally { setRemovingId(null); }
  };
  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setImportResult(null);
    if (!/\.csv$/i.test(file.name) || file.size > 500000) { setError('Selecione um CSV UTF-8 de até 500 KB.'); return; }
    setImporting(true);
    try { setImportResult(await importStudents(cls.id, await file.text())); }
    catch (err) { setError(err.message); }
    finally { setImporting(false); }
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
              overflowWrap: 'anywhere',
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
          <DangerButton disabled={deleting || archiving} onClick={handleDelete}>
            {deleting ? 'Excluindo...' : 'Excluir turma'}
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

        {!isArchived && <div style={{ marginBottom: 24 }}>
          <label htmlFor="students-csv">Importar alunos por CSV</label>
          <p>Exporte do Excel como CSV UTF-8. Colunas: nome, email e matrícula (opcional). Até 500 alunos. O aluno não precisa acessar o sistema.</p>
          <input id="students-csv" type="file" accept=".csv,text/csv" disabled={importing || enrolling || removingId !== null} onChange={handleImport} />
          {importing && <p role="status">Importando alunos...</p>}
        </div>}
        {importResult && <div role="status">
          <p>{importResult.imported.length} importados; {importResult.rejected.length} recusados de {importResult.total} linhas.</p>
          {importResult.rejected.length > 0 && <ul>{importResult.rejected.map((item) => <li key={item.line}>Linha {item.line}: {item.message}</li>)}</ul>}
        </div>}
        {isArchived ? (
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            Esta turma está arquivada e não aceita novas matrículas.
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
                <div style={{ fontWeight: 700, color: 'var(--ink)', overflowWrap: 'anywhere' }}>
                  {student.name}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: 'var(--muted)',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {student.email}
                </div>

                {!isArchived && <DangerButton disabled={removingId !== null || importing || enrolling} onClick={() => handleRemoveStudent(student)}>
                  {removingId === student.id ? 'Removendo...' : 'Remover aluno'}
                </DangerButton>}
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
                flexWrap: 'wrap',
                padding: '18px 20px',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 14,
                cursor: 'pointer',
              }}
            >
              <div style={{ flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}>
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
