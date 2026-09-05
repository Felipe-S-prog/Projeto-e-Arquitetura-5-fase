import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, PrimaryButton, SecondaryButton } from '../components/ui';
import { ExamSheetIcon, QrMarkerIcon } from '../components/icons';
import DownloadModal from '../components/DownloadModal';

const LINE_WIDTHS = [
  ['92%', '60%'],
  ['85%', '70%'],
];

export default function PdfPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getApplicationById, getExamById, getClassById, examQuestionsDetailed, confirmApplicationDownload, generateApplicationCopies } =
    useData();

  const app = getApplicationById(id);
  const [expanded, setExpanded] = useState({});
  const [showModal, setShowModal] = useState(false);

  // Segurança para navegação direta (ex: voltar/avançar no navegador) sem
  // ter passado pelo botão "Gerar pré-visualização" ainda.
  useEffect(() => {
    if (app && (!app.copies || app.copies.length === 0)) {
      generateApplicationCopies(app.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id]);

  if (!app) return <div>Aplicação não encontrada.</div>;
  const exam = getExamById(app.examId);
  const cls = getClassById(app.classId);
  const examQuestions = examQuestionsDetailed(app.examId);
  const questionWithImage = examQuestions.find((q) => q.imageUrl);
  const copies = app.copies || [];
  const shuffleSummary = `Questões: ${app.shuffleQuestions ? 'sim' : 'não'} · Alternativas: ${app.shuffleAlternatives ? 'sim' : 'não'}`;

  const confirmDownload = () => {
    confirmApplicationDownload(app.id);
    setShowModal(false);
    navigate('/aplicacoes');
  };

  return (
    <div>
      <Breadcrumb items={[{ label: exam?.title, to: `/aplicacoes/${app.id}` }, { label: 'Pré-visualização' }]} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            Pré-visualização das provas
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 5 }}>
            {copies.length} provas geradas, cada uma com questões e alternativas em ordem diferente.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <SecondaryButton onClick={() => navigate(`/aplicacoes/${app.id}/gabarito`)}>Gerar gabarito</SecondaryButton>
          <PrimaryButton onClick={() => setShowModal(true)}>Baixar todas em PDF</PrimaryButton>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
        {copies.map((copy, i) => {
          const isExpanded = !!expanded[i];
          return (
            <div key={copy.code} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div
                onClick={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
              >
                <div style={{ color: 'var(--navy)' }}>
                  <ExamSheetIcon width={15} height={17} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-strong)' }}>{copy.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-2)', marginTop: 2 }}>Código: {copy.code}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 100,
                    background: 'var(--navy-chip-bg)',
                    color: 'var(--navy)',
                  }}
                >
                  Embaralhada
                </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{isExpanded ? 'Ocultar ↑' : 'Ver PDF ↓'}</span>
              </div>
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-light)', padding: 20, display: 'flex', justifyContent: 'center', background: 'var(--bg)' }}>
                  <div
                    style={{
                      width: 280,
                      background: 'white',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      padding: 16,
                      boxShadow: 'var(--shadow-sheet)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        borderBottom: '1.5px solid var(--text-strong)',
                        paddingBottom: 8,
                        marginBottom: 10,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-strong)' }}>{exam?.title}</div>
                        <div style={{ fontSize: 9, color: 'var(--muted-3)', marginTop: 2 }}>
                          {copy.studentName ? `Nome: ${copy.studentName}` : 'Nome: ______________________'}
                        </div>
                      </div>
                      <div style={{ color: 'var(--navy)' }}>
                        <QrMarkerIcon size={20} />
                      </div>
                    </div>
                    {LINE_WIDTHS.map(([w1, w2], li) => (
                      <div key={li} style={{ marginBottom: 9 }}>
                        <div style={{ height: 2, width: w1, background: 'oklch(30% 0.02 250)', borderRadius: 1, marginBottom: 5 }} />
                        <div style={{ height: 2, width: w2, background: 'oklch(30% 0.02 250)', borderRadius: 1, marginBottom: 6 }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          {Array.from({ length: 4 }).map((_, bi) => (
                            <div key={bi} style={{ width: 8, height: 8, borderRadius: '50%', border: '1.3px solid var(--muted-2)' }} />
                          ))}
                        </div>
                      </div>
                    ))}
                    {questionWithImage && (
                      <div style={{ marginTop: 6, marginBottom: 9 }}>
                        <img
                          src={questionWithImage.imageUrl}
                          alt="Figura da questão"
                          style={{ width: '100%', borderRadius: 3, border: '1px solid var(--border-light)', display: 'block' }}
                        />
                        <div style={{ fontSize: 8, color: 'var(--muted-3)', marginTop: 3 }}>Figura da questão com imagem</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {copies.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted-3)', fontSize: 13.5 }}>Gerando provas…</div>
        )}
      </div>

      {showModal && (
        <DownloadModal
          examTitle={exam?.title}
          className={cls?.name}
          quantity={copies.length}
          shuffleSummary={shuffleSummary}
          onConfirm={confirmDownload}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
