export function createAuthRepository(pool) {
  async function findUserById(id) {
    const [rows] = await pool.execute(
      `SELECT id, nome, email, senha_hash, papel, status, criado_em
       FROM usuario WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  return {
    async findUserByEmail(email) {
      const [rows] = await pool.execute(
        `SELECT id, nome, email, senha_hash, papel, status, criado_em
         FROM usuario WHERE email = ? LIMIT 1`,
        [email],
      );
      return rows[0] ?? null;
    },

    findUserById,

    async hasBootstrapAdministrator() {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM usuario
         WHERE papel = 'ADMINISTRADOR' AND status <> 'ANONIMIZADO'`,
      );
      return Number(rows[0]?.total ?? 0) > 0;
    },

    async createBootstrapAdministrator({ name, email, passwordHash }) {
      const connection = await pool.getConnection();
      let lockAcquired = false;
      try {
        const [lockRows] = await connection.query(
          "SELECT GET_LOCK('sgp_bootstrap_administrator', 5) AS acquired",
        );
        lockAcquired = Number(lockRows[0]?.acquired) === 1;
        if (!lockAcquired) return null;

        const [adminRows] = await connection.execute(
          `SELECT COUNT(*) AS total FROM usuario
           WHERE papel = 'ADMINISTRADOR' AND status <> 'ANONIMIZADO'`,
        );
        if (Number(adminRows[0]?.total ?? 0) > 0) return null;

        const [result] = await connection.execute(
          `INSERT INTO usuario (nome, email, senha_hash, papel, status)
           VALUES (?, ?, ?, 'ADMINISTRADOR', 'ATIVO')`,
          [name, email, passwordHash],
        );
        return findUserByIdWithConnection(connection, result.insertId);
      } finally {
        try {
          if (lockAcquired) {
            await connection.query("SELECT RELEASE_LOCK('sgp_bootstrap_administrator')");
          }
        } finally {
          connection.release();
        }
      }
    },

    async activateInvitation({ userId, passwordHash }) {
      const [result] = await pool.execute(
        `UPDATE usuario SET senha_hash = ?, status = 'ATIVO'
         WHERE id = ? AND status IN ('CONVIDADO', 'ATIVO') AND senha_hash IS NULL`,
        [passwordHash, userId],
      );
      if (result.affectedRows !== 1) return null;
      return findUserById(userId);
    },

    async createRefreshToken({ userId, tokenHash, device, expiresInDays }) {
      await pool.execute(
        `INSERT INTO refresh_token (usuario_id, token_hash, dispositivo, expira_em)
         VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
        [userId, tokenHash, device, expiresInDays],
      );
    },

    async findRefreshTokenByHash(tokenHash) {
      const [rows] = await pool.execute(
        `SELECT rt.id AS refresh_token_id, rt.usuario_id, rt.token_hash,
                rt.dispositivo, rt.expira_em, rt.revogado_em,
                u.nome, u.email, u.papel, u.status, u.senha_hash
         FROM refresh_token rt
         JOIN usuario u ON u.id = rt.usuario_id
         WHERE rt.token_hash = ? AND rt.revogado_em IS NULL
           AND rt.expira_em > NOW() AND u.status = 'ATIVO'
         LIMIT 1`,
        [tokenHash],
      );
      return rows[0] ?? null;
    },

    async rotateRefreshToken({ oldTokenId, tokenHash, device, expiresInDays }) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
          `UPDATE refresh_token SET revogado_em = NOW()
           WHERE id = ? AND revogado_em IS NULL AND expira_em > NOW()`,
          [oldTokenId],
        );
        if (result.affectedRows !== 1) {
          await connection.rollback();
          return false;
        }

        const [userRows] = await connection.execute(
          'SELECT usuario_id FROM refresh_token WHERE id = ? LIMIT 1',
          [oldTokenId],
        );
        if (!userRows[0]) {
          await connection.rollback();
          return false;
        }

        await connection.execute(
          `INSERT INTO refresh_token (usuario_id, token_hash, dispositivo, expira_em)
           VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
          [userRows[0].usuario_id, tokenHash, device, expiresInDays],
        );
        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async revokeRefreshToken({ tokenHash, userId }) {
      const [result] = await pool.execute(
        `UPDATE refresh_token SET revogado_em = NOW()
         WHERE token_hash = ? AND usuario_id = ? AND revogado_em IS NULL`,
        [tokenHash, userId],
      );
      return result.affectedRows > 0;
    },
  };
}

async function findUserByIdWithConnection(connection, id) {
  const [rows] = await connection.execute(
    `SELECT id, nome, email, senha_hash, papel, status, criado_em
     FROM usuario WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}
