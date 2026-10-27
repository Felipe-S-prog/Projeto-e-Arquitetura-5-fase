import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, PrimaryButton, SecondaryButton } from '../components/ui';

function ShuffleToggle({ label, hint, checked, onClick, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        border: `1.5px solid ${checked ? 'oklch(80% 0.06 250)' : 'var(--border-dashed)'}`,
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
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
  const { getApplicationById, getExamById, updateApplication, classStudents, generateApplicationCopies, applicationsError } = useData();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // updateApplication já mostra o erro (applicationsError) e desfaz a mudança; aqui só evitamos erro solto.
  const saveConfig = (patch) => updateApplication(Number(id), patch).catch(() => {});

  const app = getApplicationById(id);
  if (!app) return <div>Aplicação não encontrada.</div>;
  const exam = getExamById(app.examId);
  const students = classStudents(app.classId);
  const hasPublishedAnswerKey = (app.copies || []).some((c) => c.answerKeyPublished);
  // Depois do download as cópias já foram impressas: o servidor não deixa gerar de novo (T23).
  const locked = app.status !== 'Pendente';

  const toggleLinkToRoster = () => {
    const next = !app.linkToRoster;
    saveConfig({
      linkToRoster: next,
      quantity: next && students.length > 0 ? students.length : app.quantity,
    });
  };

  const handleGenerate = async () => {
    if (locked) {
      navigate(`/aplicacoes/${app.id}/pdf/preview`);
      return;
    }
    if (hasPublishedAnswerKey) {
      const confirmed = window.confirm(
        'Já existem gabaritos publicados para esta aplicação. Gerar novamente cria novos códigos e invalida o que já foi publicado. Continuar?'
      );
      if (!confirmed) return;
    }
    setGenerating(true);
    setGenerateError('');
    try {
      await generateApplicationCopies(app.id);
      navigate(`/aplicacoes/${app.id}/pdf/preview`);
    } catch (err) {
      setGenerateError(err.message || 'Não foi possível gerar as provas.');
      setGenerating(false);
    }
  };

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
            onClick={() => saveConfig({ shuffleQuestions: !app.shuffleQuestions })}
            disabled={locked}
          />
          <ShuffleToggle
            label="Embaralhar alternativas"
            hint="Independente do embaralhamento de questões."
            checked={app.shuffleAlternatives}
            onClick={() => saveConfig({ shuffleAlternatives: !app.shuffleAlternatives })}
            disabled={locked}
          />
        </div>

        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginTop: 26, marginBottom: 6 }}>
          Identificação
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginBottom: 18 }}>
          Por padrão a prova é anônima: o QR Code identifica só a versão, e nome/matrícula são preenchidos à mão.
        </div>
        <ShuffleToggle
          label="Vincular aos alunos matriculados na turma"
          hint={
            students.length === 0
              ? 'Esta turma ainda não tem alunos cadastrados.'
              : `Gera ${students.length} provas, uma para cada aluno, já identificadas pelo nome.`
          }
          checked={app.linkToRoster}
          onClick={toggleLinkToRoster}
          disabled={students.length === 0 || locked}
        />

        <div
          style={{
            fontSize: 12.5,
            color: 'var(--muted)',
            background: 'var(--navy-chip-tint-bg)',
            borderRadius: 8,
            padding: '10px 12px',
            marginTop: 18,
          }}
        >
          {app.linkToRoster
            ? 'Como as provas estão vinculadas à turma, o código de cada uma já identifica a pessoa automaticamente.'
            : 'Um QR Code identifica a versão em cada folha; nome e matrícula são preenchidos manualmente pela pessoa.'}
        </div>

        {locked && (
          <div style={{ marginTop: 16, fontSize: 13.5, color: 'var(--muted)' }}>
            Esta aplicação já foi baixada: as {app.copies?.length || app.quantity} provas impressas ficam com os mesmos códigos.
          </div>
        )}

        {(generateError || applicationsError) && (
          <div style={{ marginTop: 16, fontSize: 13.5, color: 'var(--red-text, #b42318)' }}>{generateError || applicationsError}</div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border-light)' }}>
          <SecondaryButton onClick={() => navigate(`/aplicacoes/${app.id}`)}>Voltar</SecondaryButton>
          <PrimaryButton onClick={handleGenerate} disabled={generating}>
            {generating ? 'Gerando...' : locked ? 'Ver provas geradas' : 'Gerar pré-visualização'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
