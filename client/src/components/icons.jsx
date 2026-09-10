// Domain-specific glyphs (exam sheets, answer bubbles, QR markers, classroom
// grids) built from plain divs, mirroring the original prototype's approach
// so the interface reads as an assessment tool even with labels removed.

export function LogoMark({ size = 44 }) {
  const s = size / 44;
  return (
    <div style={{ width: size, height: size, borderRadius: 12 * s, background: 'var(--navy)', position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: 13 * s,
          top: 9 * s,
          width: 19 * s,
          height: 24 * s,
          background: 'white',
          clipPath: 'polygon(0 0, 65% 0, 100% 28%, 100% 100%, 0 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 17 * s,
          top: 29 * s,
          width: 6 * s,
          height: 6 * s,
          borderRadius: '50%',
          background: 'var(--navy)',
        }}
      />
    </div>
  );
}

export function BubbleIcon({ size = 14 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: '2px solid currentColor', position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: size * 0.21, borderRadius: '50%', background: 'currentColor' }} />
    </div>
  );
}

export function ExamSheetIcon({ width = 14, height = 16 }) {
  return (
    <div
      style={{
        width,
        height,
        border: '1.6px solid currentColor',
        borderRadius: 2,
        position: 'relative',
        flexShrink: 0,
        clipPath: 'polygon(0 0, 65% 0, 100% 30%, 100% 100%, 0 100%)',
      }}
    >
      <div style={{ position: 'absolute', top: height * 0.38, left: width * 0.14, width: width * 0.57, height: 1.4, background: 'currentColor', borderRadius: 1 }} />
      <div style={{ position: 'absolute', top: height * 0.6, left: width * 0.14, width: width * 0.43, height: 1.4, background: 'currentColor', borderRadius: 1 }} />
    </div>
  );
}

export function QrMarkerIcon({ size = 16 }) {
  const c = size * 0.375;
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: c, height: c, border: '1.6px solid currentColor', borderRadius: 1 }} />
      <div style={{ position: 'absolute', right: 0, top: 0, width: c, height: c, border: '1.6px solid currentColor', borderRadius: 1 }} />
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: c, height: c, border: '1.6px solid currentColor', borderRadius: 1 }} />
      <div style={{ position: 'absolute', right: 1, bottom: 1, width: c * 0.65, height: c * 0.65, background: 'currentColor', borderRadius: 1 }} />
    </div>
  );
}

export function ClassroomGridIcon({ width = 18, height = 14 }) {
  return (
    <div
      style={{
        width,
        height,
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gridTemplateRows: 'repeat(2,1fr)',
        gap: 2.5,
        alignContent: 'center',
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor' }} />
      ))}
    </div>
  );
}

export function AdminIcon({ size = 16 }) {
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', left: size * 0.25, top: 0, width: size * 0.5, height: size * 0.5, borderRadius: '50%', border: '1.6px solid currentColor' }} />
      <div style={{ position: 'absolute', left: size * 0.03, top: size * 0.56, width: size * 0.94, height: size * 0.38, borderRadius: '3px 3px 0 0', border: '1.6px solid currentColor', borderBottom: 'none' }} />
    </div>
  );
}

export function StackedSheetsIcon({ size = 14 }) {
  const w = size, h = size * 1.14;
  return (
    <div style={{ width: size + 3, height: h + 3, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 3, top: 3, width: w, height: h, border: '1.6px solid currentColor', borderRadius: 2, background: 'var(--icon-tile-bg)' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, border: '1.6px solid currentColor', borderRadius: 2, background: 'var(--icon-tile-bg)' }} />
    </div>
  );
}

export function CorrectionIcon({ size = 15 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', border: '1.8px solid currentColor', position: 'relative' }}>
      <div style={{ position: 'absolute', left: size * 0.2, top: size * 0.47, width: size * 0.27, height: 1.6, background: 'currentColor', transform: 'rotate(45deg)', borderRadius: 1 }} />
      <div style={{ position: 'absolute', left: size * 0.37, top: size * 0.27, width: size * 0.47, height: 1.6, background: 'currentColor', transform: 'rotate(-45deg)', borderRadius: 1 }} />
    </div>
  );
}

export function ReportBarsIcon({ height = 15 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height }}>
      <div style={{ width: 3, height: '60%', background: 'currentColor', borderRadius: 1 }} />
      <div style={{ width: 3, height: '100%', background: 'currentColor', borderRadius: 1 }} />
      <div style={{ width: 3, height: '40%', background: 'currentColor', borderRadius: 1 }} />
    </div>
  );
}
