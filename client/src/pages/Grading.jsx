import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import QrReader from '../components/QrReader';
import { Badge, Breadcrumb, FormField, PageHeader, PrimaryButton, SecondaryButton, Select, TextInput } from '../components/ui';
import { apiRequest } from '../services/api';
import { formatDate, formatPercent, formatScore, GRADING_TYPE_LABEL, scoreColor } from '../utils/grades';

const cardStyle = {
  background: 'white',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 26,
  marginBottom: 18,
};

const MODES = [
  { key: 'answers', label: 'Marcar respostas' },
  { key: 'manual', label: 'Lançar nota manual' },
];

function SectionTitle({ children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{children}</div>
      {hint && <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: 12, fontSize: 13.5, color: 'var(--red-text)' }}>{children}</div>;
}

function Pills({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{
              padding: '7px 14px',
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              background: active ? 'var(--navy)' : 'white',
              color: active ? 'white' : 'oklch(40% 0.02 250)',
              cursor: 'pointer',
              border: active ? '1px solid var(--navy)' : '1px solid var(--border)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Bolinha de alternativa, como na folha de respostas. Clicar de novo desmarca (questão em branco).
function Bubble({ letter, label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        border: `1.5px solid ${selected ? 'var(--navy)' : 'var(--border-strong)'}`,
        background: selected ? 'var(--navy)' : 'white',
        color: selected ? 'white' : 'oklch(35% 0.02 250)',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {letter}
    </button>
  );
}

// Respostas já gravadas -> estado do formulário (para corrigir novamente a partir delas).
function answersFromGrading(grading) {
  const answers = {};
  for (const r of grading?.respostas ?? []) {
    answers[r.questaoId] = r.tipo === 'OBJETIVA' ? r.letraMarcada : r.pontos === null ? '' : String(r.pontos);
  }
  return answers;
}

function CopyHeader({ copy }) {
  const items = [
    ['Prova', copy.prova.titulo],
    ['Turma', copy.turma.nome],
    ['Aplicada em', formatDate(copy.aplicacao.dataAplicacao)],
    ['Identificação', copy.copia.rotulo],
    ['Nota máxima', formatScore(copy.notaMaxima)],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
      {items.map(([label, value]) => (
        <div key={label}>
          <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function GradingResult({ grading, onRegrade, onDelete, onNext }) {
  const automatic = grading.tipo === 'AUTOMATICA';
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>Prova corrigida</div>
            <Badge status={GRADING_TYPE_LABEL[grading.tipo]} />
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted-2)' }}>
            {grading.aluno ? `Nota de ${grading.aluno.nome}.` : 'Nota sem aluno associado.'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: scoreColor(grading.percentual), lineHeight: 1 }}>
            {formatScore(grading.nota)}
            <span style={{ fontSize: 16, color: 'var(--muted-3)', fontWeight: 600 }}> / {formatScore(grading.notaMaxima)}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 4 }}>{formatPercent(grading.percentual)} da nota</div>
        </div>
      </div>

      {automatic && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, marginTop: 20 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--muted-3)', fontSize: 12 }}>
              <th style={{ padding: '8px 6px' }}>Questão</th>
              <th style={{ padding: '8px 6px' }}>Marcada</th>
              <th style={{ padding: '8px 6px' }}>Correta</th>
              <th style={{ padding: '8px 6px' }}>Resultado</th>
              <th style={{ padding: '8px 6px', textAlign: 'right' }}>Pontos</th>
            </tr>
          </thead>
          <tbody>
            {grading.respostas.map((r) => (
              <tr key={r.questaoId} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={{ padding: '9px 6px', fontWeight: 600 }}>{r.numero}</td>
                <td style={{ padding: '9px 6px' }}>{r.tipo === 'OBJETIVA' ? (r.letraMarcada ?? 'Em branco') : 'Discursiva'}</td>
                <td style={{ padding: '9px 6px' }}>{r.letraCorreta ?? '—'}</td>
                <td style={{ padding: '9px 6px', fontWeight: 600, color: r.correta === null ? 'var(--muted-2)' : r.correta ? 'var(--green-text)' : 'var(--red-text-strong)' }}>
                  {r.correta === null ? 'Avaliada' : r.correta ? 'Acertou' : 'Errou'}
                </td>
                <td style={{ padding: '9px 6px', textAlign: 'right' }}>
                  {formatScore(r.pontos)} / {formatScore(r.pontuacao)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 22, flexWrap: 'wrap' }}>
        <PrimaryButton onClick={onNext}>Corrigir outra prova</PrimaryButton>
        <SecondaryButton onClick={onRegrade}>Corrigir novamente</SecondaryButton>
        <Link to={`/relatorios?aplicacao=${grading.aplicacao.id}`} style={{ alignSelf: 'center', fontSize: 14, fontWeight: 600, marginLeft: 6 }}>
          Ver notas da aplicação →
        </Link>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onDelete}
          style={{ background: 'none', border: 'none', color: 'var(--red-text-strong)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
        >
          Excluir correção
        </button>
      </div>
    </div>
  );
}

// Tela de correção (T30 e T31): identifica a cópia pelo QR Code (ou código digitado),
// recebe o que o aluno marcou e calcula a nota pela pontuação de cada questão.
// Para provas sem identificação, permite associar a nota ao aluno certo ou lançá-la à mão.
export default function Grading() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [typedCode, setTypedCode] = useState('');
  const [copy, setCopy] = useState(null);
  const [lookupError, setLookupError] = useState('');
  const [loadingCode, setLoadingCode] = useState(null);

  const [mode, setMode] = useState('answers');
  const [answers, setAnswers] = useState({});
  const [studentId, setStudentId] = useState('');
  const [manualScore, setManualScore] = useState('');
  const [grading, setGrading] = useState(null);
  const [editing, setEditing] = useState(true);
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCopy = async (code) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setLoadingCode(normalized);
    setLookupError('');
    try {
      const data = await apiRequest(`/correcoes/copias/${encodeURIComponent(normalized)}`);
      setCopy(data);
      setGrading(data.correcao);
      setEditing(!data.correcao);
      setAnswers(answersFromGrading(data.correcao));
      setMode(data.correcao?.tipo === 'MANUAL' ? 'manual' : 'answers');
      setManualScore(data.correcao?.tipo === 'MANUAL' ? String(data.correcao.nota) : '');
      setStudentId(data.correcao?.aluno && !data.copia.aluno ? String(data.correcao.aluno.id) : '');
      setSubmitError('');
      setTypedCode('');
    } catch (error) {
      setCopy(null);
      setLookupError(error.status === 404 ? `Nenhuma prova sua tem o código ${normalized}.` : error.message);
    } finally {
      setLoadingCode(null);
    }
  };

  // Vindo do relatório ("Corrigir" em uma cópia): /correcao?codigo=XXXX abre a cópia direto.
  const codeFromUrl = searchParams.get('codigo');
  useEffect(() => {
    if (!codeFromUrl) return;
    loadCopy(codeFromUrl);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  const reset = () => {
    setCopy(null);
    setGrading(null);
    setAnswers({});
    setStudentId('');
    setManualScore('');
    setSubmitError('');
  };

  const setAnswer = (questionId, value) => setAnswers((prev) => ({ ...prev, [questionId]: value }));

  const submit = async (replace = false) => {
    setSaving(true);
    setSubmitError('');
    const base = { codigo: copy.copia.codigo, alunoId: studentId || undefined, substituir: replace || undefined };
    const request =
      mode === 'manual'
        ? apiRequest('/correcoes/manual', { method: 'POST', body: { ...base, nota: manualScore } })
        : apiRequest('/correcoes', {
            method: 'POST',
            body: {
              ...base,
              respostas: copy.questoes.map((q) =>
                q.tipo === 'OBJETIVA' ? { questaoId: q.questaoId, letra: answers[q.questaoId] ?? null } : { questaoId: q.questaoId, pontos: answers[q.questaoId] ?? '' }
              ),
            },
          });

    try {
      setGrading(await request);
      setEditing(false);
    } catch (error) {
      if (error.code === 'CONFLICT' && error.details?.correcaoId && !replace) {
        const previous = `${formatScore(error.details.nota)} (${GRADING_TYPE_LABEL[error.details.tipo].toLowerCase()})`;
        if (window.confirm(`Esta prova já foi corrigida com nota ${previous}. Substituir pela nova correção?`)) {
          await submit(true);
          return;
        }
      } else {
        setSubmitError(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteGrading = async () => {
    if (!window.confirm('Excluir esta correção? A nota sai dos relatórios e do histórico do aluno.')) return;
    try {
      await apiRequest(`/correcoes/${grading.id}`, { method: 'DELETE' });
      setGrading(null);
      setAnswers({});
      setManualScore('');
      setEditing(true);
    } catch (error) {
      setSubmitError(error.message);
    }
  };

  const objectiveQuestions = copy?.questoes.filter((q) => q.tipo === 'OBJETIVA') ?? [];
  const markedCount = objectiveQuestions.filter((q) => answers[q.questaoId]).length;
  const anonymous = copy && !copy.copia.aluno;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Correção' }]} />
      <PageHeader title="Correção" description="Leia o QR Code da prova (ou digite o código impresso nela) e informe o que o aluno marcou." />

      {!copy && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, alignItems: 'start' }}>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <SectionTitle hint="Use a foto da folha ou a câmera.">Ler QR Code</SectionTitle>
            <QrReader onCode={loadCopy} />
          </div>
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <SectionTitle hint="O código aparece ao lado do QR Code e no rodapé de cada página.">Digitar código</SectionTitle>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadCopy(typedCode);
              }}
              style={{ display: 'flex', gap: 10 }}
            >
              <TextInput
                value={typedCode}
                onChange={(e) => setTypedCode(e.target.value.toUpperCase())}
                placeholder="Ex.: K7M2QA"
                maxLength={12}
                aria-label="Código da prova"
                style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}
              />
              <PrimaryButton type="submit" disabled={!typedCode.trim() || Boolean(loadingCode)}>
                {loadingCode ? 'Buscando...' : 'Buscar'}
              </PrimaryButton>
            </form>
          </div>
          {lookupError && (
            <div style={{ gridColumn: '1 / -1' }}>
              <ErrorText>{lookupError}</ErrorText>
            </div>
          )}
          {loadingCode && <div style={{ gridColumn: '1 / -1', fontSize: 13.5, color: 'var(--muted-2)' }}>Buscando a prova {loadingCode}...</div>}
        </div>
      )}

      {copy && (
        <>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>Prova {copy.copia.codigo}</div>
                <Badge status={grading ? 'Corrigida' : 'Pendente'} />
              </div>
              <SecondaryButton onClick={reset} style={{ padding: '8px 14px', fontSize: 13 }}>
                Trocar prova
              </SecondaryButton>
            </div>
            <CopyHeader copy={copy} />
          </div>

          {grading && !editing && (
            <>
              <GradingResult
                grading={grading}
                onNext={reset}
                onDelete={deleteGrading}
                onRegrade={() => {
                  setAnswers(answersFromGrading(grading));
                  setSubmitError('');
                  setEditing(true);
                }}
              />
              {submitError && <ErrorText>{submitError}</ErrorText>}
            </>
          )}

          {editing && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <SectionTitle>{grading ? 'Corrigir novamente' : 'Corrigir prova'}</SectionTitle>
                <Pills options={MODES} value={mode} onChange={setMode} />
              </div>

              <div style={{ maxWidth: 420, marginBottom: 22 }}>
                {anonymous ? (
                  <FormField
                    label={mode === 'manual' ? 'Aluno *' : 'Aluno (opcional)'}
                    hint="Esta prova foi gerada sem identificação: escolha de quem é a folha para a nota entrar no histórico."
                  >
                    <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                      <option value="">Selecione o aluno</option>
                      {copy.alunos.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome}
                          {a.matricula ? ` (${a.matricula})` : ''}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                ) : (
                  <FormField label="Aluno">
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{copy.copia.aluno.nome}</div>
                  </FormField>
                )}
              </div>

              {mode === 'answers' ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {copy.questoes.map((q) => (
                      <div
                        key={q.questaoId}
                        style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 0', borderTop: '1px solid var(--border-light)', flexWrap: 'wrap' }}
                      >
                        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>
                            Questão {q.numero}{' '}
                            <span style={{ fontWeight: 500, color: 'var(--muted-3)', fontSize: 12.5 }}>
                              · {formatScore(q.pontuacao)} pt{q.pontuacao === 1 ? '' : 's'}
                              {q.tipo === 'DISCURSIVA' ? ' · discursiva' : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {q.enunciado}
                          </div>
                        </div>
                        {q.tipo === 'OBJETIVA' ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            {q.alternativas.map((a) => (
                              <Bubble
                                key={a.letra}
                                letter={a.letra}
                                label={`Questão ${q.numero}, alternativa ${a.letra}`}
                                selected={answers[q.questaoId] === a.letra}
                                onClick={() => setAnswer(q.questaoId, answers[q.questaoId] === a.letra ? null : a.letra)}
                              />
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <TextInput
                              type="number"
                              min={0}
                              max={q.pontuacao}
                              step={0.25}
                              value={answers[q.questaoId] ?? ''}
                              onChange={(e) => setAnswer(q.questaoId, e.target.value)}
                              aria-label={`Pontos da questão ${q.numero}`}
                              style={{ width: 96 }}
                            />
                            <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>de {formatScore(q.pontuacao)}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted-2)', margin: '6px 0 18px' }}>
                    {markedCount} de {objectiveQuestions.length} objetivas marcadas. Questões sem marcação contam como em branco (zero).
                  </div>
                </>
              ) : (
                <div style={{ maxWidth: 240, marginBottom: 22 }}>
                  <FormField label="Nota *" hint={`De 0 a ${formatScore(copy.notaMaxima)}, com até 2 casas decimais.`}>
                    <TextInput
                      type="number"
                      min={0}
                      max={copy.notaMaxima}
                      step={0.01}
                      value={manualScore}
                      onChange={(e) => setManualScore(e.target.value)}
                    />
                  </FormField>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <PrimaryButton onClick={() => submit()} disabled={saving || (mode === 'manual' && (manualScore === '' || (anonymous && !studentId)))}>
                  {saving ? 'Salvando...' : mode === 'manual' ? 'Lançar nota' : 'Corrigir prova'}
                </PrimaryButton>
                {grading && <SecondaryButton onClick={() => setEditing(false)}>Cancelar</SecondaryButton>}
              </div>
              {submitError && <ErrorText>{submitError}</ErrorText>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
