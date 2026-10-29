
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  Breadcrumb,
  FormField,
  TextInput,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui';

export default function ClassEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    getClassById,
    updateClass,
    classesLoading,
    classesError,
  } = useData();

  const cls = getClassById(id);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [period, setPeriod] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cls) {
      setName(cls.name || '');
      setSubject(cls.subject || '');
      setPeriod(cls.period || '');
    }
  }, [cls?.id, cls?.name, cls?.subject, cls?.period]);

  if (classesLoading && !cls) {
  return <p>Carregando turma...</p>;
}

if (classesError && !cls) {
  return <p>{classesError}</p>;
}

if (!cls) {
  return <p>Turma não encontrada.</p>;
}

  if (cls.status === 'Arquivada') {
    return (
      <div>
        <p>Turmas arquivadas não podem ser editadas.</p>
        <SecondaryButton onClick={() => navigate(`/turmas/${cls.id}`)}>
          Voltar para a turma
        </SecondaryButton>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      setSaving(true);
      await updateClass(cls.id, { name, subject, period });
      navigate('/turmas', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível atualizar a turma.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Turmas', to: '/turmas' },
          { label: cls.name, to: `/turmas/${cls.id}` },
          { label: 'Editar turma' },
        ]}
      />

      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--ink)',
          marginBottom: 22,
        }}
      >
        Editar turma
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
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
            />
          </FormField>

          <FormField label="Disciplina">
            <TextInput
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              maxLength={80}
            />
          </FormField>

          <FormField label="Período / ano letivo">
            <TextInput
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
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </PrimaryButton>

            <SecondaryButton
              type="button"
              disabled={saving}
              onClick={() => navigate(`/turmas/${cls.id}`)}
            >
              Cancelar
            </SecondaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}