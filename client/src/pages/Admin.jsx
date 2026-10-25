
import { useState } from 'react';
import { useData } from '../context/DataContext';
import { PageHeader, PrimaryButton, Badge, FormField, TextInput } from '../components/ui';
import AdminUserModal from '../components/AdminUserModal';
import { initials } from '../utils/status';

export default function Admin() {
  const {
    adminUsers,
    adminUsersLoading,
    adminUsersError,
    addAdminUser,
    updateAdminUser,
    removeAdminUser,
    settings,
    updateSettings,
  } = useData();

  const [institutionName, setInstitutionName] = useState(settings.institutionName);
  const [defaultPeriod, setDefaultPeriod] = useState(settings.defaultPeriod);
  const [userModal, setUserModal] = useState(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userActionError, setUserActionError] = useState('');

  const handleRemove = async (id, name) => {
    if (!window.confirm(`Remover ${name} do sistema?`)) return;

    setUserActionError('');

    try {
      await removeAdminUser(id);
    } catch (error) {
      setUserActionError(error.message || 'Não foi possível remover o usuário.');
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    updateSettings({ institutionName, defaultPeriod });
  };

  const handleSaveUser = async (data) => {
    setSavingUser(true);
    setUserActionError('');

    try {
      if (userModal?.id) {
        await updateAdminUser(userModal.id, data);
      } else {
        await addAdminUser(data);
      }

      setUserModal(null);
    } catch (error) {
      setUserActionError(error.message || 'Não foi possível salvar o usuário.');
    } finally {
      setSavingUser(false);
    }
  };

  const editingId = userModal?.id;
  const existingEmails = adminUsers
    .filter((u) => u.id !== editingId)
    .map((u) => u.email.toLowerCase());

  return (
    <div>
      <PageHeader
        title="Administração"
        description="Gerencie usuários e configurações gerais do sistema."
        actions={
          <PrimaryButton onClick={() => {
            setUserActionError('');
            setUserModal({});
          }}>
            + Adicionar usuário
          </PrimaryButton>
        }
      />

      <div style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 24,
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-light)',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--text-strong)',
        }}>
          Usuários
        </div>

        {adminUsersLoading && (
          <p style={{ padding: '16px 20px' }}>Carregando usuários do banco...</p>
        )}

        {!adminUsersLoading && adminUsersError && (
          <p role="alert" style={{ padding: '16px 20px', color: 'var(--red-text)' }}>
            Não foi possível carregar os usuários: {adminUsersError}
          </p>
        )}

        {!adminUsersLoading && !adminUsersError && adminUsers.length === 0 && (
          <p style={{ padding: '16px 20px' }}>
            Nenhum usuário cadastrado no banco de dados.
          </p>
        )}

        {!adminUsersLoading && !adminUsersError && adminUsers.map((u) => (
          <div
            key={u.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-lighter)',
              fontSize: 14,
            }}
          >
            <div style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'var(--navy-chip-bg)',
              color: 'var(--navy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {initials(u.name)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
                {u.name}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 2 }}>
                {u.email}
              </div>
            </div>

            <Badge status={u.role} />
            <Badge status={u.status} />

            <div style={{ display: 'flex', gap: 14, fontSize: 13, flexShrink: 0 }}>
              <a
                href="#"
                style={{ textDecoration: 'none', fontWeight: 600 }}
                onClick={(e) => {
                  e.preventDefault();
                  setUserActionError('');
                  setUserModal(u);
                }}
              >
                Editar
              </a>

              <a
                href="#"
                style={{ textDecoration: 'none', fontWeight: 600, color: 'var(--red-text)' }}
                onClick={(e) => {
                  e.preventDefault();
                  handleRemove(u.id, u.name);
                }}
              >
                Remover
              </a>
            </div>
          </div>
        ))}
      </div>

      {userActionError && (
        <p role="alert" style={{ color: 'var(--red-text)', marginBottom: 16 }}>
          {userActionError}
        </p>
      )}

      <form onSubmit={handleSaveSettings}>
        <div style={{
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 26,
          maxWidth: 520,
        }}>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text-strong)',
            marginBottom: 16,
          }}>
            Configurações gerais
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormField label="Nome da instituição">
              <TextInput
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
              />
            </FormField>

            <FormField label="Período letivo padrão">
              <TextInput
                value={defaultPeriod}
                onChange={(e) => setDefaultPeriod(e.target.value)}
                style={{ width: 160 }}
              />
            </FormField>
          </div>

          <PrimaryButton type="submit" style={{ marginTop: 22 }}>
            Salvar configurações
          </PrimaryButton>
        </div>
      </form>

      {userModal && (
        <AdminUserModal
          user={userModal.id ? userModal : null}
          existingEmails={existingEmails}
          onSave={handleSaveUser}
          onCancel={() => {
            if (!savingUser) setUserModal(null);
          }}
        />
      )}
    </div>
  );
}