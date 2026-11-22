import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Breadcrumb, EmptyState, PageHeader, PrimaryButton, SecondaryButton, TextInput } from '../components/ui';
import { useApiGet } from '../services/useApiGet';
import { formatDate, formatPercent, formatScore, GRADING_TYPE_LABEL, scoreColor } from '../utils/grades';

const STATE_LABEL = { CORRIGIDA: 'Corrigida', PENDENTE: 'Pendente', SEM_FOLHA: 'Sem folha' };

const FILTERS = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'PENDENTE', label: 'Pendentes' },
  { key: 'CORRIGIDA', label: 'Corrigidas' },
  { key: 'SEM_FOLHA', label: 'Sem folha' },
];

const thStyle = { padding: '9px 8px', fontSize: 12, fontWeight: 600, color: 'var(--muted-3)', textAlign: 'left', whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px 8px', fontSize: 13.5, borderTop: '1px solid var(--border-light)' };

function normalize(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function Summary({ label, value, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
      <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--ink)' }}>{value}</div>
    </div>
  );
}

// Correção a partir da lista de alunos de uma aplicação (T90): o professor vê quem já foi
// corrigido, quem está pendente e quem ainda não tem folha, e abre cada prova daqui.
export default function GradingApplication() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, loading } = useApiGet(`/correcoes/aplicacoes/${id}`);
  const [filter, setFilter] = useState('TODOS');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const term = normalize(search.trim());
    return (data?.linhas ?? []).filter(
      (l) =>
        (filter === 'TODOS' || l.estado === filter) &&
        (!term || normalize(`${l.aluno?.nome ?? ''} ${l.rotulo} ${l.codigo ?? ''} ${l.aluno?.matricula ?? ''}`).includes(term))
    );
  }, [data, filter, search]);

  if (loading) return <EmptyState>Carregando a aplicação...</EmptyState>;
  if (error) {
    return (
      <div>
        <Breadcrumb items={[{ label: 'Correção', to: '/correcao' }, { label: 'Aplicação' }]} />
        <EmptyState>{error.message}</EmptyState>
      </div>
    );
  }

  const { aplicacao, resumo } = data;
  const openCopy = (code) => navigate(`/correcao?codigo=${code}`);
  const firstPending = data.linhas.find((l) => l.estado === 'PENDENTE');

  return (
    <div>
      <Breadcrumb items={[{ label: 'Correção', to: '/correcao' }, { label: `${aplicacao.prova.titulo} · ${aplicacao.turma.nome}` }]} />
      <PageHeader
        title={aplicacao.prova.titulo}
        description={`${aplicacao.turma.nome}${aplicacao.dataAplicacao ? ` · aplicada em ${formatDate(aplicacao.dataAplicacao)}` : ''} · nota máxima ${formatScore(aplicacao.notaMaxima)}`}
        actions={firstPending && <PrimaryButton onClick={() => openCopy(firstPending.codigo)}>Corrigir a próxima pendente</PrimaryButton>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Summary label="Corrigidas" value={`${resumo.corrigidas} de ${resumo.totalCopias}`} color="var(--green-text)" />
        <Summary label="Pendentes" value={resumo.pendentes} />
        <Summary label="Sem folha" value={resumo.semFolha} color={resumo.semFolha ? 'var(--amber-text)' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
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
        <div style={{ flex: '1 1 220px', maxWidth: 320, marginLeft: 'auto' }}>
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar aluno, matrícula ou código" aria-label="Buscar" />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState>{data.linhas.length === 0 ? 'Esta aplicação ainda não tem provas geradas nem alunos.' : 'Nenhum aluno com esse filtro.'}</EmptyState>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '8px 16px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Aluno</th>
                <th style={thStyle}>Código</th>
                <th style={thStyle}>Estado</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Nota</th>
                <th style={thStyle} />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.codigo ?? `aluno-${l.aluno.id}`}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{l.aluno?.nome ?? l.rotulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>
                      {l.aluno ? (l.aluno.matricula ? `Matrícula ${l.aluno.matricula}` : '') : 'Prova sem identificação'}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{l.codigo ?? '—'}</td>
                  <td style={tdStyle}>
                    <Badge status={STATE_LABEL[l.estado]} />
                    {l.correcao && <span style={{ fontSize: 12, color: 'var(--muted-3)', marginLeft: 8 }}>{GRADING_TYPE_LABEL[l.correcao.tipo]}</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: scoreColor(l.correcao?.percentual) }}>
                    {l.correcao ? `${formatScore(l.correcao.nota)} (${formatPercent(l.correcao.percentual)})` : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {l.codigo ? (
                      <SecondaryButton onClick={() => openCopy(l.codigo)} style={{ padding: '6px 12px', fontSize: 13 }}>
                        {l.estado === 'CORRIGIDA' ? 'Ver correção' : 'Corrigir'}
                      </SecondaryButton>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--muted-3)' }}>Use uma prova sem identificação</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
