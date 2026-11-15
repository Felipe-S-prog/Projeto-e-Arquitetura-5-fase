import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { hashPassword, comparePassword, validatePassword } from '../utils/password.js';
import { signAccessToken } from '../utils/jwt.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function publicUser(user) {
  return {
    id: Number(user.id),
    name: user.nome,
    email: user.email,
    role: 'PROFESSOR',
  };
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createAuthService(repository, config) {
  function validateEmail(email) {
    if (!EMAIL_RE.test(email) || email.length > 160) {
      throw AppError.badRequest('Informe um e-mail válido com até 160 caracteres.');
    }
  }

  function validateName(name) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
      throw AppError.badRequest('Informe o nome completo (até 120 caracteres).');
    }
    return name.trim();
  }

  function validateDevice(device) {
    if (device !== undefined && device !== null && typeof device !== 'string') {
      throw AppError.badRequest('Identificação do dispositivo inválida.');
    }
    return device?.trim().slice(0, 120) || null;
  }

  function buildSession(user, refreshToken) {
    return {
      accessToken: signAccessToken(user, config.auth.jwtSecret, config.auth.accessTokenTtlSeconds),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: config.auth.accessTokenTtlSeconds,
      user: publicUser(user),
    };
  }

  async function createSession(user, device) {
    const refreshToken = randomBytes(32).toString('base64url');

    await repository.createRefreshToken({
      userId: Number(user.id),
      tokenHash: tokenHash(refreshToken),
      device,
      expiresInDays: config.auth.refreshTokenTtlDays,
    });

    return buildSession(user, refreshToken);
  }

  return {
    async register(data) {
      const name = validateName(data?.name);
      const email = normalizeEmail(data?.email);
      validateEmail(email);
      validatePassword(data?.password);

      const device = validateDevice(data?.device);
      const passwordHash = await hashPassword(data.password);
      const user = await repository.registerProfessor({ name, email, passwordHash });

      if (!user) {
        throw AppError.conflict('Já existe uma conta cadastrada com esse e-mail.');
      }

      return createSession(user, device);
    },

    async login(data) {
      const email = normalizeEmail(data?.email);
      const password = data?.password;

      if (!EMAIL_RE.test(email) || typeof password !== 'string') {
        throw AppError.unauthorized('E-mail ou senha inválidos.');
      }

      const user = await repository.findUserByEmail(email);

      if (
        !user ||
        user.papel !== 'PROFESSOR' ||
        user.status !== 'ATIVO' ||
        !user.senha_hash
      ) {
        throw AppError.unauthorized('E-mail ou senha inválidos.');
      }

      if (!(await comparePassword(password, user.senha_hash))) {
        throw AppError.unauthorized('E-mail ou senha inválidos.');
      }

      return createSession(user, validateDevice(data?.device));
    },

    async refresh(data) {
      const oldToken = data?.refreshToken;

      if (typeof oldToken !== 'string' || oldToken.length < 32 || oldToken.length > 200) {
        throw AppError.unauthorized('Refresh token inválido ou expirado.');
      }

      const oldHash = tokenHash(oldToken);
      const oldSession = await repository.findRefreshTokenByHash(oldHash);

      if (!oldSession || oldSession.papel !== 'PROFESSOR') {
        throw AppError.unauthorized('Refresh token inválido ou expirado.');
      }

      const device = validateDevice(data?.device) ?? oldSession.dispositivo ?? null;
      const newRefreshToken = randomBytes(32).toString('base64url');

      const rotated = await repository.rotateRefreshToken({
        oldTokenId: oldSession.refresh_token_id,
        tokenHash: tokenHash(newRefreshToken),
        device,
        expiresInDays: config.auth.refreshTokenTtlDays,
      });

      if (!rotated) {
        throw AppError.unauthorized('Refresh token já utilizado ou expirado. Entre novamente.');
      }

      return buildSession(
        { ...oldSession, id: oldSession.usuario_id },
        newRefreshToken,
      );
    },

    async logout(userId, data) {
      const refreshToken = data?.refreshToken;

      if (typeof refreshToken !== 'string' || refreshToken.length < 32 || refreshToken.length > 200) {
        throw AppError.badRequest('Informe o refresh token da sessão atual.');
      }

      await repository.revokeRefreshToken({
        tokenHash: tokenHash(refreshToken),
        userId,
      });

      return { message: 'Sessão encerrada.' };
    },

    async logoutAll(userId) {
      const revoked = await repository.revokeAllSessions(userId);

      if (!revoked) {
        throw AppError.unauthorized('A conta não está ativa. Entre novamente.');
      }

      return { message: 'Todas as sessões foram encerradas.' };
    },
  };
}
