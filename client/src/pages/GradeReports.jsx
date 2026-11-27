import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AnswerDistribution, { MostMarked } from '../components/AnswerDistribution';
import {
  Badge,
  Breadcrumb,
  DataTable,
  EmptyState,
  ErrorMessage,
  FormField,
  PageHeader,
  PrimaryButton,
  RowLink,
  SecondaryButton,
  SectionCard,
  SegmentedControl,
  Select,
  StatCard,
  StatGrid,
  Td,
  Th,
} from '../components/ui';
import { apiDownload } from '../services/api';
import { useApiGet } from '../services/useApiGet';
import { formatDate, formatPercent, formatScore, GRADING_TYPE_LABEL, scoreColor } from '../utils/grades';

const VIEWS = [
  { key: 'aplicacao', label: 'Por aplicação' },
  { key: 'turma', label: 'Consolidado da turma' },
  { key: 'todas', label: 'Todas as turmas' },
];

// Formatos de exportação (T66). O Excel vem primeiro: é o que o professor usa no dia a dia.
const FORMATS = [
  { key: 'xlsx', label: 'Excel' },
  { key: 'pdf', label: 'PDF' },
  { key: 'csv', label: 'CSV' },
];

function ErrorState({ error }) {
  return <EmptyState>{error.message}</EmptyState>;
}

// Botões de exportação de um relatório: path é a rota sem o formato (ex.: /relatorios/turmas/3/exportar).
function ExportButtons({ path, fileName }) {
  const [state, setState] = useState({ busy: null, error: '' });
  const download = async (format) => {
    setState({ busy: format, error: '' });
    try {
      await apiDownload(`${path}?formato=${format}`, `${fileName}.${format}`);
      setState({ busy: null, error: '' });
    } catch (error) {
      setState({ busy: null, error: error.message });
    }
  };
  return (
    <div>
      <div role="group" aria-label="Exportar relatório" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--muted-2)' }}>Exportar:</span>
        {FORMATS.map(({ key, label }) => {
          const Button = key === 'xlsx' ? PrimaryButton : SecondaryButton;
          return (
            <Button key={key} onClick={() => download(key)} disabled={Boolean(state.busy)} style={{ padding: '9px 16px' }}>
              {state.busy === key ? 'Gerando...' : label}
            </Button>
          );
        })}
      </div>
      <ErrorMessage style={{ fontSize: 12.5, marginTop: 6 }}>{state.error}</ErrorMessage>
    </div>
  );
}

// Consolidado do professor (T66): todas as notas de todas as turmas, para baixar de uma vez.
function AllClassesReport() {
  return (
    <SectionCard
      title="Notas de todas as turmas"
      hint="No Excel: uma aba com todas as notas (turma, aluno, prova, data, nota e correção) e uma aba por turma com os alunos e as aplicações. No PDF: uma tabela por turma. No CSV: a lista com todas as notas."
    >
      <ExportButtons path="/relatorios/exportar" fileName="notas-todas-as-turmas" />
    </SectionCard>
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
  return `${a.prova.titulo} · ${a.turma.nome}${a.dataAplicacao ? ` · ${formatDate(a.dataAplicacao)}` : ''}${a.nominal === false ? ' · sem identificação' : ''}`;
}

function ApplicationReport({ applicationId, onSelect }) {
  const list = useApiGet('/relatorios/aplicacoes');
  const report = useApiGet(applicationId ? `/relatorios/aplicacoes/${applicationId}` : null);
  const [openQuestion, setOpenQuestion] = useState(null); // T74: questão com as alternativas abertas

  if (list.loading) return <EmptyState>Carregando aplicações...</EmptyState>;
  if (list.error) return <ErrorState error={list.error} />;
  if (list.data.length === 0) return <EmptyState>Nenhuma aplicação encontrada. As notas aparecem aqui depois que as provas forem geradas e corrigidas.</EmptyState>;

  const stats = report.data?.estatisticas;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 min(100%, 360px)', maxWidth: 560, minWidth: 0 }}>
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
        {report.data && <ExportButtons path={`/relatorios/aplicacoes/${applicationId}/exportar`} fileName="notas-da-aplicacao" />}
      </div>

      {!applicationId && <EmptyState>Escolha uma aplicação para ver as notas.</EmptyState>}
      {report.loading && <EmptyState>Carregando relatório...</EmptyState>}
      {report.error && <ErrorState error={report.error} />}

      {report.data && (
        <>
          <StatGrid>
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
          </StatGrid>
          {stats.semAluno > 0 && (
            <div style={{ fontSize: 13, color: 'var(--amber-text)', marginBottom: 14 }}>
              {stats.semAluno} nota(s) sem aluno associado: abra a prova em Correção para associar ao aluno certo.
            </div>
          )}

          <SectionCard title="Notas">
            <DataTable label="Notas por aluno">
              <thead>
                <tr>
                  <Th>Aluno</Th>
                  <Th>Código</Th>
                  <Th align="right">Nota</Th>
                  <Th align="right">%</Th>
                  <Th>Correção</Th>
                  <Th>
                    <span className="sr-only">Ação</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {report.data.notas.map((n) => (
                  <tr key={n.codigo}>
                    <Td style={{ minWidth: 160 }}>
                      {n.aluno ? (
                        <Link to={`/relatorios/alunos/${n.aluno.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
                          {n.aluno.nome}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--muted-2)' }}>{n.rotulo} · sem aluno</span>
                      )}
                    </Td>
                    <Td style={{ fontFamily: 'monospace', fontSize: 13 }}>{n.codigo}</Td>
                    <Td align="right" style={{ fontWeight: 700, color: scoreColor(n.percentual) }}>{formatScore(n.nota)}</Td>
                    <Td align="right">{formatPercent(n.percentual)}</Td>
                    <Td>
                      <Badge status={n.tipo ? GRADING_TYPE_LABEL[n.tipo] : 'Pendente'} />
                    </Td>
                    <Td align="right">
                      <RowLink to={`/correcao?codigo=${n.codigo}`}>{n.tipo ? 'Ver correção' : 'Corrigir'}</RowLink>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </SectionCard>

          <SectionCard
            title="Desempenho por questão"
            hint="Considera só as correções feitas pelas respostas (lançamentos manuais não têm resposta por questão). Numeração da prova original."
          >
            <DataTable label="Desempenho por questão">
              <thead>
                <tr>
                  <Th>Nº</Th>
                  <Th>Enunciado</Th>
                  <Th>Taxa de acerto</Th>
                  <Th>Mais marcada</Th>
                  <Th align="right">Em branco</Th>
                  <Th align="right">Média de pontos</Th>
                  <Th>
                    <span className="sr-only">Alternativas</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {report.data.questoes.map((q) => (
                  <Fragment key={q.questaoId}>
                  <tr>
                    <Td style={{ fontWeight: 600 }}>{q.posicao}</Td>
                    <Td style={{ maxWidth: 300 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.enunciado}</div>
                      {q.tipo === 'DISCURSIVA' && <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>Discursiva</div>}
                    </Td>
                    <Td>
                      <HitRateBar value={q.taxaAcerto} />
                    </Td>
                    <Td style={{ whiteSpace: 'nowrap' }}>
                      <MostMarked distribuicao={q.distribuicao} />
                    </Td>
                    <Td align="right">{q.tipo === 'OBJETIVA' ? q.emBranco : '—'}</Td>
                    <Td align="right" style={{ whiteSpace: 'nowrap' }}>
                      {formatScore(q.mediaPontos)} / {formatScore(q.pontuacao)}
                    </Td>
                    <Td align="right" style={{ whiteSpace: 'nowrap' }}>
                      {q.distribuicao && (
                        <button
                          type="button"
                          onClick={() => setOpenQuestion(openQuestion === q.questaoId ? null : q.questaoId)}
                          aria-expanded={openQuestion === q.questaoId}
                          style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 600, color: 'var(--navy)', cursor: 'pointer' }}
                        >
                          {openQuestion === q.questaoId ? 'Fechar' : 'Alternativas'}
                        </button>
                      )}
                    </Td>
                  </tr>
                  {openQuestion === q.questaoId && (
                    <tr>
                      <Td colSpan={7} style={{ borderTop: 'none', paddingTop: 0, paddingBottom: 16 }}>
                        {/* preso à esquerda: continua visível quando a tabela rola para o lado */}
                        <div style={{ position: 'sticky', left: 8, width: 540, maxWidth: '100%' }}>
                          <AnswerDistribution distribuicao={q.distribuicao} />
                        </div>
                      </Td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </DataTable>
          </SectionCard>
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
        <div style={{ flex: '1 1 min(100%, 320px)', maxWidth: 460, minWidth: 0 }}>
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
        {data && <ExportButtons path={`/relatorios/turmas/${classId}/exportar`} fileName="notas-consolidadas" />}
      </div>

      {!classId && <EmptyState>Escolha uma turma para ver as notas de todas as aplicações.</EmptyState>}
      {report.loading && <EmptyState>Carregando relatório...</EmptyState>}
      {report.error && <ErrorState error={report.error} />}

      {data && data.aplicacoes.length === 0 && <EmptyState>Esta turma ainda não tem aplicações.</EmptyState>}
      {data && data.aplicacoes.length > 0 && (
        <>
          <StatGrid>
            <StatCard label="Alunos" value={data.alunos.length} />
            <StatCard label="Aplicações" value={data.aplicacoes.length} />
            <StatCard label="Média da turma" value={formatPercent(data.mediaPercentualDaTurma)} detail="Média dos percentuais dos alunos" color={scoreColor(data.mediaPercentualDaTurma)} />
          </StatGrid>
          <SectionCard>
            <DataTable label="Notas da turma por aplicação">
              <thead>
                <tr>
                  <Th>Aluno</Th>
                  {data.aplicacoes.map((a) => (
                    <Th key={a.id} align="right" style={{ whiteSpace: 'normal', minWidth: 120 }}>
                      {a.prova.titulo}
                      <div style={{ fontWeight: 500 }}>
                        {formatDate(a.dataAplicacao)} · máx. {formatScore(a.notaMaxima)}
                      </div>
                    </Th>
                  ))}
                  <Th align="right">Média</Th>
                </tr>
              </thead>
              <tbody>
                {data.alunos.map((linha) => (
                  <tr key={linha.aluno.id}>
                    <Td style={{ minWidth: 160 }}>
                      <Link to={`/relatorios/alunos/${linha.aluno.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>
                        {linha.aluno.nome}
                      </Link>
                      {!linha.aluno.matriculado && <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>não está mais na turma</div>}
                    </Td>
                    {linha.notas.map((n) => (
                      <Td key={n.aplicacaoId} align="right" style={{ fontWeight: 600, color: scoreColor(n.percentual) }}>
                        {formatScore(n.nota)}
                      </Td>
                    ))}
                    <Td align="right" style={{ fontWeight: 700, color: scoreColor(linha.mediaPercentual) }}>
                      {formatPercent(linha.mediaPercentual)}
                    </Td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg)' }}>
                  <Td style={{ fontWeight: 700 }}>Média da aplicação</Td>
                  {data.aplicacoes.map((a) => (
                    <Td key={a.id} align="right" style={{ fontWeight: 700 }}>
                      {formatScore(a.estatisticas.media)}
                    </Td>
                  ))}
                  <Td />
                </tr>
              </tbody>
            </DataTable>
          </SectionCard>
        </>
      )}
    </>
  );
}

// Relatórios de notas (T32 e T66): por aplicação (com acerto por questão), consolidado
// por turma (alunos x aplicações) e de todas as turmas, com exportação em Excel, PDF e CSV.
export default function GradeReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view =
    searchParams.get('visao') === 'todas'
      ? 'todas'
      : searchParams.get('turma') !== null || searchParams.get('visao') === 'turma'
        ? 'turma'
        : 'aplicacao';
  const applicationId = searchParams.get('aplicacao') || null;
  const classId = searchParams.get('turma') || null;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Relatórios' }]} />
      <PageHeader title="Relatórios de notas" description="Notas por aplicação, por turma e de todas as turmas, com exportação para Excel, PDF e CSV." />
      <SegmentedControl
        label="Tipo de relatório"
        options={VIEWS}
        value={view}
        onChange={(key) => setSearchParams(key === 'aplicacao' ? {} : { visao: key })}
        style={{ marginBottom: 22 }}
      />
      {view === 'aplicacao' && (
        <ApplicationReport applicationId={applicationId} onSelect={(id) => setSearchParams(id ? { aplicacao: id } : {})} />
      )}
      {view === 'turma' && <ClassReport classId={classId} onSelect={(id) => setSearchParams(id ? { turma: id } : { visao: 'turma' })} />}
      {view === 'todas' && <AllClassesReport />}
    </div>
  );
}
