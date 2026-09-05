import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogoMark, BubbleIcon, ExamSheetIcon, QrMarkerIcon, ClassroomGridIcon, AdminIcon } from '../components/icons';

function NavItem({ to, icon, children }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        textDecoration: 'none',
        background: isActive ? 'var(--navy-chip-bg)' : 'transparent',
        color: isActive ? 'oklch(28% 0.1 250)' : 'oklch(38% 0.02 250)',
      })}
    >
      {icon}
      {children}
    </NavLink>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--faint-2)', padding: '14px 10px 6px' }}>
      {children}
    </div>
  );
}

export default function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <div
        style={{
          width: 236,
          flexShrink: 0,
          background: 'white',
          borderRight: '1px solid var(--border-light)',
          padding: '22px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 24px' }}>
          <LogoMark size={30} />
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>
            SGP
            <br />
            <span style={{ fontWeight: 500, fontSize: 11, color: 'var(--muted-3)' }}>Professor</span>
          </div>
        </div>

        <SectionLabel>CONTEÚDO</SectionLabel>
        <NavItem to="/questoes" icon={<BubbleIcon size={16} />}>
          Questões
        </NavItem>
        <NavItem to="/provas" icon={<ExamSheetIcon width={14} height={16} />}>
          Provas
        </NavItem>

        <SectionLabel>OPERAÇÃO</SectionLabel>
        <NavItem to="/aplicacoes" icon={<QrMarkerIcon size={16} />}>
          Aplicações
        </NavItem>
        <NavItem to="/turmas" icon={<ClassroomGridIcon width={18} height={14} />}>
          Turmas
        </NavItem>

        <SectionLabel>SISTEMA</SectionLabel>
        <NavItem to="/admin" icon={<AdminIcon size={16} />}>
          Administração
        </NavItem>

        <div style={{ flex: 1 }} />
        <div
          onClick={handleLogout}
          style={{ padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--muted-2)' }}
        >
          Sair
        </div>
      </div>

      <div style={{ flex: 1, padding: '36px 44px 60px', maxWidth: 1180, position: 'relative' }}>
        <Outlet />
      </div>
    </div>
  );
}
