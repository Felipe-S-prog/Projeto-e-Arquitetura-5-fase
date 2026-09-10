import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, Badge, SecondaryButton, PrimaryButton } from '../components/ui';

export default function ExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getExamById, examQuestionsDetailed } = useData();

  const exam = getExamById(id);
  if (!exam) return <div>Prova não encontrada.</div>;

  const examQuestions = examQuestionsDetailed(exam.id);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Provas', to: '/provas' }, { label: exam.title }]} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{exam.title}</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge status={exam.status} /> {examQuestions.length} questões
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <SecondaryButton onClick={(e) => e.preventDefault()}>Editar</SecondaryButton>
          <PrimaryButton onClick={() => navigate(`/aplicacoes/nova?examId=${exam.id}`)}>Criar aplicação</PrimaryButton>
        </div>
      </div>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>
          Questões da prova
        </div>
        {examQuestions.map((q, i) => (
          <div
            key={q.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-lighter)',
              fontSize: 14,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--neutral-bg)',
                color: 'oklch(45% 0.02 250)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>{q.excerpt}</div>
            <div style={{ color: 'oklch(45% 0.02 250)', fontWeight: 700, fontSize: 13 }}>{q.score} pts</div>
          </div>
        ))}
        {examQuestions.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-3)', fontSize: 13.5 }}>
            Nenhuma questão adicionada a esta prova.
          </div>
        )}
      </div>
    </div>
  );
}
