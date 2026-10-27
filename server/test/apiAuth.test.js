import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/config/env.js';
import { createApiAuthMiddleware } from '../src/middlewares/apiAuth.js';
import { signAccessToken } from '../src/utils/jwt.js';

const config = loadConfig({ DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'sgp_teste', NODE_ENV: 'test' });

function invokeMiddleware(middleware, { path, token, body = {}, query = {} }, poolUser) {
  return new Promise((resolve) => {
    const req = {
      path,
      body,
      query,
      get(name) {
        if (name.toLowerCase() === 'authorization' && token) return `Bearer ${token}`;
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

test('rota protegida recusa requisição sem token', async () => {
  const middleware = createApiAuthMiddleware({ pool: fakePool(null), config });
  const { error } = await invokeMiddleware(middleware, { path: '/turmas' }, null);
  assert.equal(error?.statusCode, 401);
});

test('JWT de administrador não acessa rota exclusiva de professor', async () => {
  const token = signAccessToken({ id: 3, papel: 'ADMINISTRADOR', email: 'admin@catolicasc.org.br' }, config.auth.jwtSecret);
  const middleware = createApiAuthMiddleware({
    pool: fakePool({ id: 3, nome: 'Admin', email: 'admin@catolicasc.org.br', papel: 'ADMINISTRADOR', status: 'ATIVO' }),
    config,
  });
  const { error } = await invokeMiddleware(middleware, { path: '/turmas', token });
  assert.equal(error?.statusCode, 403);
});

test('id de professor vem do JWT, mesmo quando o cliente envia outro professor_id', async () => {
  const token = signAccessToken({ id: 9, papel: 'PROFESSOR', email: 'prof@catolicasc.edu.br' }, config.auth.jwtSecret);
  const middleware = createApiAuthMiddleware({
    pool: fakePool({ id: 9, nome: 'Professor', email: 'prof@catolicasc.edu.br', papel: 'PROFESSOR', status: 'ATIVO' }),
    config,
  });
  const { error, req } = await invokeMiddleware(middleware, {
    path: '/turmas',
    token,
    body: { professor_id: 2 },
    query: { professor_id: '2' },
  });
  assert.equal(error, undefined);
  assert.equal(req.professorId, 9);
  assert.equal(req.body.professor_id, 9);
  assert.equal(req.query.professor_id, '9');
  assert.equal(req.user.id, 9);
});
