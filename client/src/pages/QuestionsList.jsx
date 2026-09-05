import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { PageHeader, PrimaryButton, TextInput, Select } from '../components/ui';
import { BubbleIcon } from '../components/icons';

export default function QuestionsList() {
  const { questions, deleteQuestion } = useData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');

  const allTags = useMemo(() => {
    const set = new Set();
    questions.forEach((q) => q.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [questions]);

  const filtered = questions.filter((q) => {
    const matchesSearch = q.excerpt.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !tag || q.tags.includes(tag);
    return matchesSearch && matchesTag;
  });

  const handleDelete = (id) => {
    if (window.confirm('Excluir esta questão do banco?')) deleteQuestion(id);
  };

  return (
    <div>
      <PageHeader
        title="Questões"
        description="Banco reutilizável de questões objetivas usado na montagem de provas."
        actions={<PrimaryButton onClick={() => navigate('/questoes/nova')}>+ Criar questão</PrimaryButton>}
      />
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <TextInput
          placeholder="Buscar por texto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 280, padding: '10px 13px' }}
        />
        <Select value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: 'auto', padding: '10px 13px' }}>
          <option value="">Tags: todas</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((q) => (
          <div
            key={q.id}
            style={{
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
              padding: '18px 20px',
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'var(--icon-tile-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--navy)',
              }}
            >
              <BubbleIcon size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, color: 'oklch(22% 0.02 250)', lineHeight: 1.5 }}>{q.excerpt}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 100,
                    background: 'var(--navy-chip-bg)',
                    color: 'var(--navy)',
                  }}
                >
                  Objetiva
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--muted-3)' }}>{q.tags.join(', ')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 13, paddingTop: 4, flexShrink: 0 }}>
              <a href="#" style={{ textDecoration: 'none', fontWeight: 600 }} onClick={(e) => e.preventDefault()}>
                Editar
              </a>
              <a
                href="#"
                style={{ textDecoration: 'none', fontWeight: 600, color: 'var(--red-text)' }}
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(q.id);
                }}
              >
                Excluir
              </a>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-3)', fontSize: 13.5 }}>
            Nenhuma questão encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
