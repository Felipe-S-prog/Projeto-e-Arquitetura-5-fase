function domainsFromEnv(value, fallback) {
  return (value ?? fallback)
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

export function emailAllowedForRole(email, role, config) {
  const domain = typeof email === 'string' ? email.trim().toLowerCase().split('@').at(-1) : '';
  if (!domain || !['ADMINISTRADOR', 'PROFESSOR'].includes(role)) return false;

  const domains = role === 'ADMINISTRADOR'
    ? config?.auth?.adminEmailDomains ?? domainsFromEnv(process.env.ADMIN_EMAIL_DOMAINS, 'catolicasc.org.br')
    : config?.auth?.professorEmailDomains ?? domainsFromEnv(process.env.PROFESSOR_EMAIL_DOMAINS, 'catolicasc.org.br,catolicasc.edu.br');

  return domains.includes(domain);
}
