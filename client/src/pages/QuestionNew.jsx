
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
import { apiUpload, resolveAssetUrl } from '../services/api';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export default function QuestionNew() {
  const { questions, addQuestion, updateQuestion } = useData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const editId = searchParams.get('editar');

  const editingQuestion = questions.find(
    (q) => String(q.id) === String(editId),
  );

  const [excerpt, setExcerpt] = useState('');
  const [tags, setTags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [alternatives, setAlternatives] = useState(['', '', '', '']);
  const [correctAlt, setCorrectAlt] = useState(0);

  // Cria uma pré-visualização temporária do arquivo selecionado.
  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  // Preenche o formulário ao editar uma questão existente.
  useEffect(() => {
    if (!editId || !editingQuestion) return;

    setExcerpt(
      editingQuestion.excerpt || editingQuestion.enunciado || '',
    );

    const savedTags = editingQuestion.tags || [];

    setTags(
      Array.isArray(savedTags)
        ? savedTags.join(', ')
        : String(savedTags),
    );

    setImageUrl(
      editingQuestion.imageUrl ||
        editingQuestion.imagem_url ||
        '',
    );

    setImageFile(null);

    const savedAlternatives =
      editingQuestion.alternatives ||
      editingQuestion.alternativas ||
      [];

    if (savedAlternatives.length > 0) {
      setAlternatives(
        savedAlternatives.map(
          (alternative) =>
            alternative.text ?? alternative.texto ?? '',
        ),
      );

      const correctIndex = savedAlternatives.findIndex(
        (alternative) =>
          alternative.correct ?? alternative.correta,
      );

      setCorrectAlt(correctIndex >= 0 ? correctIndex : 0);
    }
  }, [editId, editingQuestion]);

  const addAlternative = (event) => {
    event.preventDefault();

    setAlternatives((previous) =>
      previous.length < 5 ? [...previous, ''] : previous,
    );
  };

  const removeAlternative = (event) => {
    event.preventDefault();

    setAlternatives((previous) => {
      if (previous.length <= 2) return previous;

      const next = previous.slice(0, -1);

      if (correctAlt >= next.length) {
        setCorrectAlt(0);
      }

      return next;
    });
  };

  const updateAlternative = (index, value) => {
    setAlternatives((previous) =>
      previous.map((alternative, i) =>
        i === index ? value : alternative,
      ),
    );
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      alert('Formato inválido. Escolha uma imagem JPG, PNG, WEBP ou GIF.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      alert('A imagem deve ter no máximo 5 MB.');
      event.target.value = '';
      return;
    }

    setImageFile(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    if (alternatives.length < 2 || alternatives.length > 5) {
      alert('A questão deve ter entre 2 e 5 alternativas.');
      return;
    }

    if (alternatives.some((alternative) => !alternative.trim())) {
      alert('Preencha todas as alternativas.');
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl = imageUrl.trim() || undefined;

      // Envia o arquivo antes de salvar a questão.
      if (imageFile) {
        const formData = new FormData();
        formData.append('imagem', imageFile);

        const uploaded = await apiUpload(
          '/questoes/upload-imagem',
          formData,
        );

        if (!uploaded?.imageUrl) {
          throw new Error('A API não retornou o endereço da imagem.');
        }

        finalImageUrl = uploaded.imageUrl;
      }

      const question = {
        excerpt: excerpt.trim(),
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        imageUrl: finalImageUrl,
        alternatives: alternatives.map((text, index) => ({
          text: text.trim(),
          correct: index === correctAlt,
        })),
      };

      if (editId) {
        if (!editingQuestion) {
          throw new Error('Questão não encontrada para edição.');
        }

        await updateQuestion(editId, question);
      } else {
        await addQuestion(question);
      }

      navigate('/questoes');
    } catch (error) {
      alert(
        error.message || 'Não foi possível salvar a questão.',
      );
    } finally {
      setSaving(false);
    }
  };

  const displayedImage = imagePreviewUrl || imageUrl;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Questões', to: '/questoes' },
          {
            label: editId ? 'Editar questão' : 'Criar questão',
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
                placeholder="Digite o enunciado da questão"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                required
              />
            </FormField>

            <FormField label="Tags">
              <TextInput
                placeholder="Ex.: Matemática, Álgebra"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </FormField>

            <FormField
              label="Imagem (opcional)"
              hint="Escolha uma imagem do computador ou informe uma URL. Formatos aceitos: JPG, PNG, WEBP e GIF; limite de 5 MB."
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ink)',
                  }}
                >
                  Selecionar arquivo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageChange}
                    style={{
                      display: 'block',
                      marginTop: 8,
                      width: '100%',
                      fontSize: 13,
                    }}
                  />
                </label>

                {imageFile && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontSize: 12,
                      color: 'var(--muted)',
                    }}
                  >
                    <span>
                      {imageFile.name} (
                      {(imageFile.size / 1024).toFixed(0)} KB)
                    </span>

                    <button
                      type="button"
                      onClick={() => setImageFile(null)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Remover arquivo
                    </button>
                  </div>
                )}

                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  — ou informe uma URL —
                </div>

                <TextInput
                  placeholder="https://exemplo.com/imagem.png"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                />

                {displayedImage && (
                  <img
                    src={
                      imagePreviewUrl ||
                      resolveAssetUrl(displayedImage)
                    }
                    alt="Pré-visualização da imagem da questão"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                    onLoad={(event) => {
                      event.currentTarget.style.display = 'block';
                    }}
                    style={{
                      marginTop: 4,
                      maxWidth: '100%',
                      maxHeight: 260,
                      objectFit: 'contain',
                      borderRadius: 8,
                      border: '1px solid var(--border-light)',
                      display: 'block',
                    }}
                  />
                )}
              </div>
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
                        {['A', 'B', 'C', 'D', 'E'][index]}
                      </div>

                      <input
                        placeholder="Texto da alternativa"
                        value={text}
                        onChange={(event) =>
                          updateAlternative(index, event.target.value)
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
                eta  Remover última
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
            <PrimaryButton type="submit" disabled={saving}>
              {saving
                ? 'Salvando...'
                : editId
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