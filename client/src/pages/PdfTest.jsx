import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { apiBlob } from '../services/api';
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

// Avisos do PDF vêm do servidor no cabeçalho X-Pdf-Avisos (JSON com encodeURIComponent).
function readWarnings(headers) {
  try {
    return JSON.parse(decodeURIComponent(headers.get('X-Pdf-Avisos') || '%5B%5D'));
  } catch {
    return [];
  }
}

// Tela de teste do PDF consolidado (T22). Pede o PDF real da aplicação ao servidor
// (GET /aplicacoes/:id/pdf, T25) e mostra na tela, sem marcar a aplicação como Aplicada.
export default function PdfTest() {
  const { id } = useParams();
  const { getApplicationById, getExamById, generateApplicationCopies } = useData();

  const app = getApplicationById(id);
  const [mode, setMode] = useState('completo');
  const [duplex, setDuplex] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const urlRef = useRef(null);

  // Garante que a aplicação tenha cópias, como na pré-visualização (só enquanto Pendente).
  useEffect(() => {
    if (app && app.status === 'Pendente' && (!app.copies || app.copies.length === 0)) {
      generateApplicationCopies(app.id).catch((err) => setError(err.message || 'Não foi possível gerar as provas.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id]);

  // Libera o arquivo da memória ao sair da tela.
  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), []);

  if (!app) return <div>Aplicação não encontrada.</div>;
  const exam = getExamById(app.examId);
  const copies = app.copies || [];

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ modo: mode, frenteVerso: String(duplex) });
      const started = performance.now();
      const { blob, name, headers } = await apiBlob(`/aplicacoes/${app.id}/pdf?${params}`, 'provas.pdf');
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setResult({
        url: urlRef.current,
        name,
        pageCount: Number(headers.get('X-Pdf-Paginas')) || '—',
        sizeKb: Math.round(blob.size / 1024),
        seconds,
        warnings: readWarnings(headers),
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
              download={result.name}
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
