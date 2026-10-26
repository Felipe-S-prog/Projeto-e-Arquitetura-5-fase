import bcrypt from 'bcryptjs';
import { AppError } from '../errors/AppError.js';

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw AppError.badRequest('A senha deve ter pelo menos 8 caracteres.');
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw AppError.badRequest('A senha deve ter no máximo 72 bytes.');
  }
}

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password, hash) {
  if (typeof password !== 'string' || !hash) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}
