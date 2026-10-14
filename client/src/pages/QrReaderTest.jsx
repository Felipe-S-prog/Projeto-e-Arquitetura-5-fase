import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Breadcrumb, PageHeader, FormField, Select, EmptyState } from '../components/ui';
import QrReader from '../components/QrReader';
import QrCode from '../components/QrCode';
import { buildQrPayload } from '../utils/qrPayload';

const cardStyle = {
  background: 'white',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 26,
  maxWidth: 640,
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

// Tela de teste da leitura de QR Code. Procura o código lido nas provas geradas.
// O componente QrReader é o mesmo que a tela de correção vai reaproveitar.
export default function QrReaderTest() {
  const { applications, findCopyByCode, getExamById, getClassById } = useData();
  const [readCode, setReadCode] = useState(null);
  const [applicationId, setApplicationId] = useState('');
  const [copyCode, setCopyCode] = useState('');

  const found = readCode ? findCopyByCode(readCode) : null;
  const foundExam = found ? getExamById(found.application.examId) : null;
  const foundClass = found ? getClassById(found.application.classId) : null;

  const applicationsWithCopies = applications.filter((a) => (a.copies || []).length > 0);
  const sampleApplication =
    applicationsWithCopies.find((a) => String(a.id) === String(applicationId)) || applicationsWithCopies[0];
  const sampleCopy = sampleApplication?.copies.find((c) => c.code === copyCode) || sampleApplication?.copies[0];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Aplicações', to: '/aplicacoes' }, { label: 'Leitura de QR Code' }]} />
      <PageHeader
        title="Leitura de QR Code"
        description="Teste de leitura: envie uma imagem ou use a câmera. O código lido é procurado nas provas geradas."
      />

      <div style={cardStyle}>
        <QrReader onCode={setReadCode} />
      </div>

      {readCode && (
        <div style={cardStyle}>
          {found ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Prova encontrada</div>
              <Row label="Prova" value={found.copy.label} />
              <Row label="Código" value={found.copy.code} />
              <Row label="Avaliação" value={foundExam?.title} />
              <Row label="Turma" value={foundClass?.name} />
              <Row label="Aluno" value={found.copy.studentName || 'Sem aluno vinculado'} last />
            </>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>QR lido, prova não encontrada</div>
              <div style={{ fontSize: 13.5, color: 'var(--muted-2)' }}>
                O QR é do SGP (código {readCode}), mas esse código não existe neste ambiente. Os códigos de teste são recriados
                sempre que a página é recarregada.
              </div>
            </>
          )}
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>Precisa de um QR para testar?</div>
        <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginBottom: 16 }}>
          Escolha uma prova e tire um print do QR para enviar na aba de imagem, ou imprima esta página para ler com a câmera.
        </div>
        {sampleCopy ? (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <FormField label="Aplicação">
                <Select
                  value={sampleApplication.id}
                  onChange={(e) => {
                    setApplicationId(e.target.value);
                    setCopyCode('');
                  }}
                >
                  {applicationsWithCopies.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getExamById(a.examId)?.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Prova">
                <Select value={sampleCopy.code} onChange={(e) => setCopyCode(e.target.value)}>
                  {sampleApplication.copies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div style={{ display: 'inline-block', border: '1px solid var(--border-light)', borderRadius: 8, padding: 8 }}>
              <QrCode code={sampleCopy.code} size={240} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 8 }}>
              Conteúdo do QR: {buildQrPayload(sampleCopy.code)}
            </div>
          </>
        ) : (
          <EmptyState>Nenhuma prova foi gerada ainda. Gere as provas de uma aplicação para ter um QR de teste.</EmptyState>
        )}
      </div>
    </div>
  );
}
