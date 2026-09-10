import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, FormField, Select, PrimaryButton, SecondaryButton } from '../components/ui';

export default function ApplicationNew() {
  const { selectableExams, selectableClasses, createApplication } = useData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetExamId = searchParams.get('examId');

  const [examId, setExamId] = useState(presetExamId ? Number(presetExamId) : selectableExams[0]?.id ?? '');
  const [classId, setClassId] = useState(selectableClasses[0]?.id ?? '');
  const [quantity, setQuantity] = useState(30);

  const handleSubmit = (e) => {
    e.preventDefault();
    const id = createApplication({ examId: Number(examId), classId: Number(classId), quantity: Math.max(1, quantity) });
    navigate(`/aplicacoes/${id}`);
  };

  return (
    <div>
      <Breadcrumb items={[{ label: 'Aplicações', to: '/aplicacoes' }, { label: 'Criar aplicação' }]} />
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 22, letterSpacing: '-0.01em' }}>
        Criar aplicação
      </div>
      <form onSubmit={handleSubmit}>
        <div
          style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 30,
            maxWidth: 480,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <FormField label="Prova" hint="Provas arquivadas não aparecem nesta lista.">
            <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
              {selectableExams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Turma">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {selectableClasses.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Quantidade de pessoas"
            hint="Uma prova diferente (questões e alternativas embaralhadas) será gerada para cada pessoa."
          >
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              style={{
                width: 140,
                padding: '11px 13px',
                border: '1px solid var(--border-strong)',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'inherit',
                textAlign: 'center',
              }}
            />
          </FormField>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <PrimaryButton type="submit" disabled={!examId || !classId}>
              Criar aplicação
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => navigate('/aplicacoes')}>
              Cancelar
            </SecondaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}
