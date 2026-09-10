import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, PrimaryButton, SecondaryButton, Badge, EmptyState } from '../components/ui';
import AnswerKeyExportModal from '../components/AnswerKeyExportModal';

export default function AnswerKey() {
  const { id } = useParams();
  const { getApplicationById, getExamById, getClassById, publishAnswerKey } = useData();
  const [showExportModal, setShowExportModal] = useState(false);

  const app = getApplicationById(id);
  if (!app) return <div>Aplicação não encontrada.</div>;
  const exam = getExamById(app.examId);
  const cls = getClassById(app.classId);
  const copies = app.copies || [];
  const publishedCount = copies.filter((c) => c.answerKeyPublished).length;

  return (
    <div>
      <Breadcrumb items={[{ label: exam?.title, to: `/aplicacoes/${app.id}` }, { label: 'Gabarito' }]} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 16 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Gabarito</div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 5, maxWidth: 480 }}>
            Cada pessoa acessa a página pública de gabarito e digita o próprio código. Ela vê só as respostas certas —
            nunca a nota.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <SecondaryButton onClick={() => setShowExportModal(true)} disabled={copies.length === 0}>
            Exportar gabarito em PDF
          </SecondaryButton>
          <PrimaryButton onClick={() => publishAnswerKey(app.id, 'all')} disabled={copies.length === 0}>
            Publicar todos
          </PrimaryButton>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--muted-2)', marginBottom: 16 }}>
        {publishedCount} de {copies.length} publicados
      </div>

      {copies.length === 0 ? (
        <EmptyState>Gere o PDF em "Pré-visualização e download" antes de publicar o gabarito.</EmptyState>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {copies.map((copy) => (
            <div
              key={copy.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '14px 18px',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-strong)' }}>{copy.label}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 2 }}>Código: {copy.code}</div>
              </div>
              <Badge status={copy.answerKeyPublished ? 'Publicado' : 'Não publicado'} />
              {!copy.answerKeyPublished && (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    publishAnswerKey(app.id, copy.code);
                  }}
                  style={{ fontSize: 13, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}
                >
                  Publicar
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {showExportModal && (
        <AnswerKeyExportModal
          examTitle={exam?.title}
          className={cls?.name}
          quantity={copies.length}
          onConfirm={() => setShowExportModal(false)}
          onCancel={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
