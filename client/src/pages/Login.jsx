import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogoMark } from '../components/icons';
import { TextInput } from '../components/ui';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const user = mode === 'register'
        ? await register({ name, email, password })
        : await login(email, password);

      navigate('/questoes', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível concluir o acesso. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setPassword('');
  };

  const isRegister = mode === 'register';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 44, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ margin: '0 auto 18px', width: 44 }}>
            <LogoMark />
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            {isRegister ? 'Criar conta' : 'Sistema de Geração de Provas'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            {isRegister ? 'Cadastre-se para começar a usar o sistema' : 'Acesso do professor'}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isRegister && (
            <div>
              <label style={labelStyle}>Nome completo</label>
              <TextInput
                type="text"
                placeholder="Seu nome completo"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>E-mail</label>
            <TextInput
              type="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Senha</label>
            <TextInput
              type="password"
              placeholder={isRegister ? 'Mínimo de 8 caracteres' : 'Sua senha'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 8 : undefined}
              required
            />
          </div>

          {error && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--red-text-strong)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} style={{
            width: '100%', padding: 12, border: 'none', borderRadius: 8,
            background: 'var(--navy)', color: 'white', fontSize: 14,
            fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
            fontFamily: 'inherit', marginTop: 4, opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? 'Aguarde...' : isRegister ? 'Criar conta e entrar' : 'Entrar'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 22, fontSize: 13 }}>
          {isRegister ? (
            <button type="button" onClick={() => changeMode('login')} style={linkStyle}>
              Já tem uma conta? Entrar
            </button>
          ) : (
            <button type="button" onClick={() => changeMode('register')} style={linkStyle}>
              Não tem uma conta? Criar conta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 600,
  color: 'oklch(35% 0.02 250)',
  marginBottom: 6,
};

const linkStyle = {
  border: 'none',
  padding: 0,
  background: 'transparent',
  color: 'var(--navy)',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
