import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

// Carrega o arquivo .env (se existir) para process.env.
// É chamado só pelos pontos de entrada (server.js e migrate.js); loadConfig
// fica "puro" (só lê o objeto que recebe), o que facilita testar.
export function loadEnvFile() {
  dotenv.config({ quiet: true });
}

// Nome do banco entra em comandos como CREATE DATABASE, que não aceitam
// parâmetros "?". Por isso restringimos aos caracteres seguros.
const DB_NAME_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

function parsePort(value, name) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} inválida: "${value}". Use um número entre 1 e 65535.`);
  }
  return port;
}

// Bancos hospedados (Aiven, por exemplo) só aceitam conexão com SSL e usam um certificado
// de autoridade (CA) próprio. Para ligar o SSL, informe UMA destas variáveis:
//   DB_SSL_CA       -> o texto do certificado (-----BEGIN CERTIFICATE-----...). "\n" vira quebra de linha;
//   DB_SSL_CA_PATH  -> caminho de um arquivo .pem com o certificado;
//   DB_SSL=true     -> liga o SSL usando as autoridades que o Node já conhece (sem CA própria).
// Sem nenhuma delas, a conexão é a de sempre (sem SSL), como no MySQL local do grupo.
// O certificado do servidor é sempre verificado (rejectUnauthorized: true).
function parseDbSsl(env) {
  let ca;
  if (env.DB_SSL_CA_PATH) {
    try {
      ca = readFileSync(env.DB_SSL_CA_PATH, 'utf8');
    } catch {
      throw new Error(`DB_SSL_CA_PATH inválido: não foi possível ler "${env.DB_SSL_CA_PATH}".`);
    }
  } else if (env.DB_SSL_CA) {
    ca = env.DB_SSL_CA.replace(/\\n/g, '\n');
  }
  if (ca !== undefined && !ca.includes('BEGIN CERTIFICATE')) {
    throw new Error('O certificado informado em DB_SSL_CA / DB_SSL_CA_PATH não parece um certificado PEM válido.');
  }
  if (ca === undefined && env.DB_SSL !== 'true') return null;
  return ca === undefined ? { rejectUnauthorized: true } : { ca, rejectUnauthorized: true };
}

export function loadConfig(env = process.env) {
  const missing = [];
  if (!env.DB_USER) missing.push('DB_USER');
  if (env.DB_PASSWORD === undefined) missing.push('DB_PASSWORD'); // pode ser vazia, mas precisa existir
  if (!env.DB_NAME) missing.push('DB_NAME');
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente ausentes: ${missing.join(', ')}. ` +
        'Copie server/.env.example para server/.env e ajuste os valores.'
    );
  }
  if (!DB_NAME_PATTERN.test(env.DB_NAME)) {
    throw new Error('DB_NAME inválido: use apenas letras, números e "_" (máximo de 64 caracteres).');
  }

  const dbSsl = parseDbSsl(env);
  const nodeEnv = env.NODE_ENV || 'development';
  const jwtSecret = env.JWT_ACCESS_SECRET || 'sgp-development-secret-change-before-deploy-2026';
  if (nodeEnv === 'production' && (!env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET.startsWith('troque-por-'))) {
    throw new Error('JWT_ACCESS_SECRET é obrigatória em produção.');
  }
  if (jwtSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres.');
  }

  const parseDomains = (value, fallback, name) => {
    const domains = (value ?? fallback)
      .split(',')
      .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
      .filter(Boolean);
    if (!domains.length || domains.some((domain) => !/^[a-z0-9.-]+$/.test(domain))) {
      throw new Error(`${name} contém um domínio inválido.`);
    }
    return domains;
  };
  const parsePositiveInteger = (value, fallback, name, max) => {
    const number = Number(value ?? fallback);
    if (!Number.isInteger(number) || number < 1 || number > max) {
      throw new Error(`${name} deve ser um inteiro entre 1 e ${max}.`);
    }
    return number;
  };

  return {
    nodeEnv,
    port: parsePort(env.PORT ?? '3333', 'PORT'),
    corsOrigins: (env.CLIENT_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    db: {
      host: env.DB_HOST || '127.0.0.1',
      port: parsePort(env.DB_PORT ?? '3306', 'DB_PORT'),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ...(dbSsl ? { ssl: dbSsl } : {}),
    },
    auth: {
      jwtSecret,
      accessTokenTtlSeconds: parsePositiveInteger(env.JWT_ACCESS_TTL_SECONDS, '900', 'JWT_ACCESS_TTL_SECONDS', 86400),
      refreshTokenTtlDays: parsePositiveInteger(env.REFRESH_TOKEN_TTL_DAYS, '30', 'REFRESH_TOKEN_TTL_DAYS', 365),
      allowAdminBootstrap: nodeEnv === 'production' ? env.ALLOW_ADMIN_BOOTSTRAP === 'true' : env.ALLOW_ADMIN_BOOTSTRAP !== 'false',
      adminEmailDomains: parseDomains(env.ADMIN_EMAIL_DOMAINS, 'catolicasc.org.br', 'ADMIN_EMAIL_DOMAINS'),
      professorEmailDomains: parseDomains(env.PROFESSOR_EMAIL_DOMAINS, 'catolicasc.org.br,catolicasc.edu.br', 'PROFESSOR_EMAIL_DOMAINS'),
    },
  };
}
