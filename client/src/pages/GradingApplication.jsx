import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Breadcrumb,
  DataTable,
  EmptyState,
  PageHeader,
  PrimaryButton,
  RowLink,
  SegmentedControl,
  StatCard,
  StatGrid,
  Td,
  TextInput,
  Th,
} from '../components/ui';
import { useApiGet } from '../services/useApiGet';
import { formatDate, formatPercent, formatScore, GRADING_TYPE_LABEL, scoreColor } from '../utils/grades';

const STATE_LABEL = { CORRIGIDA: 'Corrigida', PENDENTE: 'Pendente', SEM_FOLHA: 'Sem folha' };

const FILTERS = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'PENDENTE', label: 'Pendentes' },
  { key: 'CORRIGIDA', label: 'Corrigidas' },
  { key: 'SEM_FOLHA', label: 'Sem folha' },
];

function normalize(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
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
  const copyPath = (code) => `/correcao?codigo=${code}`;
  const firstPending = data.linhas.find((l) => l.estado === 'PENDENTE');

  return (
    <div>
      <Breadcrumb items={[{ label: 'Correção', to: '/correcao' }, { label: `${aplicacao.prova.titulo} · ${aplicacao.turma.nome}` }]} />
      <PageHeader
        title={aplicacao.prova.titulo}
        description={`${aplicacao.turma.nome}${aplicacao.dataAplicacao ? ` · aplicada em ${formatDate(aplicacao.dataAplicacao)}` : ''} · nota máxima ${formatScore(aplicacao.notaMaxima)}`}
        actions={
          <>
            <Link to={`/relatorios?aplicacao=${aplicacao.id}`} style={{ alignSelf: 'center', fontSize: 14, fontWeight: 600 }}>
              Ver relatório
            </Link>
            {firstPending && <PrimaryButton onClick={() => navigate(copyPath(firstPending.codigo))}>Corrigir a próxima pendente</PrimaryButton>}
          </>
        }
      />

      <StatGrid>
        <StatCard label="Corrigidas" value={`${resumo.corrigidas} de ${resumo.totalCopias}`} color="var(--green-text)" />
        <StatCard label="Pendentes" value={resumo.pendentes} />
        <StatCard label="Sem folha" value={resumo.semFolha} color={resumo.semFolha ? 'var(--amber-text)' : undefined} />
      </StatGrid>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <SegmentedControl label="Filtrar por estado" options={FILTERS} value={filter} onChange={setFilter} />
        <div style={{ flex: '1 1 220px', maxWidth: 320, marginLeft: 'auto' }}>
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar aluno, matrícula ou código" aria-label="Buscar aluno, matrícula ou código" type="search" />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState>{data.linhas.length === 0 ? 'Esta aplicação ainda não tem provas geradas nem alunos.' : 'Nenhum aluno com esse filtro.'}</EmptyState>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '8px 16px' }}>
          <DataTable label="Alunos da aplicação">
            <thead>
              <tr>
                <Th>Aluno</Th>
                <Th>Código</Th>
                <Th>Estado</Th>
                <Th align="right">Nota</Th>
                <Th>
                  <span className="sr-only">Ação</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.codigo ?? `aluno-${l.aluno.id}`}>
                  <Td style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 600 }}>{l.aluno?.nome ?? l.rotulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>
                      {l.aluno ? (l.aluno.matricula ? `Matrícula ${l.aluno.matricula}` : '') : 'Prova sem identificação'}
                    </div>
                  </Td>
                  <Td style={{ fontFamily: 'monospace', fontSize: 13 }}>{l.codigo ?? '—'}</Td>
                  <Td style={{ whiteSpace: 'nowrap' }}>
                    <Badge status={STATE_LABEL[l.estado]} />
                    {l.correcao && <span style={{ fontSize: 12, color: 'var(--muted-3)', marginLeft: 8 }}>{GRADING_TYPE_LABEL[l.correcao.tipo]}</span>}
                  </Td>
                  <Td align="right" style={{ fontWeight: 700, color: scoreColor(l.correcao?.percentual), whiteSpace: 'nowrap' }}>
                    {l.correcao ? `${formatScore(l.correcao.nota)} (${formatPercent(l.correcao.percentual)})` : '—'}
                  </Td>
                  <Td align="right">
                    {l.codigo ? (
                      <RowLink to={copyPath(l.codigo)}>{l.estado === 'CORRIGIDA' ? 'Ver correção' : 'Corrigir'}</RowLink>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--muted-3)' }}>Use uma prova sem identificação</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      )}
    </div>
  );
}
