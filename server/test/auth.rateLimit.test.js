import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

const config = loadConfig({
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  DB_NAME: 'sgp_teste',
  NODE_ENV: 'test',
  CLIENT_ORIGIN: 'http://localhost:5173',
});

const pool = {
  query: async () => [
    [{ db: 'sgp_teste', now: new Date() }],
    [],
  ],
};

async function startApp() {
  const server = createApp({ pool, config }).listen(0);

  await new Promise((resolve) => server.once('listening', resolve));

  return {
    server,
    url: `http://127.0.0.1:${server.address().port}`,
  };
}

async function post(url, path, body, ip = '203.0.113.10') {
  return fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

test('rate limit bloqueia excesso de tentativas nas três rotas de autenticação', async () => {
  const { server, url } = await startApp();

  try {
    // Login: 5 tentativas permitidas; a sexta recebe 429.
    for (let i = 0; i < 5; i += 1) {
      const response = await post(url, '/api/auth/login', {
        email: 'invalido',
        password: 'senha',
      });

      assert.equal(response.status, 401);
    }

    const loginBlocked = await post(url, '/api/auth/login', {
      email: 'invalido',
      password: 'senha',
    });

    assert.equal(loginBlocked.status, 429);
    assert.equal((await loginBlocked.json()).error.code, 'RATE_LIMITED');
    assert.ok(Number(loginBlocked.headers.get('retry-after')) > 0);

    // Outro IP possui um limite independente.
    const otherIp = await post(
      url,
      '/api/auth/login',
      { email: 'invalido', password: 'senha' },
      '203.0.113.11',
    );

    assert.equal(otherIp.status, 401);

    // Cadastro: 5 tentativas permitidas; a sexta recebe 429.
    for (let i = 0; i < 5; i += 1) {
      const response = await post(url, '/api/auth/register', {});
      assert.equal(response.status, 400);
    }

    const registerBlocked = await post(url, '/api/auth/register', {});

    assert.equal(registerBlocked.status, 429);
    assert.equal((await registerBlocked.json()).error.code, 'RATE_LIMITED');
    assert.ok(Number(registerBlocked.headers.get('retry-after')) > 0);

    // Refresh: 30 tentativas permitidas; a 31ª recebe 429.
    for (let i = 0; i < 30; i += 1) {
      const response = await post(url, '/api/auth/refresh', {});
      assert.equal(response.status, 401);
    }

    const refreshBlocked = await post(url, '/api/auth/refresh', {});

    assert.equal(refreshBlocked.status, 429);
    assert.equal((await refreshBlocked.json()).error.code, 'RATE_LIMITED');
    assert.ok(Number(refreshBlocked.headers.get('retry-after')) > 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
