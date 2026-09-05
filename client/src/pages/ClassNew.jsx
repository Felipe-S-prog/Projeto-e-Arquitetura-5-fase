import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, FormField, TextInput, PrimaryButton, SecondaryButton } from '../components/ui';

export default function ClassNew() {
  const { addClass } = useData();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [period, setPeriod] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    addClass({ name, subject, period });
    navigate('/turmas');
  };

  return (
    <div>
      <Breadcrumb items={[{ label: 'Turmas', to: '/turmas' }, { label: 'Criar turma' }]} />
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 22, letterSpacing: '-0.01em' }}>
        Criar turma
      </div>
      <form onSubmit={handleSubmit}>
        <div
          style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 30,
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <FormField label="Nome">
            <TextInput placeholder="ex: Cálculo I - Turma A" value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="Disciplina">
            <TextInput placeholder="ex: Matemática" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </FormField>
          <FormField label="Período / ano letivo">
            <TextInput placeholder="ex: 2026/2" value={period} onChange={(e) => setPeriod(e.target.value)} required />
          </FormField>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <PrimaryButton type="submit">Criar turma</PrimaryButton>
            <SecondaryButton type="button" onClick={() => navigate('/turmas')}>
              Cancelar
            </SecondaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}
