import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { LogoMark } from '../components/icons';
import { TextInput } from '../components/ui';

export default function Login() {
  const { login, register, bootstrapAdministrator } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  useEffect(() => {
    apiRequest('/auth/bootstrap-status')
      .then((result) => setNeedsBootstrap(Boolean(result.needsBootstrap)))
      .catch(() => setNeedsBootstrap(false));
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      let user;
      if (mode === 'register') {
        user = await register(email, password);
      } else if (mode === 'bootstrap') {
        user = await bootstrapAdministrator({ name, email, password });
        setNeedsBootstrap(false);
      } else {
        user = await login(email, password);
      }
      navigate(user.role === 'ADMINISTRADOR' ? '/admin' : '/questoes', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível entrar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setPassword('');
  };

  const title = mode === 'bootstrap'
    ? 'Configurar administrador'
    : mode === 'register'
      ? 'Ativar convite'
      : 'Sistema de Geração de Provas';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 44,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ margin: '0 auto 18px', width: 44 }}>
            <LogoMark />
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            {title}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            {mode === 'login' ? 'Acesso do professor ou administrador' : mode === 'register' ? 'Use o e-mail que recebeu o convite' : 'Disponível somente antes do primeiro cadastro'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'bootstrap' && (
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'oklch(35% 0.02 250)', marginBottom: 6 }}>
                Nome completo
              </label>
              <TextInput
                type="text"
                placeholder="Nome do administrador"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'oklch(35% 0.02 250)', marginBottom: 6 }}>
              E-mail institucional
            </label>
            <TextInput
              type="email"
              placeholder="nome@catolicasc.org.br"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'oklch(35% 0.02 250)', marginBottom: 6 }}>
              Senha
            </label>
            <TextInput
              type="password"
              placeholder="Mínimo de 8 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'login' ? undefined : 8}
              required
            />
          </div>
          {error && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--red-text-strong)' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: 12,
              border: 'none',
              borderRadius: 8,
              background: 'var(--navy)',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              marginTop: 4,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar senha e entrar' : 'Criar administrador'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 22, fontSize: 13 }}>
          {mode !== 'login' && (
            <button type="button" onClick={() => changeMode('login')} style={linkStyle}>
              Voltar para o login
            </button>
          )}
          {mode === 'login' && (
            <>
              <button type="button" onClick={() => changeMode('register')} style={linkStyle}>
                Primeiro acesso? Ative seu convite
              </button>
              {needsBootstrap && (
                <button type="button" onClick={() => changeMode('bootstrap')} style={linkStyle}>
                  Configurar o primeiro administrador
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const linkStyle = {
  border: 'none',
  padding: 0,
  background: 'transparent',
  color: 'var(--navy)',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
