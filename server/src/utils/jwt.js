
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../errors/AppError.js';

const base64url = (value) => Buffer.from(value).toString('base64url');

function signature(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function signAccessToken(user, secret, expiresInSeconds = 900) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

  const payload = base64url(JSON.stringify({
    sub: String(user.id),
    role: user.papel,
    email: user.email,
    sv: Number(user.versao_sessao ?? 0),
    iat: now,
    exp: now + expiresInSeconds,
    iss: 'sgp-api',
  }));

  const content = `${header}.${payload}`;
  return `${content}.${signature(content, secret)}`;
}

export function verifyAccessToken(token, secret) {
  if (typeof token !== 'string') {
    throw AppError.unauthorized('Token de acesso inválido.');
  }

  const parts = token.split('.');

  if (parts.length !== 3) {
    throw AppError.unauthorized('Token de acesso inválido.');
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const content = `${headerPart}.${payloadPart}`;
  const expected = Buffer.from(signature(content, secret));
  const received = Buffer.from(signaturePart);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw AppError.unauthorized('Token de acesso inválido.');
  }

  let header;
  let payload;

  try {
    header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    throw AppError.unauthorized('Token de acesso inválido.');
  }

  if (header.alg !== 'HS256' || payload.iss !== 'sgp-api') {
    throw AppError.unauthorized('Token de acesso inválido.');
  }

  if (!Number.isInteger(Number(payload.sub)) || Number(payload.sub) <= 0) {
    throw AppError.unauthorized('Token de acesso inválido.');
  }

  if (!['ADMINISTRADOR', 'PROFESSOR'].includes(payload.role)) {
    throw AppError.unauthorized('Token de acesso inválido.');
  }

  if (
    payload.sv !== undefined &&
    (!Number.isInteger(payload.sv) || payload.sv < 0)
  ) {
    throw AppError.unauthorized('Token de acesso inválido.');
  }

  if (!Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw AppError.unauthorized('Token de acesso expirado.');
  }

  return payload;
}
