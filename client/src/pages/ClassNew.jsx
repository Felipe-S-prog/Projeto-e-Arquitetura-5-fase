
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  Breadcrumb,
  FormField,
  TextInput,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui';

export default function ClassNew() {
  const { addClass } = useData();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [period, setPeriod] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      setSaving(true);
      await addClass({ name, subject, period });
      navigate('/turmas');
    } catch (err) {
      setError(err.message || 'Não foi possível cadastrar a turma.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Turmas', to: '/turmas' },
          { label: 'Criar turma' },
        ]}
      />

      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--ink)',
          marginBottom: 22,
          letterSpacing: '-0.01em',
        }}
      >
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
            <TextInput
              placeholder="Ex.: Cálculo I - Turma A"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
            />
          </FormField>

          <FormField label="Disciplina">
            <TextInput
              placeholder="Ex.: Matemática"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              maxLength={80}
            />
          </FormField>

          <FormField label="Período / ano letivo">
            <TextInput
              placeholder="Ex.: 2026/2"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              required
              maxLength={10}
            />
          </FormField>

          {error && (
            <div role="alert" style={{ color: '#b42318', fontSize: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar turma'}
            </PrimaryButton>

            <SecondaryButton
              type="button"
              onClick={() => navigate('/turmas')}
              disabled={saving}
            >
              Cancelar
            </SecondaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}