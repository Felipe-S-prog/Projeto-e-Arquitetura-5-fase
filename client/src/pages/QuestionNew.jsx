import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, FormField, TextArea, TextInput, PrimaryButton, SecondaryButton } from '../components/ui';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function QuestionNew() {
  const { addQuestion } = useData();
  const navigate = useNavigate();

  const [excerpt, setExcerpt] = useState('');
  const [tags, setTags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [alternatives, setAlternatives] = useState(['', '', '', '']);
  const [correctAlt, setCorrectAlt] = useState(0);

  const addAlternative = (e) => {
    e.preventDefault();
    setAlternatives((prev) => (prev.length < 5 ? [...prev, ''] : prev));
  };

  const removeAlternative = (e) => {
    e.preventDefault();
    setAlternatives((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.slice(0, -1);
      if (correctAlt >= next.length) setCorrectAlt(0);
      return next;
    });
  };

  const updateAlternative = (i, value) => {
    setAlternatives((prev) => prev.map((a, idx) => (idx === i ? value : a)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    addQuestion({
      excerpt,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      imageUrl: imageUrl.trim() || undefined,
      alternatives: alternatives.map((text, i) => ({ text, correct: i === correctAlt })),
    });
    navigate('/questoes');
  };

  return (
    <div>
      <Breadcrumb items={[{ label: 'Questões', to: '/questoes' }, { label: 'Criar questão' }]} />
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 22, letterSpacing: '-0.01em' }}>
        Criar questão
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 30, maxWidth: 640 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <FormField label="Enunciado">
              <TextArea
                rows={3}
                placeholder="Digite o enunciado (suporta Markdown básico)"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Tags">
              <TextInput
                placeholder="ex: Matemática, Álgebra"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </FormField>
            <FormField label="Imagem (opcional)" hint="Cole o link de uma imagem para ilustrar a questão (ex: um gráfico ou diagrama).">
              <TextInput
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Pré-visualização"
                  style={{ marginTop: 10, maxWidth: 220, borderRadius: 8, border: '1px solid var(--border-light)', display: 'block' }}
                />
              )}
            </FormField>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'oklch(35% 0.02 250)', marginBottom: 10 }}>
                Alternativas (marque a correta)
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {alternatives.map((text, i) => {
                  const checked = correctAlt === i;
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'oklch(98% 0.004 250)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 8,
                        padding: '6px 10px',
                      }}
                    >
                      <div
                        onClick={() => setCorrectAlt(i)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: `2px solid ${checked ? 'var(--navy)' : 'oklch(80% 0.012 250)'}`,
                          background: checked ? 'var(--navy)' : 'white',
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      />
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-3)', flexShrink: 0, width: 14 }}>
                        {LETTERS[i]}
                      </div>
                      <input
                        placeholder="Texto da alternativa"
                        value={text}
                        onChange={(e) => updateAlternative(i, e.target.value)}
                        required
                        style={{ flex: 1, padding: '8px 4px', border: 'none', background: 'transparent', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <a href="#" onClick={addAlternative} style={{ fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
                  + Adicionar alternativa
                </a>
                <a href="#" onClick={removeAlternative} style={{ fontSize: 13, textDecoration: 'none', color: 'var(--muted)' }}>
                  Remover última
                </a>
              </div>
              <div style={{ fontSize: 12, color: 'oklch(58% 0.02 250)', marginTop: 6 }}>Mínimo 2, máximo 5 alternativas.</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 30, paddingTop: 22, borderTop: '1px solid var(--border-light)' }}>
            <PrimaryButton type="submit">Salvar questão</PrimaryButton>
            <SecondaryButton type="button" onClick={() => navigate('/questoes')}>
              Cancelar
            </SecondaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}
