import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogoMark,
  BubbleIcon,
  ExamSheetIcon,
  QrMarkerIcon,
  ClassroomGridIcon,
  AdminIcon,
  CorrectionIcon,
  ReportBarsIcon,
} from '../components/icons';
import './AppLayout.css';

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
        color: isActive
          ? 'oklch(28% 0.1 250)'
          : 'oklch(38% 0.02 250)',
      })}
    >
      {icon}
      {children}
    </NavLink>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: 'var(--faint-2)',
        padding: '14px 10px 6px',
      }}
    >
      {children}
    </div>
  );
}

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U'
  );
}

export default function AppLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const profileRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const displayName = String(
    user?.name ||
      user?.nome ||
      user?.email?.split('@')[0] ||
      'Usuário',
  );

  const role = user?.role || user?.papel;

  const roleLabel =
    role === 'ADMINISTRADOR' || role === 'Administrador'
      ? 'Administrador'
      : role === 'PROFESSOR' || role === 'Professor'
        ? 'Professor'
        : role || 'Usuário';

  const initials = getInitials(displayName);
  const avatarUrl =
    user?.avatarUrl || user?.photoUrl || user?.fotoUrl || '';

  useEffect(() => {
    if (!profileOpen) return undefined;

    function handleOutsideClick(event) {
      if (!profileRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [profileOpen]);

  const handleLogout = async () => {
    setProfileOpen(false);

    try {
      await logout();
    } catch {
      // A sessão local também deve ser encerrada se a API estiver indisponível.
    }

    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 8px 24px',
          }}
        >
          <LogoMark size={30} />

          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--ink)',
              lineHeight: 1.2,
            }}
          >
            SGP
            <br />
            <span
              style={{
                fontWeight: 500,
                fontSize: 11,
                color: 'var(--muted-3)',
              }}
            >
              Gestão de Provas
            </span>
          </div>
        </div>

        {role === 'PROFESSOR' && (
          <>
            <SectionLabel>CONTEÚDO</SectionLabel>

            <NavItem to="/questoes" icon={<BubbleIcon size={16} />}>
              Questões
            </NavItem>

            <NavItem
              to="/provas"
              icon={<ExamSheetIcon width={14} height={16} />}
            >
              Provas
            </NavItem>

            <SectionLabel>OPERAÇÃO</SectionLabel>

            <NavItem to="/aplicacoes" icon={<QrMarkerIcon size={16} />}>
              Aplicações
            </NavItem>

            <NavItem
              to="/turmas"
              icon={<ClassroomGridIcon width={18} height={14} />}
            >
              Turmas
            </NavItem>

            <SectionLabel>AVALIAÇÃO</SectionLabel>

            <NavItem to="/correcao" icon={<CorrectionIcon size={16} />}>
              Correção
            </NavItem>

            <NavItem
              to="/relatorios"
              icon={<ReportBarsIcon height={15} />}
            >
              Relatórios
            </NavItem>
          </>
        )}

        {role === 'ADMINISTRADOR' && (
          <>
            <SectionLabel>SISTEMA</SectionLabel>

            <NavItem to="/admin" icon={<AdminIcon size={16} />}>
              Administração
            </NavItem>
          </>
        )}

        <div className="app-sidebar-spacer" />
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="profile-menu" ref={profileRef}>
            <button
              type="button"
              className="profile-trigger"
              onClick={() => setProfileOpen((open) => !open)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-label={`Conta de ${displayName}`}
            >
              <span className="profile-avatar" aria-hidden="true">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" />
                ) : (
                  initials
                )}
              </span>

              <span className="profile-details">
                <span className="profile-name">{displayName}</span>
                <span className="profile-role">{roleLabel}</span>
              </span>

              <span className="profile-chevron" aria-hidden="true">
                {profileOpen ? '▴' : '▾'}
              </span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown" role="menu">
                <div className="profile-dropdown-info">
                  <strong>{displayName}</strong>

                  {user?.email && <span>{user.email}</span>}

                  <span className="profile-dropdown-role">
                    {roleLabel}
                  </span>
                </div>

                <button
                  type="button"
                  className="profile-logout"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  Sair da conta
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}