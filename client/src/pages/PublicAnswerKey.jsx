import { useState } from 'react';
import { LogoMark } from '../components/icons';
import { TextInput, PrimaryButton } from '../components/ui';
import { useData } from '../context/DataContext';
import { resolveAnswerKey } from '../utils/answerKey';

export default function PublicAnswerKey() {
  const { findCopyByCode, getExamById, examQuestionsDetailed } = useData();
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const found = findCopyByCode(code);
    if (!found) {
      setResult({ status: 'not-found' });
      return;
    }
    const { application, copy } = found;
    if (!copy.answerKeyPublished) {
      setResult({ status: 'not-published' });
      return;
    }
    const exam = getExamById(application.examId);
    const examQuestions = examQuestionsDetailed(application.examId);
    setResult({ status: 'ok', examTitle: exam?.title, answers: resolveAnswerKey(copy, examQuestions) });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 44,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ margin: '0 auto 18px', width: 44 }}>
            <LogoMark />
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Consulta de gabarito
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            Digite o código impresso na sua prova para ver as respostas certas.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TextInput
            placeholder="ex: K3F7Q2"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ textAlign: 'center', fontSize: 18, fontWeight: 700, letterSpacing: '0.08em' }}
            required
          />
          <PrimaryButton type="submit">Consultar gabarito</PrimaryButton>
        </form>

        {result?.status === 'not-found' && (
          <div style={{ marginTop: 20, fontSize: 13.5, color: 'var(--red-text)', textAlign: 'center' }}>
            Não encontramos nenhuma prova com esse código. Confira com o professor.
          </div>
        )}
        {result?.status === 'not-published' && (
          <div style={{ marginTop: 20, fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>
            O gabarito desta prova ainda não foi publicado pelo professor.
          </div>
        )}
        {result?.status === 'ok' && (
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 12 }}>
              {result.examTitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {result.answers.map((a) => (
                <div
                  key={a.number}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '9px 0',
                    borderBottom: '1px solid var(--border-light)',
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: 'var(--muted-2)' }}>Questão {a.number}</span>
                  <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{a.correctLetter}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
