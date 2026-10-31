
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/config/env.js';
import { createApiAuthMiddleware } from '../src/middlewares/apiAuth.js';
import { signAccessToken } from '../src/utils/jwt.js';

const config = loadConfig({
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  DB_NAME: 'sgp_teste',
  NODE_ENV: 'test',
});

function invokeMiddleware(middleware, { path, token, body = {}, query = {} }) {
  return new Promise((resolve) => {
    const req = {
      path,
      body,
      query,
      get(name) {
        if (name.toLowerCase() === 'authorization' && token) {
          return `Bearer ${token}`;
        }
        return undefined;
      },
    };

    const res = {};

    middleware(req, res, (error) => resolve({ error, req }));
  });
}

function fakePool(user) {
  return {
    execute: async () => [user ? [user] : [], []],
  };
}

function makeUser(overrides = {}) {
  return {
    id: 9,
    nome: 'Professor',
    email: 'prof@catolicasc.edu.br',
    papel: 'PROFESSOR',
    status: 'ATIVO',
    versao_sessao: 0,
    ...overrides,
  };
}

test('rota protegida recusa requisição sem token', async () => {
  const middleware = createApiAuthMiddleware({
    pool: fakePool(null),
    config,
  });

  const { error } = await invokeMiddleware(middleware, {
    path: '/turmas',
  });

  assert.equal(error?.statusCode, 401);
});

test('JWT de administrador não acessa rota exclusiva de professor', async () => {
  const user = makeUser({
    id: 3,
    nome: 'Admin',
    email: 'admin@catolicasc.org.br',
    papel: 'ADMINISTRADOR',
  });

  const token = signAccessToken(user, config.auth.jwtSecret);

  const middleware = createApiAuthMiddleware({
    pool: fakePool(user),
    config,
  });

  const { error } = await invokeMiddleware(middleware, {
    path: '/turmas',
    token,
  });

  assert.equal(error?.statusCode, 403);
});

test('id de professor vem do JWT, mesmo quando o cliente envia outro professor_id', async () => {
  const user = makeUser();
  const token = signAccessToken(user, config.auth.jwtSecret);

  const middleware = createApiAuthMiddleware({
    pool: fakePool(user),
    config,
  });

  const { error, req } = await invokeMiddleware(middleware, {
    path: '/turmas',
    token,
    query: { professor_id: '2' },
  });

  assert.equal(error, undefined);
  assert.equal(req.professorId, 9);
  assert.equal(req.body.professor_id, 9);
  assert.equal(req.query.professor_id, '9');
  assert.equal(req.user.id, 9);
});

test('verificação da sessão exige token de acesso', async () => {
  const middleware = createApiAuthMiddleware({
    pool: fakePool(null),
    config,
  });

  const { error } = await invokeMiddleware(middleware, {
    path: '/auth/session',
  });

  assert.equal(error?.statusCode, 401);
});

test('verificação da sessão aceita token com versão atual', async () => {
  const user = makeUser({ versao_sessao: 2 });
  const token = signAccessToken(user, config.auth.jwtSecret);

  const middleware = createApiAuthMiddleware({
    pool: fakePool(user),
    config,
  });

  const { error, req } = await invokeMiddleware(middleware, {
    path: '/auth/session',
    token,
  });

  assert.equal(error, undefined);
  assert.equal(req.user.id, 9);
  assert.equal(req.user.versaoSessao, 2);
});

test('middleware rejeita JWT com versão de sessão revogada', async () => {
  const user = makeUser({ versao_sessao: 2 });

  const token = signAccessToken(
    { ...user, versao_sessao: 1 },
    config.auth.jwtSecret,
  );

  const middleware = createApiAuthMiddleware({
    pool: fakePool(user),
    config,
  });

  const { error } = await invokeMiddleware(middleware, {
    path: '/auth/session',
    token,
  });

  assert.equal(error?.statusCode, 401);
  assert.match(error.message, /sessão foi encerrada/i);
});

test('logout geral também aceita administrador autenticado', async () => {
  const user = makeUser({
    id: 3,
    nome: 'Admin',
    email: 'admin@catolicasc.org.br',
    papel: 'ADMINISTRADOR',
    versao_sessao: 0,
  });

  const token = signAccessToken(user, config.auth.jwtSecret);

  const middleware = createApiAuthMiddleware({
    pool: fakePool(user),
    config,
  });

  const { error, req } = await invokeMiddleware(middleware, {
    path: '/auth/logout-all',
    token,
  });

  assert.equal(error, undefined);
  assert.equal(req.user.id, 3);
});
