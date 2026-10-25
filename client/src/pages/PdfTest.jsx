import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { Breadcrumb, PageHeader, FormField, Select, PrimaryButton } from '../components/ui';

const cardStyle = {
  background: 'white',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 26,
  maxWidth: 760,
  marginBottom: 18,
};

function Row({ label, value, last }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid var(--border-light)',
        fontSize: 14,
      }}
    >
      <span style={{ color: 'var(--muted-2)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// Tela de teste do módulo de montagem do PDF (T22). Gera o PDF consolidado real da
// aplicação e mostra na tela. A ligação com o botão "Baixar todas em PDF" é a T25.
export default function PdfTest() {
  const { id } = useParams();
  const { getApplicationById, getExamById, getClassById, examQuestionsDetailed, generateApplicationCopies, settings } = useData();

  const app = getApplicationById(id);
  const [mode, setMode] = useState('completo');
  const [duplex, setDuplex] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const urlRef = useRef(null);

  // Garante que a aplicação tenha cópias, como na pré-visualização.
  useEffect(() => {
    if (app && (!app.copies || app.copies.length === 0)) {
      generateApplicationCopies(app.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id]);

  // Libera o arquivo da memória ao sair da tela.
  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), []);

  if (!app) return <div>Aplicação não encontrada.</div>;
  const exam = getExamById(app.examId);
  const cls = getClassById(app.classId);
  const copies = app.copies || [];

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      // import dinâmico: pdf-lib só é baixado quando o professor pede o PDF
      const [{ buildConsolidatedPdf }, { loadQuestionImages }] = await Promise.all([
        import('../pdf/buildConsolidatedPdf'),
        import('../pdf/loadQuestionImages'),
      ]);
      const questions = examQuestionsDetailed(app.examId);
      const { images, failed } = await loadQuestionImages(questions);
      const started = performance.now();
      const built = await buildConsolidatedPdf({
        exam,
        className: cls?.name,
        date: app.date,
        institution: settings?.institutionName,
        questions,
        copies,
        images,
        mode,
        duplex,
      });
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(new Blob([built.bytes], { type: 'application/pdf' }));
      setResult({
        url: urlRef.current,
        pageCount: built.pageCount,
        sizeKb: Math.round(built.bytes.length / 1024),
        seconds,
        warnings: [...built.warnings, ...failed.map((qid) => `A imagem da questão ${qid} não carregou.`)],
      });
    } catch (e) {
      setResult(null);
      setError(e.message || 'Não foi possível gerar o PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: exam?.title, to: `/aplicacoes/${app.id}` },
          { label: 'Pré-visualização', to: `/aplicacoes/${app.id}/pdf/preview` },
          { label: 'Teste do PDF' },
        ]}
      />
      <PageHeader
        title="Teste do PDF consolidado"
        description="Gera o PDF real com todas as cópias desta aplicação (cabeçalho, quadro de resposta com QR Code e questões embaralhadas)."
      />

      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <FormField label="Conteúdo">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="completo">Prova completa (folha + questões)</option>
              <option value="folha-de-resposta">Só a folha de resposta</option>
            </Select>
          </FormField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, paddingBottom: 10 }}>
            <input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} />
            Frente e verso (cada cópia termina em página par)
          </label>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginBottom: 16 }}>
          {copies.length} cópias nesta aplicação.
        </div>
        <PrimaryButton onClick={generate} disabled={busy || copies.length === 0}>
          {busy ? 'Gerando...' : 'Gerar PDF'}
        </PrimaryButton>
        {error && <div style={{ marginTop: 14, fontSize: 14, color: '#b42318' }}>{error}</div>}
      </div>

      {result && (
        <div style={cardStyle}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>PDF gerado</div>
          <Row label="Páginas" value={result.pageCount} />
          <Row label="Tamanho" value={`${result.sizeKb} KB`} />
          <Row label="Tempo" value={`${result.seconds} s`} last />
          {result.warnings.map((w) => (
            <div key={w} style={{ marginTop: 10, fontSize: 13.5, color: '#b54708' }}>
              {w}
            </div>
          ))}
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <a
              href={result.url}
              download={`${exam?.title || 'prova'}.pdf`}
              style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}
            >
              Baixar o PDF
            </a>
          </div>
          <iframe
            title="PDF gerado"
            src={result.url}
            style={{ width: '100%', height: 640, border: '1px solid var(--border-light)', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}
