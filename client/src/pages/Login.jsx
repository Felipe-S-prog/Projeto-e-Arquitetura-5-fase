import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogoMark } from '../components/icons';
import { TextInput } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    login();
    navigate('/questoes');
  };

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
            Sistema de Geração de Provas
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>Acesso do professor</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'oklch(35% 0.02 250)', marginBottom: 6 }}>
              E-mail
            </label>
            <TextInput
              type="email"
              placeholder="nome@catolicasc.org.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'oklch(35% 0.02 250)', marginBottom: 6 }}>
              Senha
            </label>
            <TextInput
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            style={{
              width: '100%',
              padding: 12,
              border: 'none',
              borderRadius: 8,
              background: 'var(--navy)',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginTop: 4,
            }}
          >
            Entrar
          </button>
          <a href="#" style={{ fontSize: 13, textAlign: 'center', textDecoration: 'none' }}>
            Esqueci minha senha
          </a>
        </form>
      </div>
    </div>
  );
}
