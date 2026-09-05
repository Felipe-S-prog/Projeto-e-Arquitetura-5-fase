import { useState } from 'react';
import { useData } from '../context/DataContext';
import { PageHeader, PrimaryButton, Badge, FormField, TextInput } from '../components/ui';
import { initials } from '../utils/status';

export default function Admin() {
  const { adminUsers, removeAdminUser, settings, updateSettings } = useData();
  const [institutionName, setInstitutionName] = useState(settings.institutionName);
  const [defaultPeriod, setDefaultPeriod] = useState(settings.defaultPeriod);

  const handleRemove = (id, name) => {
    if (window.confirm(`Remover ${name} do sistema?`)) removeAdminUser(id);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    updateSettings({ institutionName, defaultPeriod });
  };

  return (
    <div>
      <PageHeader
        title="Administração"
        description="Gerencie usuários e configurações gerais do sistema."
        actions={<PrimaryButton onClick={(e) => e.preventDefault()}>+ Adicionar usuário</PrimaryButton>}
      />

      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>
          Usuários
        </div>
        {adminUsers.map((u) => (
          <div
            key={u.id}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--border-lighter)', fontSize: 14 }}
          >
            <div
              style={{
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
              }}
            >
              {initials(u.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{u.name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 2 }}>{u.email}</div>
            </div>
            <Badge status={u.role} />
            <Badge status={u.status} />
            <div style={{ display: 'flex', gap: 14, fontSize: 13, flexShrink: 0 }}>
              <a href="#" style={{ textDecoration: 'none', fontWeight: 600 }} onClick={(e) => e.preventDefault()}>
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

      <form onSubmit={handleSaveSettings}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 26, maxWidth: 520 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)', marginBottom: 16 }}>Configurações gerais</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormField label="Nome da instituição">
              <TextInput value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} />
            </FormField>
            <FormField label="Período letivo padrão">
              <TextInput value={defaultPeriod} onChange={(e) => setDefaultPeriod(e.target.value)} style={{ width: 160 }} />
            </FormField>
          </div>
          <PrimaryButton type="submit" style={{ marginTop: 22 }}>
            Salvar configurações
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
