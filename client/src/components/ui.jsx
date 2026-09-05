import { Link } from 'react-router-dom';
import { statusColors } from '../utils/status';

export function Badge({ status, children }) {
  const [bg, color] = statusColors(status);
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        padding: '3px 9px',
        borderRadius: 100,
        background: bg,
        color,
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {children ?? status}
    </span>
  );
}

export function PrimaryButton({ children, style, ...rest }) {
  return (
    <button
      {...rest}
      style={{
        padding: '11px 18px',
        border: 'none',
        borderRadius: 8,
        background: 'var(--navy)',
        color: 'white',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, style, ...rest }) {
  return (
    <button
      {...rest}
      style={{
        padding: '11px 18px',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        background: 'white',
        color: 'oklch(30% 0.02 250)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, style, ...rest }) {
  return (
    <button
      {...rest}
      style={{
        padding: '10px 16px',
        border: '1px solid var(--red-border)',
        borderRadius: 8,
        background: 'white',
        color: 'var(--red-text-strong)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        cursor: onClick ? 'pointer' : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div
      style={{
        padding: 24,
        textAlign: 'center',
        color: 'var(--muted-3)',
        fontSize: 13.5,
        background: 'white',
        border: '1px dashed var(--border-dashed)',
        borderRadius: 12,
      }}
    >
      {children}
    </div>
  );
}

export function Breadcrumb({ items }) {
  return (
    <div style={{ fontSize: 13, marginBottom: 10, color: 'var(--muted)' }}>
      {items.map((item, i) => (
        <span key={i}>
          {item.to ? (
            <Link to={item.to} style={{ textDecoration: 'none' }}>
              {item.label}
            </Link>
          ) : (
            item.label
          )}
          {i < items.length - 1 && ' / '}
        </span>
      ))}
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26, gap: 16 }}>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</div>
        {description && <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 5 }}>{description}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

export function FormField({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'oklch(35% 0.02 250)', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'oklch(58% 0.02 250)', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '11px 13px',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'white',
};

export function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}

export function TextArea(props) {
  return <textarea {...props} style={{ ...inputStyle, resize: 'vertical', ...props.style }} />;
}

export function Select(props) {
  return <select {...props} style={{ ...inputStyle, ...props.style }} />;
}
