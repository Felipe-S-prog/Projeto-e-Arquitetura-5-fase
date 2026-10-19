import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  Breadcrumb,
  FormField,
  TextArea,
  TextInput,
  PrimaryButton,
  SecondaryButton,
} from '../components/ui';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export default function QuestionNew() {
  const { questions, addQuestion, updateQuestion } = useData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const editId = searchParams.get('editar');

  const editingQuestion = questions.find(
    (q) => String(q.id) === String(editId)
  );

  const [excerpt, setExcerpt] = useState('');
  const [tags, setTags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [alternatives, setAlternatives] = useState(['', '', '', '']);
  const [correctAlt, setCorrectAlt] = useState(0);

  // Preenche o formulário quando uma questão é selecionada para edição.
  useEffect(() => {
    if (!editId || !editingQuestion) return;

    setExcerpt(
      editingQuestion.excerpt || editingQuestion.enunciado || ''
    );

    const savedTags = editingQuestion.tags || [];

    setTags(
      Array.isArray(savedTags)
        ? savedTags.join(', ')
        : String(savedTags)
    );

    setImageUrl(
      editingQuestion.imageUrl ||
        editingQuestion.imagem_url ||
        ''
    );

    const savedAlternatives =
      editingQuestion.alternatives ||
      editingQuestion.alternativas ||
      [];

    if (savedAlternatives.length > 0) {
      setAlternatives(
        savedAlternatives.map((alternative) =>
          alternative.text ?? alternative.texto ?? ''
        )
      );

      const correctIndex = savedAlternatives.findIndex(
        (alternative) =>
          alternative.correct ?? alternative.correta
      );

      setCorrectAlt(correctIndex >= 0 ? correctIndex : 0);
    }
  }, [editId, editingQuestion]);

  const addAlternative = (e) => {
    e.preventDefault();

    setAlternatives((prev) =>
      prev.length < 5 ? [...prev, ''] : prev
    );
  };

  const removeAlternative = (e) => {
    e.preventDefault();

    setAlternatives((prev) => {
      if (prev.length <= 2) return prev;

      const next = prev.slice(0, -1);

      if (correctAlt >= next.length) {
        setCorrectAlt(0);
      }

      return next;
    });
  };

  const updateAlternative = (index, value) => {
    setAlternatives((prev) =>
      prev.map((alternative, i) =>
        i === index ? value : alternative
      )
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const question = {
      excerpt: excerpt.trim(),
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      imageUrl: imageUrl.trim() || undefined,
      alternatives: alternatives.map((text, index) => ({
        text: text.trim(),
        correct: index === correctAlt,
      })),
    };

    try {
      if (editId) {
        if (!editingQuestion) {
          throw new Error(
            'Questão não encontrada para edição.'
          );
        }

        await updateQuestion(editId, question);
      } else {
        await addQuestion(question);
      }

      navigate('/questoes');
    } catch (error) {
      alert(
        error.message ||
          'Não foi possível salvar a questão.'
      );
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Questões', to: '/questoes' },
          {
            label: editId
              ? 'Editar questão'
              : 'Criar questão',
          },
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
        {editId ? 'Editar questão' : 'Criar questão'}
      </div>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 30,
            maxWidth: 640,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
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

            <FormField
              label="Imagem (opcional)"
              hint="Cole o link de uma imagem para ilustrar a questão (ex: um gráfico ou diagrama)."
            >
              <TextInput
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />

              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Pré-visualização"
                  style={{
                    marginTop: 10,
                    maxWidth: 220,
                    borderRadius: 8,
                    border: '1px solid var(--border-light)',
                    display: 'block',
                  }}
                />
              )}
            </FormField>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'oklch(35% 0.02 250)',
                  marginBottom: 10,
                }}
              >
                Alternativas (marque a correta)
              </label>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                }}
              >
                {alternatives.map((text, index) => {
                  const checked = correctAlt === index;

                  return (
                    <div
                      key={index}
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
                      <input
                        type="radio"
                        name="correctAlternative"
                        aria-label={`Marcar alternativa ${LETTERS[index]} como correta`}
                        checked={checked}
                        onChange={() => setCorrectAlt(index)}
                        style={{
                          width: 16,
                          height: 16,
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      />

                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--muted-3)',
                          flexShrink: 0,
                          width: 14,
                        }}
                      >
                        {LETTERS[index]}
                      </div>

                      <input
                        placeholder="Texto da alternativa"
                        value={text}
                        onChange={(e) =>
                          updateAlternative(index, e.target.value)
                        }
                        required
                        style={{
                          flex: 1,
                          minWidth: 0,
                          padding: '8px 4px',
                          border: 'none',
                          background: 'transparent',
                          fontSize: 14,
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  marginTop: 10,
                }}
              >
                <a
                  href="#"
                  onClick={addAlternative}
                  style={{
                    fontSize: 13,
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  + Adicionar alternativa
                </a>

                <a
                  href="#"
                  onClick={removeAlternative}
                  style={{
                    fontSize: 13,
                    textDecoration: 'none',
                    color: 'var(--muted)',
                  }}
                >
                  Remover última
                </a>
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: 'oklch(58% 0.02 250)',
                  marginTop: 6,
                }}
              >
                Mínimo 2, máximo 5 alternativas.
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              marginTop: 30,
              paddingTop: 22,
              borderTop: '1px solid var(--border-light)',
            }}
          >
            <PrimaryButton type="submit">
              {editId
                ? 'Salvar alterações'
                : 'Salvar questão'}
            </PrimaryButton>

            <SecondaryButton
              type="button"
              onClick={() => navigate('/questoes')}
            >
              Cancelar
            </SecondaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}