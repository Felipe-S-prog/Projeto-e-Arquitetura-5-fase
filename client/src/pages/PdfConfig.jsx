import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, PrimaryButton, SecondaryButton } from '../components/ui';

function ShuffleToggle({ label, hint, checked, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        border: `1.5px solid ${checked ? 'oklch(80% 0.06 250)' : 'var(--border-dashed)'}`,
        borderRadius: 10,
        cursor: 'pointer',
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--muted-3)', marginTop: 2 }}>{hint}</div>
      </div>
      <div
        style={{
          width: 40,
          height: 22,
          borderRadius: 100,
          background: checked ? 'var(--navy)' : 'var(--border-dashed)',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'white',
            transition: 'left 0.15s',
          }}
        />
      </div>
    </div>
  );
}

export default function PdfConfig() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getApplicationById, getExamById, updateApplication } = useData();

  const app = getApplicationById(id);
  if (!app) return <div>Aplicação não encontrada.</div>;
  const exam = getExamById(app.examId);

  return (
    <div>
      <Breadcrumb items={[{ label: exam?.title, to: `/aplicacoes/${app.id}` }, { label: 'Configurar geração' }]} />
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', marginBottom: 24, letterSpacing: '-0.01em' }}>
        Configurar geração
      </div>

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 30, maxWidth: 600 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>Embaralhamento</div>
        <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginBottom: 18 }}>
          Cada uma das {app.quantity} provas terá sua própria ordem, garantindo que sejam diferentes entre si.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ShuffleToggle
            label="Embaralhar questões"
            hint="A ordem varia entre as provas geradas."
            checked={app.shuffleQuestions}
            onClick={() => updateApplication(app.id, { shuffleQuestions: !app.shuffleQuestions })}
          />
          <ShuffleToggle
            label="Embaralhar alternativas"
            hint="Independente do embaralhamento de questões."
            checked={app.shuffleAlternatives}
            onClick={() => updateApplication(app.id, { shuffleAlternatives: !app.shuffleAlternatives })}
          />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', background: 'var(--navy-chip-tint-bg)', borderRadius: 8, padding: '10px 12px', marginTop: 18 }}>
          Um QR Code identifica a versão em cada folha; nome e matrícula são preenchidos manualmente pela pessoa.
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border-light)' }}>
          <SecondaryButton onClick={() => navigate(`/aplicacoes/${app.id}`)}>Voltar</SecondaryButton>
          <PrimaryButton onClick={() => navigate(`/aplicacoes/${app.id}/pdf/preview`)}>Gerar pré-visualização</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
