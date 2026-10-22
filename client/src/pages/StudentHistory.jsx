import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Breadcrumb, EmptyState } from '../components/ui';
import { useApiGet } from '../services/useApiGet';
import { formatDate, formatDateTime, formatPercent, formatScore, GRADING_TYPE_LABEL, scoreColor } from '../utils/grades';

const cardStyle = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 22, marginBottom: 14 };

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color ?? 'var(--ink)' }}>{value}</div>
    </div>
  );
}

// Respostas de uma correção automática, carregadas só quando o professor abre o item.
function AnswersDetail({ gradingId }) {
  const { data, error, loading } = useApiGet(`/correcoes/${gradingId}`);
  if (loading) return <div style={{ fontSize: 13, color: 'var(--muted-2)' }}>Carregando respostas...</div>;
  if (error) return <div style={{ fontSize: 13, color: 'var(--red-text)' }}>{error.message}</div>;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {data.respostas.map((r) => {
        const color = r.correta === null ? 'var(--muted-2)' : r.correta ? 'var(--green-text)' : 'var(--red-text-strong)';
        return (
          <div
            key={r.questaoId}
            title={r.tipo === 'OBJETIVA' ? `Marcou ${r.letraMarcada ?? 'nada'}; correta ${r.letraCorreta}` : 'Discursiva'}
            style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, minWidth: 92 }}
          >
            <div style={{ fontWeight: 700 }}>Questão {r.numero}</div>
            <div style={{ color }}>
              {r.tipo === 'OBJETIVA' ? `${r.letraMarcada ?? '—'} → ${r.letraCorreta}` : 'Discursiva'} · {formatScore(r.pontos)}/{formatScore(r.pontuacao)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryItem({ item }) {
  const [open, setOpen] = useState(false);
  const automatic = item.tipo === 'AUTOMATICA';

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>{item.prova.titulo}</div>
            <Badge status={GRADING_TYPE_LABEL[item.tipo]} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted-2)', marginTop: 4 }}>
            {item.turma.nome} · aplicada em {formatDate(item.aplicacao.dataAplicacao)} · prova {item.codigo} · corrigida em {formatDateTime(item.corrigidaEm)}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 6, color: item.gabaritoPublicado ? 'var(--green-text)' : 'var(--muted-3)' }}>
            {item.gabaritoPublicado
              ? `Gabarito publicado em ${formatDateTime(item.gabaritoPublicadoEm)}: o aluno consulta em /gabarito com o código ${item.codigo}.`
              : 'Gabarito ainda não publicado para o aluno.'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor(item.percentual) }}>
            {formatScore(item.nota)}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted-3)' }}> / {formatScore(item.notaMaxima)}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>{formatPercent(item.percentual)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, fontWeight: 600 }}>
        {automatic && (
          <button type="button" onClick={() => setOpen((v) => !v)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--navy)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            {open ? 'Ocultar respostas' : 'Ver respostas'}
          </button>
        )}
        <Link to={`/relatorios?aplicacao=${item.aplicacao.id}`}>Notas da aplicação</Link>
        <Link to={`/correcao?codigo=${item.codigo}`}>Abrir correção</Link>
      </div>
      {open && (
        <div style={{ marginTop: 14 }}>
          <AnswersDetail gradingId={item.correcaoId} />
        </div>
      )}
    </div>
  );
}

// Histórico de notas e desempenho de um aluno (T33), nas turmas do professor (RF12).
export default function StudentHistory() {
  const { id } = useParams();
  const { data, error, loading } = useApiGet(`/alunos/${id}/historico`);

  if (loading) return <EmptyState>Carregando histórico...</EmptyState>;
  if (error) {
    return (
      <div>
        <Breadcrumb items={[{ label: 'Relatórios', to: '/relatorios' }, { label: 'Histórico do aluno' }]} />
        <EmptyState>{error.message}</EmptyState>
      </div>
    );
  }

  const { aluno, turmas, resumo, notas } = data;
  return (
    <div>
      <Breadcrumb items={[{ label: 'Relatórios', to: '/relatorios' }, { label: aluno.nome }]} />
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{aluno.nome}</div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 5 }}>
          {aluno.email}
          {aluno.matricula ? ` · matrícula ${aluno.matricula}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {turmas.map((t) => (
            <Link
              key={t.id}
              to={`/relatorios?turma=${t.id}`}
              style={{ fontSize: 13, fontWeight: 600, background: 'var(--navy-chip-tint-bg)', padding: '5px 12px', borderRadius: 100, textDecoration: 'none' }}
            >
              {t.nome} · {t.periodo}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard label="Provas corrigidas" value={resumo.provas} />
        <StatCard label="Média" value={formatPercent(resumo.mediaPercentual)} color={scoreColor(resumo.mediaPercentual)} />
        <StatCard label="Melhor resultado" value={formatPercent(resumo.melhorPercentual)} />
        <StatCard label="Pior resultado" value={formatPercent(resumo.piorPercentual)} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--faint)', marginBottom: 12 }}>HISTÓRICO DE NOTAS</div>
      {notas.length === 0 ? (
        <EmptyState>Este aluno ainda não tem notas lançadas.</EmptyState>
      ) : (
        notas.map((item) => <HistoryItem key={item.correcaoId} item={item} />)
      )}
    </div>
  );
}
