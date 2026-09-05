import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, FormField, TextInput, TextArea, PrimaryButton, SecondaryButton } from '../components/ui';

export default function ExamNew() {
  const { questions, addExam } = useData();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState({});

  const toggle = (id) => {
    setSelected((prev) => {
      const cur = prev[id] || { checked: false, score: 5 };
      return { ...prev, [id]: { ...cur, checked: !cur.checked } };
    });
  };

  const setScore = (id, score) => {
    setSelected((prev) => {
      const cur = prev[id] || { checked: true, score: 5 };
      return { ...prev, [id]: { ...cur, score } };
    });
  };

  const selectedEntries = Object.entries(selected).filter(([, v]) => v.checked);
  const selectedCount = selectedEntries.length;
  const totalScore = selectedEntries.reduce((sum, [, v]) => sum + (v.score || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    addExam({
      title,
      description,
      questions: selectedEntries.map(([id, v]) => ({ questionId: Number(id), score: v.score || 0 })),
    });
    navigate('/provas');
  };

  return (
    <div>
      <Breadcrumb items={[{ label: 'Provas', to: '/provas' }, { label: 'Criar prova' }]} />
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 22, letterSpacing: '-0.01em' }}>
        Criar prova
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 26 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <FormField label="Título">
                <TextInput
                  placeholder="ex: Prova 1 - Cálculo Diferencial"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Descrição">
                <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </FormField>
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 12 }}>
              Banco de questões — selecione até 20
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {questions.map((q) => {
                const sel = selected[q.id] || { checked: false, score: 5 };
                return (
                  <div
                    key={q.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      border: `1.5px solid ${sel.checked ? 'oklch(80% 0.06 250)' : 'var(--border)'}`,
                      borderRadius: 10,
                      background: sel.checked ? 'oklch(97% 0.02 250)' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel.checked}
                      onChange={() => toggle(q.id)}
                      style={{ width: 16, height: 16, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, fontSize: 14, color: 'oklch(25% 0.02 250)' }}>{q.excerpt}</div>
                    {sel.checked && (
                      <input
                        type="number"
                        placeholder="pts"
                        value={sel.score}
                        onChange={(e) => setScore(q.id, Number(e.target.value) || 0)}
                        style={{
                          width: 60,
                          padding: '6px 8px',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 6,
                          fontSize: 13,
                          fontFamily: 'inherit',
                          textAlign: 'center',
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 22, alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'oklch(35% 0.02 250)', marginBottom: 12 }}>Resumo</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>Questões selecionadas</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-strong)' }}>
                {selectedCount}
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted-3)' }}>/20</span>
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                paddingTop: 10,
                borderTop: '1px solid var(--border-light)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>Soma das pontuações</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)' }}>{totalScore}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>
              Informativo — o sistema não exige soma total fixa.
            </div>
            <PrimaryButton type="submit" style={{ width: '100%', marginTop: 20 }} disabled={selectedCount === 0}>
              Salvar prova
            </PrimaryButton>
            <SecondaryButton type="button" style={{ width: '100%', marginTop: 8 }} onClick={() => navigate('/provas')}>
              Cancelar
            </SecondaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}
