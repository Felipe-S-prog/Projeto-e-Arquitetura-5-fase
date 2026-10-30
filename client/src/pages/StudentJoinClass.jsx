
import { useState } from 'react';
import { apiRequest } from '../services/api';

export default function StudentJoinClass() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [numeroMatricula, setNumeroMatricula] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();
    const codigoLimpo = codigo.trim().toUpperCase();

    if (!nomeLimpo || !emailLimpo || !codigoLimpo) {
      setError('Preencha o nome, o e-mail e o código de convite.');
      return;
    }

    if (!/^[A-F0-9]{8}$/.test(codigoLimpo)) {
      setError('O código deve conter 8 caracteres hexadecimais.');
      return;
    }

    try {
      setLoading(true);

      const result = await apiRequest('/turmas/ingresso', {
        method: 'POST',
        body: JSON.stringify({
          nome: nomeLimpo,
          email: emailLimpo,
          codigo_convite: codigoLimpo,
          numero_matricula: numeroMatricula.trim() || null,
        }),
      });

      setSuccess(
        result?.message ||
          'Matrícula realizada com sucesso!',
      );

      setNome('');
      setEmail('');
      setCodigo('');
      setNumeroMatricula('');
    } catch (err) {
      setError(
        err.message ||
          'Não foi possível entrar na turma. Confira os dados e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        background: 'var(--surface, #f6f7fb)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 480,
          padding: 28,
          background: '#fff',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 16,
          boxShadow: '0 8px 28px rgba(0,0,0,0.06)',
        }}
      >
        <h1 style={{ marginTop: 0, fontSize: 26 }}>
          Entrar em uma turma
        </h1>

        <p style={{ color: 'var(--muted, #667085)', lineHeight: 1.5 }}>
          Preencha seus dados e informe o código de convite fornecido
          pelo professor.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          <div>
            <label
              htmlFor="student-name"
              style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}
            >
              Nome completo
            </label>
            <input
              id="student-name"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              maxLength={120}
              autoComplete="name"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="student-email"
              style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}
            >
              E-mail
            </label>
            <input
              id="student-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={160}
              autoComplete="email"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="invite-code"
              style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}
            >
              Código de convite
            </label>
            <input
              id="invite-code"
              value={codigo}
              onChange={(event) =>
                setCodigo(event.target.value.toUpperCase().slice(0, 8))
              }
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              required
              placeholder="Ex.: A1B2C3D4"
              style={{
                ...inputStyle,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="student-registration"
              style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}
            >
              Número de matrícula (opcional)
            </label>
            <input
              id="student-registration"
              value={numeroMatricula}
              onChange={(event) =>
                setNumeroMatricula(event.target.value)
              }
              maxLength={30}
              autoComplete="off"
              style={inputStyle}
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#fef3f2',
                color: '#b42318',
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#ecfdf3',
                color: '#027a48',
              }}
            >
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px 16px',
              border: 0,
              borderRadius: 8,
              background: loading ? '#98a2b3' : '#344054',
              color: '#fff',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Entrando na turma...' : 'Entrar na turma'}
          </button>
        </form>
      </section>
    </main>
  );
}

const inputStyle = {
  boxSizing: 'border-box',
  width: '100%',
  padding: '11px 12px',
  border: '1px solid var(--border, #d0d5dd)',
  borderRadius: 8,
  font: 'inherit',
};