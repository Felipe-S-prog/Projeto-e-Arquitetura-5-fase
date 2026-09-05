import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { PageHeader, PrimaryButton, Badge } from '../components/ui';
import { ExamSheetIcon } from '../components/icons';

const FILTERS = ['Todas', 'Rascunho', 'Pronta', 'Arquivada'];

export default function ExamsList() {
  const { exams } = useData();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('Todas');

  const filtered = filter === 'Todas' ? exams : exams.filter((e) => e.status === filter);

  return (
    <div>
      <PageHeader
        title="Provas"
        description="Modelos reutilizáveis de prova. Aplicar em uma turma acontece em Aplicações."
        actions={<PrimaryButton onClick={() => navigate('/provas/nova')}>+ Criar prova</PrimaryButton>}
      />
      <div style={{ marginBottom: 18, display: 'flex', gap: 8 }}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <div
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px',
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 600,
                background: active ? 'var(--navy)' : 'white',
                color: active ? 'white' : 'oklch(40% 0.02 250)',
                cursor: 'pointer',
                border: active ? 'none' : '1px solid var(--border)',
              }}
            >
              {f}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {filtered.map((e) => {
          const questionsCount = e.questions.length;
          const dots = Array.from({ length: Math.min(5, questionsCount) });
          return (
            <div
              key={e.id}
              onClick={() => navigate(`/provas/${e.id}`)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ color: 'var(--navy)' }}>
                    <ExamSheetIcon width={16} height={18} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)', lineHeight: 1.3 }}>{e.title}</div>
                </div>
                <Badge status={e.status} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {dots.map((_, i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', border: '1.4px solid var(--navy)' }} />
                ))}
                <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginLeft: 4 }}>{questionsCount} questões</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Abrir →</span>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-3)', fontSize: 13.5 }}>
            Nenhuma prova neste filtro.
          </div>
        )}
      </div>
    </div>
  );
}
