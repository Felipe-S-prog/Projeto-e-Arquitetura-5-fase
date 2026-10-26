import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/errors/AppError.js';
import { createAuthService } from '../src/services/auth.service.js';
import { verifyAccessToken } from '../src/utils/jwt.js';

const config = {
  auth: {
    jwtSecret: 'segredo-de-teste-com-mais-de-32-caracteres',
    accessTokenTtlSeconds: 900,
    refreshTokenTtlDays: 30,
    adminEmailDomains: ['catolicasc.org.br'],
    professorEmailDomains: ['catolicasc.org.br', 'catolicasc.edu.br'],
  },
};

function makeRepository(initialUser = null) {
  let user = initialUser ? { ...initialUser } : null;
  const savedRefreshTokens = [];
  let nextRefreshId = 1;
  return {
    savedRefreshTokens,
    async hasBootstrapAdministrator() { return user?.papel === 'ADMINISTRADOR' && user?.status !== 'ANONIMIZADO'; },
    async createBootstrapAdministrator(data) {
      if (await this.hasBootstrapAdministrator()) return null;
      user = { id: 1, nome: data.name, email: data.email, senha_hash: data.passwordHash, papel: 'ADMINISTRADOR', status: 'ATIVO' };
      return user;
    },
    async findUserByEmail(email) { return user?.email === email ? user : null; },
    async activateInvitation({ userId, passwordHash }) {
      if (!user || user.id !== userId || !['CONVIDADO', 'ATIVO'].includes(user.status) || user.senha_hash) return null;
      user = { ...user, senha_hash: passwordHash, status: 'ATIVO' };
      return user;
    },
    async createRefreshToken(token) {
      savedRefreshTokens.push({ ...token, id: nextRefreshId++, revoked: false });
    },
    async findRefreshTokenByHash(hash) {
      const saved = savedRefreshTokens.find((token) => token.tokenHash === hash && !token.revoked);
      if (!saved || !user || user.status !== 'ATIVO') return null;
      return {
        refresh_token_id: saved.id,
        usuario_id: user.id,
        dispositivo: saved.device,
        nome: user.nome,
        email: user.email,
        papel: user.papel,
        status: user.status,
      };
    },
    async rotateRefreshToken({ oldTokenId, tokenHash, device, expiresInDays }) {
      const oldToken = savedRefreshTokens.find((token) => token.id === oldTokenId && !token.revoked);
      if (!oldToken) return false;
      oldToken.revoked = true;
      savedRefreshTokens.push({ userId: user.id, tokenHash, device, expiresInDays, id: nextRefreshId++, revoked: false });
      return true;
    },
    async revokeRefreshToken({ tokenHash }) {
      const token = savedRefreshTokens.find((item) => item.tokenHash === tokenHash && !item.revoked);
      if (!token) return false;
      token.revoked = true;
      return true;
    },
  };
}

test('ativar um convite grava senha hash e emite JWT e refresh token', async () => {
  const repo = makeRepository({
    id: 7,
    nome: 'Professora Teste',
    email: 'professora@catolicasc.edu.br',
    senha_hash: null,
    papel: 'PROFESSOR',
    status: 'CONVIDADO',
  });
  const service = createAuthService(repo, config);
  const session = await service.register({ email: 'PROFESSORA@CATOLICASC.EDU.BR', password: 'minha-senha-forte', device: 'teste' });
  assert.equal(session.user.id, 7);
  assert.equal(session.user.role, 'PROFESSOR');
  assert.equal(verifyAccessToken(session.accessToken, config.auth.jwtSecret).sub, '7');
  assert.equal(typeof session.refreshToken, 'string');
  assert.notEqual(repo.savedRefreshTokens[0].tokenHash, session.refreshToken);
});

test('conta antiga ativa sem senha pode definir a primeira senha e entrar', async () => {
  const repo = makeRepository({
    id: 10,
    nome: 'Professor Antigo',
    email: 'professor.antigo@catolicasc.edu.br',
    senha_hash: null,
    papel: 'PROFESSOR',
    status: 'ATIVO',
  });
  const service = createAuthService(repo, config);
  const session = await service.register({ email: 'professor.antigo@catolicasc.edu.br', password: 'minha-senha-forte' });
  assert.equal(session.user.id, 10);
  assert.equal(session.user.role, 'PROFESSOR');
});

test('refresh token é rotacionado e o token anterior deixa de ser reutilizável', async () => {
  const repo = makeRepository({
    id: 7,
    nome: 'Professora Teste',
    email: 'professora@catolicasc.edu.br',
    senha_hash: null,
    papel: 'PROFESSOR',
    status: 'CONVIDADO',
  });
  const service = createAuthService(repo, config);
  const initial = await service.register({ email: 'professora@catolicasc.edu.br', password: 'minha-senha-forte' });
  const refreshed = await service.refresh({ refreshToken: initial.refreshToken });
  assert.notEqual(refreshed.refreshToken, initial.refreshToken);
  await assert.rejects(
    service.refresh({ refreshToken: initial.refreshToken }),
    (error) => error instanceof AppError && error.statusCode === 401,
  );
});

test('ativação recusa e-mail fora do domínio permitido para o papel', async () => {
  const repo = makeRepository({
    id: 8,
    nome: 'Pessoa Teste',
    email: 'pessoa@gmail.com',
    senha_hash: null,
    papel: 'PROFESSOR',
    status: 'CONVIDADO',
  });
  const service = createAuthService(repo, config);
  await assert.rejects(
    service.register({ email: 'pessoa@gmail.com', password: 'minha-senha-forte' }),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test('login recusa uma conta convidada que ainda não definiu senha', async () => {
  const repo = makeRepository({
    id: 8,
    nome: 'Pessoa Teste',
    email: 'pessoa@catolicasc.edu.br',
    senha_hash: null,
    papel: 'PROFESSOR',
    status: 'CONVIDADO',
  });
  const service = createAuthService(repo, config);
  await assert.rejects(
    service.login({ email: 'pessoa@catolicasc.edu.br', password: 'minha-senha-forte' }),
    (error) => error instanceof AppError && error.statusCode === 401,
  );
});
