// Transforma erros comuns de conexão com o MySQL em mensagens que dizem o que fazer.
export function describeDbError(err, dbConfig) {
  const where = `${dbConfig.host}:${dbConfig.port}`;
  switch (err?.code) {
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
    case 'EHOSTUNREACH':
    case 'ENOTFOUND':
      return `Não foi possível conectar ao MySQL em ${where}. Ele está rodando? (com Docker: "docker compose up -d" na pasta server)`;
    case 'ER_ACCESS_DENIED_ERROR':
      return `O MySQL recusou o usuário "${dbConfig.user}". Confira DB_USER e DB_PASSWORD no arquivo .env.`;
    case 'ER_BAD_DB_ERROR':
      return `O banco "${dbConfig.database}" não existe. Rode "npm run db:migrate" para criá-lo.`;
    case 'ER_DBACCESS_DENIED_ERROR':
      return `O usuário "${dbConfig.user}" não tem permissão no banco "${dbConfig.database}".`;
    default:
      return err?.message || String(err);
  }
}
