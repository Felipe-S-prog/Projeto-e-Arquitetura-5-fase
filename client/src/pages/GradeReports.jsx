import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Breadcrumb, EmptyState, FormField, PageHeader, SecondaryButton, Select } from '../components/ui';
import { apiDownload } from '../services/api';
import { useApiGet } from '../services/useApiGet';
import { formatDate, formatPercent, formatScore, GRADING_TYPE_LABEL, scoreColor } from '../utils/grades';

const VIEWS = [
  { key: 'aplicacao', label: 'Por aplicação' },
  { key: 'turma', label: 'Consolidado da turma' },
];

const cardStyle = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 18 };
const thStyle = { padding: '9px 8px', fontSize: 12, fontWeight: 600, color: 'var(--muted-3)', textAlign: 'left', whiteSpace: 'nowrap' };
const tdStyle = { padding: '10px 8px', fontSize: 13.5, borderTop: '1px solid var(--border-light)' };

function Tabs({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
      {VIEWS.map(({ key, label }) => {
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

function StatCard({ label, value, detail, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color ?? 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
      {detail && <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 4 }}>{detail}</div>}
    </div>
  );
}

function ErrorState({ error }) {
  return <EmptyState>{error.message}</EmptyState>;
}

function ExportButton({ path, fallbackName }) {
  const [state, setState] = useState({ busy: false, error: '' });
  const download = async () => {
    setState({ busy: true, error: '' });
    try {
      await apiDownload(path, fallbackName);
      setState({ busy: false, error: '' });
    } catch (error) {
      setState({ busy: false, error: error.message });
    }
  };
  return (
    <div style={{ textAlign: 'right' }}>
      <SecondaryButton onClick={download} disabled={state.busy}>
        {state.busy ? 'Gerando...' : 'Exportar CSV (Excel)'}
      </SecondaryButton>
      {state.error && <div style={{ fontSize: 12.5, color: 'var(--red-text)', marginTop: 6 }}>{state.error}</div>}
    </div>
  );
}

function HitRateBar({ value }) {
  if (value === null) return <span style={{ color: 'var(--muted-3)' }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 90, height: 6, borderRadius: 3, background: 'var(--border-light)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: scoreColor(value) }} />
      </div>
      <span style={{ fontWeight: 600, color: scoreColor(value) }}>{formatPercent(value)}</span>
    </div>
  );
}

function applicationLabel(a) {
  return `${a.prova.titulo} · ${a.turma.nome}${a.dataAplicacao ? ` · ${formatDate(a.dataAplicacao)}` : ''}`;
}

function ApplicationReport({ applicationId, onSelect }) {
  const list = useApiGet('/relatorios/aplicacoes');
  const report = useApiGet(applicationId ? `/relatorios/aplicacoes/${applicationId}` : null);

  if (list.loading) return <EmptyState>Carregando aplicações...</EmptyState>;
  if (list.error) return <ErrorState error={list.error} />;
  if (list.data.length === 0) return <EmptyState>Nenhuma aplicação encontrada. As notas aparecem aqui depois que as provas forem geradas e corrigidas.</EmptyState>;

  const stats = report.data?.estatisticas;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 360px', maxWidth: 560 }}>
          <FormField label="Aplicação">
            <Select value={applicationId ?? ''} onChange={(e) => onSelect(e.target.value)}>
              <option value="">Selecione uma aplicação</option>
              {list.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {applicationLabel(a)} ({a.corrigidas}/{a.totalCopias} corrigidas)
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div style={{ flex: 1 }} />
        {report.data && <ExportButton path={`/relatorios/aplicacoes/${applicationId}/csv`} fallbackName="notas-da-aplicacao.csv" />}
      </div>

      {!applicationId && <EmptyState>Escolha uma aplicação para ver as notas.</EmptyState>}
      {report.loading && <EmptyState>Carregando relatório...</EmptyState>}
      {report.error && <ErrorState error={report.error} />}

      {report.data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
            <StatCard label="Corrigidas" value={`${stats.corrigidas} de ${stats.totalCopias}`} detail={stats.pendentes ? `${stats.pendentes} pendente(s)` : 'Todas corrigidas'} />
            <StatCard
              label="Média"
              value={formatScore(stats.media)}
              detail={`${formatPercent(stats.mediaPercentual)} de ${formatScore(report.data.aplicacao.notaMaxima)}`}
              color={scoreColor(stats.mediaPercentual)}
            />
            <StatCard label="Mediana" value={formatScore(stats.mediana)} />
            <StatCard label="Maior nota" value={formatScore(stats.maior)} />
            <StatCard label="Menor nota" value={formatScore(stats.menor)} />
          </div>
          {stats.semAluno > 0 && (
            <div style={{ fontSize: 13, color: 'var(--amber-text)', marginBottom: 14 }}>
              {stats.semAluno} nota(s) sem aluno associado: abra a prova em Correção para associar ao aluno certo.
            </div>
          )}

          <div style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Notas</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Aluno</th>
                    <th style={thStyle}>Código</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Nota</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>%</th>
                    <th style={thStyle}>Correção</th>
                    <th style={thStyle} />
                  </tr>
                </thead>
                <tbody>
                  {report.data.notas.map((n) => (
                    <tr key={n.codigo}>
                      <td style={tdStyle}>
                        {n.aluno ? (
                          <Link to={`/relatorios/alunos/${n.aluno.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
                            {n.aluno.nome}
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--muted-2)' }}>{n.rotulo} · sem aluno</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 13 }}>{n.codigo}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: scoreColor(n.percentual) }}>{formatScore(n.nota)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatPercent(n.percentual)}</td>
                      <td style={tdStyle}>
                        <Badge status={n.tipo ? GRADING_TYPE_LABEL[n.tipo] : 'Pendente'} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Link to={`/correcao?codigo=${n.codigo}`} style={{ fontSize: 13, fontWeight: 600 }}>
                          {n.tipo ? 'Ver correção' : 'Corrigir'} →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Desempenho por questão</div>
            <div style={{ fontSize: 13, color: 'var(--muted-2)', marginBottom: 10 }}>
              Considera só as correções feitas pelas respostas (lançamentos manuais não têm resposta por questão). Numeração da prova original.
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nº</th>
                    <th style={thStyle}>Enunciado</th>
                    <th style={thStyle}>Taxa de acerto</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Em branco</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Média de pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.questoes.map((q) => (
                    <tr key={q.questaoId}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{q.posicao}</td>
                      <td style={{ ...tdStyle, maxWidth: 380 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.enunciado}</div>
                        {q.tipo === 'DISCURSIVA' && <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>Discursiva</div>}
                      </td>
                      <td style={tdStyle}>
                        <HitRateBar value={q.taxaAcerto} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{q.tipo === 'OBJETIVA' ? q.emBranco : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {formatScore(q.mediaPontos)} / {formatScore(q.pontuacao)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function ClassReport({ classId, onSelect }) {
  const list = useApiGet('/relatorios/turmas');
  const report = useApiGet(classId ? `/relatorios/turmas/${classId}` : null);

  if (list.loading) return <EmptyState>Carregando turmas...</EmptyState>;
  if (list.error) return <ErrorState error={list.error} />;
  if (list.data.length === 0) return <EmptyState>Nenhuma turma encontrada.</EmptyState>;

  const data = report.data;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', maxWidth: 460 }}>
          <FormField label="Turma">
            <Select value={classId ?? ''} onChange={(e) => onSelect(e.target.value)}>
              <option value="">Selecione uma turma</option>
              {list.data.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome} · {t.periodo}
                  {t.status === 'ARQUIVADA' ? ' (arquivada)' : ''}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div style={{ flex: 1 }} />
        {data && <ExportButton path={`/relatorios/turmas/${classId}/csv`} fallbackName="notas-consolidadas.csv" />}
      </div>

      {!classId && <EmptyState>Escolha uma turma para ver as notas de todas as aplicações.</EmptyState>}
      {report.loading && <EmptyState>Carregando relatório...</EmptyState>}
      {report.error && <ErrorState error={report.error} />}

      {data && data.aplicacoes.length === 0 && <EmptyState>Esta turma ainda não tem aplicações.</EmptyState>}
      {data && data.aplicacoes.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
            <StatCard label="Alunos" value={data.alunos.length} />
            <StatCard label="Aplicações" value={data.aplicacoes.length} />
            <StatCard label="Média da turma" value={formatPercent(data.mediaPercentualDaTurma)} detail="Média dos percentuais dos alunos" color={scoreColor(data.mediaPercentualDaTurma)} />
          </div>
          <div style={cardStyle}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Aluno</th>
                    {data.aplicacoes.map((a) => (
                      <th key={a.id} style={{ ...thStyle, textAlign: 'right', whiteSpace: 'normal', minWidth: 120 }}>
                        {a.prova.titulo}
                        <div style={{ fontWeight: 500 }}>
                          {formatDate(a.dataAplicacao)} · máx. {formatScore(a.notaMaxima)}
                        </div>
                      </th>
                    ))}
                    <th style={{ ...thStyle, textAlign: 'right' }}>Média</th>
                  </tr>
                </thead>
                <tbody>
                  {data.alunos.map((linha) => (
                    <tr key={linha.aluno.id}>
                      <td style={tdStyle}>
                        <Link to={`/relatorios/alunos/${linha.aluno.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
                          {linha.aluno.nome}
                        </Link>
                        {!linha.aluno.matriculado && <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>não está mais na turma</div>}
                      </td>
                      {linha.notas.map((n) => (
                        <td key={n.aplicacaoId} style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: scoreColor(n.percentual) }}>
                          {formatScore(n.nota)}
                        </td>
                      ))}
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: scoreColor(linha.mediaPercentual) }}>
                        {formatPercent(linha.mediaPercentual)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg)' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>Média da aplicação</td>
                    {data.aplicacoes.map((a) => (
                      <td key={a.id} style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                        {formatScore(a.estatisticas.media)}
                      </td>
                    ))}
                    <td style={tdStyle} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Relatórios de notas (T32): por aplicação (com acerto por questão) e consolidado
// por turma (alunos x aplicações), ambos com exportação em CSV para o Excel.
export default function GradeReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('turma') !== null || searchParams.get('visao') === 'turma' ? 'turma' : 'aplicacao';
  const applicationId = searchParams.get('aplicacao') || null;
  const classId = searchParams.get('turma') || null;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Relatórios' }]} />
      <PageHeader title="Relatórios de notas" description="Notas por aplicação e consolidadas por turma, com exportação para o Excel." />
      <Tabs value={view} onChange={(key) => setSearchParams(key === 'turma' ? { visao: 'turma' } : {})} />
      {view === 'aplicacao' ? (
        <ApplicationReport applicationId={applicationId} onSelect={(id) => setSearchParams(id ? { aplicacao: id } : {})} />
      ) : (
        <ClassReport classId={classId} onSelect={(id) => setSearchParams(id ? { turma: id } : { visao: 'turma' })} />
      )}
    </div>
  );
}
