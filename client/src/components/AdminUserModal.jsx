import { useState } from 'react';
import { PrimaryButton, SecondaryButton, FormField, TextInput, Select } from './ui';

const ROLES = ['Professor', 'Administrador'];
const STATUSES = ['Ativo', 'Convidado'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Modal de criação/edição de usuário (professor ou administrador). Recebe
// `user` preenchido quando é edição, ou `null`/`undefined` quando é um novo
// cadastro. `existingEmails` já deve vir sem o e-mail do próprio usuário
// (no caso de edição), para permitir salvar sem trocar o e-mail.
export default function AdminUserModal({ user, existingEmails, onSave, onCancel }) {
  const isEditing = Boolean(user);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState(user?.role || 'Professor');
  const [status, setStatus] = useState(user?.status || 'Convidado');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError('Informe o nome completo.');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (existingEmails.includes(trimmedEmail)) {
      setError('Já existe um usuário cadastrado com esse e-mail.');
      return;
    }

    onSave({
      name: trimmedName,
      email: trimmedEmail,
      role,
      status: isEditing ? status : 'Convidado',
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'oklch(20% 0.02 250 / 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ background: 'white', borderRadius: 14, padding: 30, width: '100%', maxWidth: 440 }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
          {isEditing ? 'Editar usuário' : 'Adicionar usuário'}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--muted-2)', marginBottom: 20 }}>
          {isEditing
            ? 'Atualize os dados deste professor ou administrador.'
            : 'Convide um novo professor ou administrador para o sistema.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: error ? 12 : 22 }}>
          <FormField label="Nome completo">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marcos Vinícius Tavares"
              autoFocus
            />
          </FormField>
          <FormField label="E-mail institucional">
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@catolicasc.org.br"
            />
          </FormField>
          <FormField label="Papel">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </FormField>
          {isEditing && (
            <FormField label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </div>

        {error && <div style={{ fontSize: 13, color: 'var(--red-text-strong)', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <PrimaryButton type="submit" style={{ flex: 1 }}>
            {isEditing ? 'Salvar alterações' : 'Adicionar usuário'}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={onCancel} style={{ flex: 1 }}>
            Cancelar
          </SecondaryButton>
        </div>
      </form>
    </div>
  );
}
