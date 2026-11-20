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
  },
};

function makeRepository(initialUser = null) {
  let user = initialUser
    ? { ...initialUser, versao_sessao: Number(initialUser.versao_sessao ?? 0) }
    : null;
  const savedRefreshTokens = [];
  let nextRefreshId = 1;

  return {
    savedRefreshTokens,
    get currentUser() { return user; },

    async registerProfessor(data) {
      if (user) {
        if (user.papel !== 'PROFESSOR' || user.status !== 'ATIVO' || user.senha_hash) return null;
        user = {
          ...user,
          nome: data.name,
          senha_hash: data.passwordHash,
          status: 'ATIVO',
        };
        return user;
      }

      user = {
        id: 7,
        nome: data.name,
        email: data.email,
        senha_hash: data.passwordHash,
        papel: 'PROFESSOR',
        status: 'ATIVO',
        versao_sessao: 0,
      };
      return user;
    },

    async findUserByEmail(email) {
      return user?.email === email ? user : null;
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
        versao_sessao: user.versao_sessao,
      };
    },

    async rotateRefreshToken({ oldTokenId, tokenHash, device, expiresInDays }) {
      const oldToken = savedRefreshTokens.find((token) => token.id === oldTokenId && !token.revoked);
      if (!oldToken) return false;
      oldToken.revoked = true;
      savedRefreshTokens.push({
        userId: user.id,
        tokenHash,
        device,
        expiresInDays,
        id: nextRefreshId++,
        revoked: false,
      });
      return true;
    },

    async revokeRefreshToken({ tokenHash }) {
      const token = savedRefreshTokens.find((item) => item.tokenHash === tokenHash && !item.revoked);
      if (!token) return false;
      token.revoked = true;
      return true;
    },

    async revokeAllSessions(userId) {
      if (!user || Number(user.id) !== Number(userId)) return false;
      user = { ...user, versao_sessao: Number(user.versao_sessao ?? 0) + 1 };
      savedRefreshTokens.forEach((token) => {
        if (Number(token.userId) === Number(userId)) token.revoked = true;
      });
      return true;
    },
  };
}

test('cadastro público cria professor, grava hash e inicia sessão', async () => {
  const repo = makeRepository();
  const service = createAuthService(repo, config);

  const session = await service.register({
    name: 'Nova Professora',
    email: ' NOVA@EXEMPLO.COM ',
    password: 'minha-senha-forte',
    device: 'teste',
    role: 'ADMINISTRADOR',
  });

  assert.equal(session.user.name, 'Nova Professora');
  assert.equal(session.user.email, 'nova@exemplo.com');
  assert.equal(session.user.role, 'PROFESSOR');
  assert.notEqual(repo.currentUser.senha_hash, 'minha-senha-forte');
  assert.equal(verifyAccessToken(session.accessToken, config.auth.jwtSecret).sub, '7');
  assert.equal(typeof session.refreshToken, 'string');
  assert.notEqual(repo.savedRefreshTokens[0].tokenHash, session.refreshToken);
});

test('cadastro público permite concluir conta antiga sem senha', async () => {
  const repo = makeRepository({
    id: 10,
    nome: 'Professor Antigo',
    email: 'professor@catolicasc.edu.br',
    senha_hash: null,
    papel: 'PROFESSOR',
    status: 'ATIVO',
  });
  const service = createAuthService(repo, config);

  const session = await service.register({
    name: 'Professor Atualizado',
    email: 'professor@catolicasc.edu.br',
    password: 'minha-senha-forte',
  });

  assert.equal(session.user.id, 10);
  assert.equal(session.user.name, 'Professor Atualizado');
  assert.equal(session.user.role, 'PROFESSOR');
});

test('cadastro recusa e-mail já associado a uma conta com senha', async () => {
  const repo = makeRepository({
    id: 8,
    nome: 'Professor Existente',
    email: 'professor@exemplo.com',
    senha_hash: 'hash-existente',
    papel: 'PROFESSOR',
    status: 'ATIVO',
  });
  const service = createAuthService(repo, config);

  await assert.rejects(
    service.register({
      name: 'Outra Pessoa',
      email: 'professor@exemplo.com',
      password: 'minha-senha-forte',
    }),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test('cadastro exige nome, e-mail válido e senha com pelo menos oito caracteres', async () => {
  const service = createAuthService(makeRepository(), config);

  await assert.rejects(
    service.register({ email: 'prof@exemplo.com', password: 'minha-senha-forte' }),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
  await assert.rejects(
    service.register({ name: 'Professor', email: 'email-invalido', password: 'minha-senha-forte' }),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
  await assert.rejects(
    service.register({ name: 'Professor', email: 'prof@exemplo.com', password: '1234567' }),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test('login recusa papel diferente de professor', async () => {
  const repo = makeRepository({
    id: 3,
    nome: 'Conta antiga',
    email: 'antiga@exemplo.com',
    senha_hash: 'hash',
    papel: 'ADMINISTRADOR',
    status: 'ATIVO',
  });
  const service = createAuthService(repo, config);

  await assert.rejects(
    service.login({ email: 'antiga@exemplo.com', password: 'senha-qualquer' }),
    (error) => error instanceof AppError && error.statusCode === 401,
  );
});

test('refresh token é rotacionado e o token anterior deixa de ser reutilizável', async () => {
  const repo = makeRepository();
  const service = createAuthService(repo, config);
  const initial = await service.register({
    name: 'Professora Teste',
    email: 'professora@exemplo.com',
    password: 'minha-senha-forte',
  });

  const refreshed = await service.refresh({ refreshToken: initial.refreshToken });
  assert.notEqual(refreshed.refreshToken, initial.refreshToken);
  assert.equal(verifyAccessToken(refreshed.accessToken, config.auth.jwtSecret).sv, 0);

  await assert.rejects(
    service.refresh({ refreshToken: initial.refreshToken }),
    (error) => error instanceof AppError && error.statusCode === 401,
  );
});

test('logout geral incrementa a versão e revoga as sessões do usuário', async () => {
  const repo = makeRepository({
    id: 7,
    nome: 'Professora Teste',
    email: 'professora@exemplo.com',
    senha_hash: 'hash',
    papel: 'PROFESSOR',
    status: 'ATIVO',
  });
  const service = createAuthService(repo, config);

  await repo.createRefreshToken({ userId: 7, tokenHash: 'hash-sessao-1', device: 'computador', expiresInDays: 30 });
  await repo.createRefreshToken({ userId: 7, tokenHash: 'hash-sessao-2', device: 'celular', expiresInDays: 30 });
  repo.savedRefreshTokens.push({ userId: 8, tokenHash: 'hash-outro-usuario', revoked: false });

  await service.logoutAll(7);
  assert.equal(repo.currentUser.versao_sessao, 1);
  assert.ok(repo.savedRefreshTokens.filter((token) => token.userId === 7).every((token) => token.revoked));
  assert.equal(repo.savedRefreshTokens.find((token) => token.userId === 8).revoked, false);
});
