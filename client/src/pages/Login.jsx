
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { LogoMark } from '../components/icons';
import { TextInput } from '../components/ui';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFeedback('');
    setSubmitting(true);

    try {
      if (mode === 'forgot') {
        const response = await apiRequest('/auth/forgot-password', {
          method: 'POST',
          body: { email },
        });

        setFeedback(response.message);
        setResetToken(response.resetToken || '');
        return;
      }

      if (mode === 'reset') {
        if (password !== confirmPassword) {
          setError('As senhas não coincidem.');
          return;
        }

        const response = await apiRequest('/auth/reset-password', {
          method: 'POST',
          body: { token: resetToken, password },
        });

        setMode('login');
        setResetToken('');
        setPassword('');
        setConfirmPassword('');
        setFeedback(response.message);
        return;
      }

      if (mode === 'register') {
        await register({ name, email, password });
      } else {
        await login(email, password);
      }

      navigate('/questoes', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível concluir a operação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setFeedback('');
    setPassword('');
    setConfirmPassword('');

    if (nextMode === 'login' || nextMode === 'register') {
      setResetToken('');
    }
  };

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  const title = isRegister
    ? 'Criar conta'
    : isForgot
      ? 'Recuperar senha'
      : isReset
        ? 'Redefinir senha'
        : 'Sistema de Geração de Provas';

  const subtitle = isRegister
    ? 'Cadastre-se para começar a usar o sistema'
    : isForgot
      ? 'Informe seu e-mail para recuperar o acesso'
      : isReset
        ? 'Informe o token e sua nova senha'
        : 'Acesso do professor';

  const submitLabel = isRegister
    ? 'Criar conta e entrar'
    : isForgot
      ? 'Enviar instruções'
      : isReset
        ? 'Redefinir senha'
        : 'Entrar';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 44, boxShadow: 'var(--shadow-card)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ margin: '0 auto 18px', width: 44 }}>
            <LogoMark />
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            {title}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 6 }}>
            {subtitle}
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

          {!isReset && (
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
          )}

          {isReset && (
            <div>
              <label style={labelStyle}>Token de recuperação</label>
              <TextInput
                type="text"
                placeholder="Cole seu token de recuperação"
                value={resetToken}
                onChange={(event) => setResetToken(event.target.value)}
                required
              />
            </div>
          )}

          {!isForgot && (
            <div>
              <label style={labelStyle}>{isReset ? 'Nova senha' : 'Senha'}</label>
              <TextInput
                type="password"
                placeholder={
                  isRegister || isReset
                    ? 'Mínimo de 8 caracteres'
                    : 'Sua senha'
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isRegister || isReset ? 'new-password' : 'current-password'}
                minLength={isRegister || isReset ? 8 : undefined}
                required
              />
            </div>
          )}

          {isReset && (
            <div>
              <label style={labelStyle}>Confirmar nova senha</label>
              <TextInput
                type="password"
                placeholder="Digite novamente sua senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          )}

          {feedback && (
            <div role="status" style={{ fontSize: 13, color: 'var(--muted)' }}>
              {feedback}
            </div>
          )}

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
            {submitting ? 'Aguarde...' : submitLabel}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 22, fontSize: 13 }}>
          {mode === 'login' && (
            <>
              <button type="button" onClick={() => changeMode('forgot')} style={secondaryButtonStyle}>
                Esqueceu sua senha?
              </button>
              <button type="button" onClick={() => changeMode('register')} style={secondaryButtonStyle}>
                Não tem uma conta? Criar conta
              </button>
            </>
          )}

          {isRegister && (
            <button type="button" onClick={() => changeMode('login')} style={linkStyle}>
              Já tem uma conta? Entrar
            </button>
          )}

          {isForgot && (
            <>
              {resetToken && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setError('');
                  }}
                  style={linkStyle}
                >
                  Continuar para redefinir senha
                </button>
              )}
              <button type="button" onClick={() => changeMode('reset')} style={linkStyle}>
                Já tenho um token de recuperação
              </button>
              <button type="button" onClick={() => changeMode('login')} style={linkStyle}>
                Voltar para entrar
              </button>
            </>
          )}

          {isReset && (
            <button type="button" onClick={() => changeMode('login')} style={linkStyle}>
              Voltar para entrar
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

const secondaryButtonStyle = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'white',
  color: 'var(--navy)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};