import { Link, useNavigate } from 'react-router-dom';
import { statusColors } from '../utils/status';

// Botão desabilitado fica mais claro e mostra que não dá para clicar.
function disabledLook(disabled) {
  return disabled ? { opacity: 0.55 } : {};
}

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
        ...disabledLook(rest.disabled),
        padding: '11px 18px',
        border: 'none',
        borderRadius: 8,
        background: 'var(--navy)',
        color: 'white',
        fontSize: 14,
        fontWeight: 700,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
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
        ...disabledLook(rest.disabled),
        padding: '11px 18px',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        background: 'white',
        color: 'oklch(30% 0.02 250)',
        fontSize: 14,
        fontWeight: 600,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
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
        ...disabledLook(rest.disabled),
        padding: '10px 16px',
        border: '1px solid var(--red-border)',
        borderRadius: 8,
        background: 'white',
        color: 'var(--red-text-strong)',
        fontSize: 14,
        fontWeight: 600,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
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
  const navigate = useNavigate();
  // O botão Voltar leva ao último nível clicável do caminho.
  const backTo = [...items].reverse().find((item) => item.to)?.to;

  return (
    <div
      style={{
        fontSize: 13,
        marginBottom: 10,
        color: 'var(--muted)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {backTo && (
        <button
          type="button"
          onClick={() => navigate(backTo)}
          style={{
            padding: '4px 10px',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            background: 'white',
            color: 'oklch(30% 0.02 250)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Voltar
        </button>
      )}
      <div>
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
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26, gap: 16, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</div>
        {description && <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 5 }}>{description}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
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

// Cartão de seção com título, explicação curta e ações à direita (mesmo padrão em todas as telas).
export function SectionCard({ title, hint, actions, children, style }) {
  return (
    <section
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 24,
        marginBottom: 18,
        minWidth: 0,
        ...style,
      }}
    >
      {(title || actions) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            {title && <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{title}</h2>}
            {hint && <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginTop: 4 }}>{hint}</div>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Número em destaque (resumo no topo de listas e relatórios).
export function StatCard({ label, value, detail, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--muted-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--ink)', lineHeight: 1.15 }}>{value}</div>
      {detail && <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 4 }}>{detail}</div>}
    </div>
  );
}

// Grade de StatCards que se ajusta à largura (duas colunas no celular).
export function StatGrid({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: 12, marginBottom: 18 }}>
      {children}
    </div>
  );
}

// Escolha entre poucas opções (abas de relatório, filtros de lista, modo de correção).
// Cada opção é um botão com aria-pressed, então funciona com teclado e leitor de tela.
export function SegmentedControl({ options, value, onChange, label, style }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', ...style }}>
      {options.map(({ key, label: text }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(key)}
            style={{
              padding: '7px 14px',
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              background: active ? 'var(--navy)' : 'white',
              color: active ? 'white' : 'oklch(40% 0.02 250)',
              cursor: 'pointer',
              border: active ? '1px solid var(--navy)' : '1px solid var(--border)',
            }}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

// Mensagem de erro: role="alert" faz o leitor de tela anunciar assim que ela aparece.
export function ErrorMessage({ children, style }) {
  if (!children) return null;
  return (
    <div role="alert" style={{ marginTop: 12, fontSize: 13.5, color: 'var(--red-text)', ...style }}>
      {children}
    </div>
  );
}

// Tabela de dados: rola para o lado dentro do cartão quando não cabe (celular), sem levar a tela junto.
export function DataTable({ children, label }) {
  return (
    <div style={{ position: 'relative', overflowX: 'auto', margin: '0 -4px' }}>
      <table aria-label={label} style={{ width: '100%', borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align = 'left', style }) {
  return (
    <th scope="col" style={{ padding: '9px 8px', fontSize: 12, fontWeight: 600, color: 'var(--muted-3)', textAlign: align, whiteSpace: 'nowrap', ...style }}>
      {children}
    </th>
  );
}

export function Td({ children, align = 'left', style, ...rest }) {
  return (
    <td {...rest} style={{ padding: '10px 8px', fontSize: 13.5, borderTop: '1px solid var(--border-light)', textAlign: align, ...style }}>
      {children}
    </td>
  );
}

// Ação de uma linha de tabela (abrir, corrigir, ver detalhes): link com cara de botão pequeno.
export function RowLink({ to, children }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-block',
        padding: '6px 12px',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        background: 'white',
        color: 'oklch(30% 0.02 250)',
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Link>
  );
}
