import { normalizeTag, normalizeTags } from '../utils/tags';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { DangerButton, EmptyState, PageHeader, PrimaryButton, TextInput, Select } from '../components/ui';
import { BubbleIcon } from '../components/icons';
import { resolveAssetUrl } from '../services/api';

export default function QuestionsList() {
  const { questions, deleteQuestion } = useData();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const allTags = useMemo(() => {
    const set = new Set();
    questions.forEach((q) => normalizeTags(q.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [questions]);

  const filtered = questions.filter((q) => {
    const matchesSearch = q.excerpt.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !tag || normalizeTags(q.tags ?? []).includes(normalizeTag(tag));
    return matchesSearch && matchesTag;
  });

  const handleDelete = async (id) => {
    if (deleting !== null || !window.confirm('Excluir esta questão do banco? Provas e correções vinculadas serão preservadas.')) return;
    setError('');
    setDeleting(id);
    try { await deleteQuestion(id); }
    catch (err) { setError(err.message || 'Não foi possível excluir a questão.'); }
    finally { setDeleting(null); }
  };

  return (
    <div>
      <PageHeader
        title="Questões"
        description="Banco reutilizável de questões objetivas usado na montagem de provas."
        actions={<PrimaryButton onClick={() => navigate('/questoes/nova')}>+ Criar questão</PrimaryButton>}
      />
      {error && <p role="alert">{error}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <TextInput
          aria-label="Buscar questões por texto"
          placeholder="Buscar por texto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, maxWidth: 280, padding: '10px 13px' }}
        />
        <Select aria-label="Filtrar questões por tag" value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: 'auto', padding: '10px 13px' }}>
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
              flexWrap: 'wrap',
              gap: 16,
              alignItems: 'flex-start',
              padding: '18px 20px',
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 12,
            }}
          >
            {q.imageUrl ? (
              <img
                src={resolveAssetUrl(q.imageUrl)}
                alt=""
                style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-light)' }}
              />
            ) : (
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
            )}
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
                <span style={{ fontSize: 12.5, color: 'var(--muted-3)' }}>{normalizeTags(q.tags ?? []).join(', ')}</span>
                {q.imageUrl && <span style={{ fontSize: 12.5, color: 'var(--muted-3)' }}>· com imagem</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, marginLeft: 'auto' }}>
              <Link to={`/questoes/nova?editar=${q.id}`} style={{ fontWeight: 600 }}>
                Editar
              </Link>
              <DangerButton
                type="button"
                disabled={deleting !== null}
                onClick={() => handleDelete(q.id)}
              >
                {deleting === q.id ? 'Excluindo…' : 'Excluir'}
              </DangerButton>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <EmptyState>Nenhuma questão encontrada.</EmptyState>
        )}
      </div>
    </div>
  );
}
