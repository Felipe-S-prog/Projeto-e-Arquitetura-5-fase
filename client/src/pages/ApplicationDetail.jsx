import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, Badge } from '../components/ui';
import { ExamSheetIcon, StackedSheetsIcon, CorrectionIcon, ReportBarsIcon } from '../components/icons';

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getApplicationById, getExamById, getClassById } = useData();

  const app = getApplicationById(id);
  if (!app) return <div>Aplicação não encontrada.</div>;

  const exam = getExamById(app.examId);
  const cls = getClassById(app.classId);
  const hasPdf = app.status === 'Aplicada';
  const stageOpacity = hasPdf ? 1 : 0.55;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Aplicações', to: '/aplicacoes' }, { label: exam?.title }]} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{exam?.title}</div>
        <Badge status={app.status} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 30 }}>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>aplicada em</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--navy)',
            background: 'var(--navy-chip-tint-bg)',
            padding: '5px 12px',
            borderRadius: 100,
          }}
        >
          {cls?.name}
        </span>
        <span style={{ fontSize: 14, color: 'var(--muted)', marginLeft: 8 }}>{app.quantity} pessoas</span>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--faint)', marginBottom: 14 }}>
        FLUXO DA APLICAÇÃO
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <div
          onClick={() => navigate(hasPdf ? `/aplicacoes/${app.id}/pdf/preview` : `/aplicacoes/${app.id}/pdf`)}
          style={{
            background: 'white',
            border: `1.5px solid ${hasPdf ? 'var(--green-bg)' : 'var(--navy)'}`,
            borderRadius: 14,
            padding: 20,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: hasPdf ? 'var(--green-bg)' : 'var(--navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: hasPdf ? 'var(--green-text)' : 'white',
            }}
          >
            <ExamSheetIcon width={13} height={15} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>Pré-visualização e download</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted-2)', flex: 1 }}>
            {hasPdf ? `PDF consolidado disponível · ${app.quantity} provas.` : 'Configure embaralhamento e gere as provas.'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{hasPdf ? 'Ver provas' : 'Configurar e gerar'} →</div>
        </div>

        <div
          style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: stageOpacity,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--icon-tile-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted-3)',
            }}
          >
            <StackedSheetsIcon size={11} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>Versões geradas</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted-2)', flex: 1 }}>
            {hasPdf ? `${app.quantity} versões, cada uma embaralhada de forma única.` : 'Disponível após gerar as provas.'}
          </div>
        </div>

        <div
          style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: stageOpacity,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--icon-tile-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted-3)',
            }}
          >
            <CorrectionIcon size={15} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>Correções</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted-2)', flex: 1 }}>
            {hasPdf ? 'Nenhuma correção registrada ainda.' : 'Disponível após gerar as provas.'}
          </div>
        </div>

        <div
          style={{
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: stageOpacity,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--icon-tile-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted-3)',
            }}
          >
            <ReportBarsIcon height={15} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-strong)' }}>Relatório</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted-2)', flex: 1 }}>
            {hasPdf ? 'Disponível após haver correções.' : 'Disponível após gerar as provas.'}
          </div>
        </div>
      </div>
    </div>
  );
}
