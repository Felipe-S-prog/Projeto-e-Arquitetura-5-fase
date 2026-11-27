import { useCallback, useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from './ui';
import { createStabilityTracker, scaleQr } from '../utils/liveSheet';
import { cameraSupported, describeCameraError, grabFrame, shrinkImageData, startCamera, stopCamera, takeStillPhoto } from '../utils/qrReader';
import { findSheetQr, loadSheetPhoto, readAnswers, SheetReadError } from '../utils/sheetReader';

const READ_MAX_SIDE = 2400; // mesma resolução da leitura pela foto
const QR_MAX_SIDE = 1000; // o QR é procurado numa cópia menor do quadro, que é bem mais rápido
const SCAN_INTERVAL_MS = 350; // pausa entre uma tentativa e outra
const STABLE_FRAMES = 2; // leituras iguais seguidas para aceitar sem o professor apertar nada
const COUNTDOWN_SECONDS = 3;

// Lê a folha de resposta pela câmera ao vivo, sem tirar foto.
// - Automático: tenta ler alguns quadros por segundo e aceita quando 2 quadros seguidos dão o
//   mesmo resultado (mesma prova e mesmas letras), o que evita aceitar um quadro tremido.
// - Contagem: "Ler em 3 s" mostra 3, 2, 1 para a pessoa segurar o celular parado e então lê
//   a melhor imagem disponível (foto do sensor quando o navegador permite).
// getFolha(codigo) devolve a geometria da folha daquela prova (ou lança SheetReadError) e
// onRead({ code, reading }) recebe a leitura aceita. A câmera desliga ao terminar ou ao sair.
export default function LiveSheetReader({ getFolha, onRead, onClose }) {
  const [startingCamera, setStartingCamera] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const openingCameraRef = useRef(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const activeRef = useRef(false); // laço automático rodando
  const pausedRef = useRef(false); // pausado durante a contagem e a captura
  const frameCanvasRef = useRef(null);
  const trackerRef = useRef(createStabilityTracker(STABLE_FRAMES));

  const stopAll = useCallback(() => {
    activeRef.current = false;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    setCameraOn(false);
    setCountdown(null);
    setCapturing(false);
  }, []);

  useEffect(() => stopAll, [stopAll]);

  // Lê um ImageData inteiro: acha o QR (na cópia reduzida), busca a folha e lê as bolinhas.
  // Devolve { code, reading } ou lança SheetReadError com a orientação para o professor.
  const readImage = useCallback(
    async (imageData) => {
      const small = shrinkImageData(imageData, QR_MAX_SIDE);
      const qr = scaleQr(findSheetQr(small.imageData), small.factor) ?? findSheetQr(imageData);
      if (!qr) throw new SheetReadError('Procurando o QR Code da folha...');
      const folha = await getFolha(qr.code);
      return { code: qr.code, reading: readAnswers(imageData, qr, folha) };
    },
    [getFolha]
  );

  const finish = useCallback(
    (result) => {
      stopAll();
      onRead(result);
    },
    [onRead, stopAll]
  );

  const tick = useCallback(async () => {
    if (!activeRef.current) return;
    if (!pausedRef.current) {
      if (!frameCanvasRef.current) frameCanvasRef.current = document.createElement('canvas');
      const frame = grabFrame(videoRef.current, READ_MAX_SIDE, frameCanvasRef.current);
      if (frame) {
        try {
          const result = await readImage(frame);
          // Se a contagem começou enquanto este quadro era lido, ele é descartado.
          if (activeRef.current && !pausedRef.current) {
            setError('');
            if (trackerRef.current.push(result)) {
              finish(result);
              return;
            }
            setHint('Folha encontrada. Segure o celular parado...');
          }
        } catch (err) {
          if (!activeRef.current) return;
          trackerRef.current.push(null);
          if (!(err instanceof SheetReadError)) {
            stopAll();
            setError(err.message || 'Não foi possível ler a folha.');
            return;
          }
          setHint(err.message);
        }
      }
    }
    if (activeRef.current) timerRef.current = setTimeout(tick, SCAN_INTERVAL_MS);
  }, [finish, readImage, stopAll]);

  const turnOn = async () => {
    if (openingCameraRef.current || streamRef.current) return;
    setError('');
    if (!cameraSupported()) {
      setError('A câmera só funciona em página segura (https ou localhost) e em navegador com suporte.');
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    openingCameraRef.current = true;
    setStartingCamera(true);
    try {
      const stream = await startCamera(video, { highRes: true });
      if (videoRef.current !== video) {
        stopCamera(stream, video);
        return;
      }
      streamRef.current = stream;
      setCameraOn(true);
      setHint('Enquadre o QR Code e os 4 quadrados pretos do quadro de respostas.');
      trackerRef.current.reset();
      pausedRef.current = false;
      activeRef.current = true;
      timerRef.current = setTimeout(tick, SCAN_INTERVAL_MS);
    } catch (err) {
      if (videoRef.current === video) {
        stopAll();
        setError(describeCameraError(err));
      }
    } finally {
      openingCameraRef.current = false;
      if (videoRef.current === video) setStartingCamera(false);
    }
  };

  // Contagem regressiva: pausa o automático, conta 3, 2, 1 e lê a melhor imagem disponível.
  const startCountdown = async () => {
    if (!cameraOn || countdown !== null || capturing) return;
    pausedRef.current = true;
    trackerRef.current.reset();
    setError('');
    for (let n = COUNTDOWN_SECONDS; n > 0; n--) {
      setCountdown(n);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!activeRef.current) return;
    }
    setCountdown(null);
    setCapturing(true);
    try {
      let result = null;
      // Foto do sensor (mais pixels); se não houver suporte ou não ler, usa o quadro do vídeo.
      const blob = await takeStillPhoto(streamRef.current);
      if (blob && activeRef.current) {
        try {
          const { imageData } = await loadSheetPhoto(blob);
          result = await readImage(imageData);
        } catch (err) {
          if (!(err instanceof SheetReadError)) throw err;
        }
      }
      if (!result && activeRef.current) {
        const frame = grabFrame(videoRef.current, READ_MAX_SIDE);
        if (!frame) throw new SheetReadError('A câmera ainda não mostrou a imagem. Tente de novo.');
        result = await readImage(frame);
      }
      if (result && activeRef.current) finish(result);
    } catch (err) {
      if (!activeRef.current) return;
      setError(err instanceof SheetReadError ? err.message : 'Não foi possível ler a folha. Tente de novo.');
      setCapturing(false);
      pausedRef.current = false;
    }
  };

  const close = () => {
    stopAll();
    onClose?.();
  };

  return (
    <div>
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          minHeight: 220,
          background: 'oklch(20% 0.02 250)',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 12,
        }}
      >
        {/* contain: a pessoa vê exatamente o que vai ser lido, sem cortar as bordas do quadro */}
        <video ref={videoRef} playsInline muted aria-label="Imagem da câmera" style={{ width: '100%', display: 'block', objectFit: 'contain' }} />
        {cameraOn && (
          <div
            aria-hidden="true"
            style={{ position: 'absolute', inset: '6%', border: '2px dashed rgba(255,255,255,0.7)', borderRadius: 8, pointerEvents: 'none' }}
          />
        )}
        {countdown !== null && (
          <div
            role="status"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.35)',
              color: 'white',
            }}
          >
            <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1 }}>{countdown}</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>Fique parado</div>
          </div>
        )}
        {capturing && (
          <div role="status" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', color: 'white', fontSize: 15, fontWeight: 600 }}>
            Lendo a folha...
          </div>
        )}
        {!cameraOn && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13.5, opacity: 0.9 }}>
            Câmera desligada
          </div>
        )}
      </div>

      <div aria-live="polite" style={{ fontSize: 13.5, color: 'var(--muted-2)', marginBottom: 12, minHeight: 20 }}>
        {cameraOn ? hint : 'Aproxime até o QR Code e o quadro de respostas ocuparem a tela, com boa luz. Não precisa aparecer a folha inteira.'}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {cameraOn ? (
          <>
            <PrimaryButton type="button" onClick={startCountdown} disabled={countdown !== null || capturing}>
              Ler em {COUNTDOWN_SECONDS} s
            </PrimaryButton>
            <SecondaryButton type="button" onClick={close}>
              Desligar câmera
            </SecondaryButton>
          </>
        ) : (
          <>
            <PrimaryButton type="button" onClick={turnOn} disabled={startingCamera}>
              {startingCamera ? 'Ligando câmera…' : 'Ligar câmera'}
            </PrimaryButton>
            {onClose && (
              <SecondaryButton type="button" onClick={close}>
                Cancelar
              </SecondaryButton>
            )}
          </>
        )}
      </div>
      {error && <div style={{ marginTop: 12, fontSize: 13.5, color: 'var(--red-text)' }}>{error}</div>}
    </div>
  );
}
