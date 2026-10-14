import { useMemo } from 'react';
import { getQrMatrix } from '../utils/qrCode';
import { buildQrPath } from '../utils/qrPath';

// QR Code real da cópia da prova, desenhado em SVG (nítido em qualquer tamanho).
// size: lado em pixels. margin: margem branca em módulos; o padrão (4) é o mínimo que
// o padrão do QR Code exige para a leitura funcionar, então não vale reduzir.
export default function QrCode({ code, size = 96, margin = 4, title }) {
  const qr = useMemo(() => {
    try {
      const { size: modules, isDark } = getQrMatrix(code);
      return { modules, path: buildQrPath(modules, isDark) };
    } catch {
      return null;
    }
  }, [code]);

  if (!qr) return null;
  const total = qr.modules + margin * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-margin} ${-margin} ${total} ${total}`}
      role="img"
      aria-label={title || `QR Code da prova ${code}`}
      shapeRendering="crispEdges"
      style={{ display: 'block' }}
    >
      <rect x={-margin} y={-margin} width={total} height={total} fill="#ffffff" />
      <path d={qr.path} fill="#000000" />
    </svg>
  );
}
