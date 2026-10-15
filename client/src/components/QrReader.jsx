import { useCallback, useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from './ui';
import { parseQrPayload } from '../utils/qrPayload';
import {
  cameraSupported,
  describeCameraError,
  readQrFromFile,
  scanVideo,
  startCamera,
  stopCamera,
} from '../utils/qrReader';

const MODES = [
  { key: 'image', label: 'Enviar imagem' },
  { key: 'camera', label: 'Usar câmera' },
];

// Leitor de QR Code com dois modos: envio de imagem e câmera.
// Quando encontra um QR do SGP, chama onCode(codigo). QR de outros sistemas são ignorados
// com um aviso. O mesmo componente pode ser reaproveitado na tela de correção.
export default function QrReader({ onCode }) {
  const [mode, setMode] = useState('image');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const stopScanRef = useRef(null);
  const fileInputRef = useRef(null);

  const showError = useCallback((text) => {
    // Evita re-renderizar a cada quadro da câmera quando o aviso é o mesmo.
    setMessage((current) => (current && current.text === text ? current : { text }));
  }, []);

  // Recebe o texto lido de um QR. Devolve true quando era um QR do SGP (leitura concluída).
  const handleText = useCallback(
    (text) => {
      const code = parseQrPayload(text);
      if (code) {
        setMessage(null);
        onCode(code);
        return true;
      }
      showError('Esse QR Code não é de uma prova do SGP.');
      return false;
    },
    [onCode, showError]
  );

  const turnCameraOff = useCallback(() => {
    if (stopScanRef.current) stopScanRef.current();
    stopScanRef.current = null;
    stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  // Desliga a câmera ao sair da tela.
  useEffect(() => turnCameraOff, [turnCameraOff]);

  const changeMode = (key) => {
    turnCameraOff();
    setMessage(null);
    setMode(key);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const text = await readQrFromFile(file);
      if (!text) {
        showError('Não encontrei nenhum QR Code nessa imagem. Tente uma foto mais nítida, com o QR inteiro e bem iluminado.');
      } else {
        handleText(text);
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const turnCameraOn = async () => {
    setMessage(null);
    if (!cameraSupported()) {
      showError('A câmera só funciona em página segura (https ou localhost) e em navegador com suporte.');
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    try {
      const stream = await startCamera(video);
      if (videoRef.current !== video) {
        // Saiu da aba da câmera enquanto o navegador pedia a permissão.
        stopCamera(stream, video);
        return;
      }
      streamRef.current = stream;
      setCameraOn(true);
      stopScanRef.current = scanVideo(video, (text) => {
        const done = handleText(text);
        if (done) turnCameraOff();
        return done;
      });
    } catch (error) {
      turnCameraOff();
      showError(describeCameraError(error));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {MODES.map(({ key, label }) => {
          const active = mode === key;
          return (
            <div
              key={key}
              onClick={() => changeMode(key)}
              style={{
                padding: '7px 14px',
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 600,
                background: active ? 'var(--navy)' : 'white',
                color: active ? 'white' : 'oklch(40% 0.02 250)',
                cursor: 'pointer',
                border: active ? 'none' : '1px solid var(--border)',
              }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {mode === 'image' && (
        <div>
          <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginBottom: 14 }}>
            Envie uma foto ou um print da folha. O QR Code precisa aparecer inteiro e nítido.
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          <PrimaryButton onClick={() => fileInputRef.current?.click()} disabled={busy}>
            {busy ? 'Lendo imagem...' : 'Escolher imagem'}
          </PrimaryButton>
        </div>
      )}

      {mode === 'camera' && (
        <div>
          <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginBottom: 14 }}>
            Aponte a câmera para o QR Code da folha. A leitura é automática.
          </div>
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
              aspectRatio: '4 / 3',
              background: 'oklch(20% 0.02 250)',
              borderRadius: 10,
              overflow: 'hidden',
              marginBottom: 14,
            }}
          >
            <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {!cameraOn && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'oklch(20% 0.02 250)',
                  color: 'white',
                  fontSize: 13.5,
                  opacity: 0.9,
                }}
              >
                Câmera desligada
              </div>
            )}
          </div>
          {cameraOn ? (
            <SecondaryButton onClick={turnCameraOff}>Desligar câmera</SecondaryButton>
          ) : (
            <PrimaryButton onClick={turnCameraOn}>Ligar câmera</PrimaryButton>
          )}
        </div>
      )}

      {message && <div style={{ marginTop: 14, fontSize: 13.5, color: 'var(--red-text)' }}>{message.text}</div>}
    </div>
  );
}
