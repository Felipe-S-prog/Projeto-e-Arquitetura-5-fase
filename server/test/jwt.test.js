
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { AppError } from '../src/errors/AppError.js';
import { signAccessToken, verifyAccessToken } from '../src/utils/jwt.js';

const secret = 'segredo-de-teste-com-mais-de-32-caracteres';

function makeToken(payload, key = secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const content = `${header}.${body}`;
  const signature = createHmac('sha256', key).update(content).digest('base64url');
  return `${content}.${signature}`;
}

test('JWT de acesso válido identifica o usuário e o papel', () => {
  const token = signAccessToken(
    { id: 12, papel: 'PROFESSOR', email: 'p@catolicasc.edu.br' },
    secret,
    900,
  );

  const payload = verifyAccessToken(token, secret);

  assert.equal(payload.sub, '12');
  assert.equal(payload.role, 'PROFESSOR');
  assert.equal(payload.sv, 0);
});

test('JWT inclui a versão atual da sessão', () => {
  const token = signAccessToken(
    {
      id: 12,
      papel: 'PROFESSOR',
      email: 'p@catolicasc.edu.br',
      versao_sessao: 3,
    },
    secret,
    900,
  );

  const payload = verifyAccessToken(token, secret);

  assert.equal(payload.sv, 3);
});

test('JWT com assinatura alterada é recusado', () => {
  const token = signAccessToken(
    { id: 12, papel: 'PROFESSOR', email: 'p@catolicasc.edu.br' },
    secret,
    900,
  );

  const parts = token.split('.');
  parts[2] = `${parts[2].slice(0, -1)}${parts[2].endsWith('a') ? 'b' : 'a'}`;

  assert.throws(() => verifyAccessToken(parts.join('.'), secret), AppError);
});

test('JWT com versão de sessão inválida é recusado', () => {
  const token = makeToken({
    sub: '12',
    role: 'PROFESSOR',
    email: 'p@catolicasc.edu.br',
    sv: -1,
    exp: Math.floor(Date.now() / 1000) + 900,
    iss: 'sgp-api',
  });

  assert.throws(() => verifyAccessToken(token, secret), AppError);
});

test('JWT expirado é recusado', () => {
  const token = makeToken({
    sub: '12',
    role: 'PROFESSOR',
    email: 'p@catolicasc.edu.br',
    exp: 1,
    iss: 'sgp-api',
  });

  assert.throws(() => verifyAccessToken(token, secret), /Token de acesso expirado/);
});
