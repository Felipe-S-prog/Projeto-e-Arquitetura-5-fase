export function createAuthRepository(pool) {
  async function findUserById(id) {
    const [rows] = await pool.execute(
      `SELECT id, nome, email, senha_hash, papel, status, criado_em, versao_sessao
       FROM usuario WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async function findUserByEmail(email) {
    const [rows] = await pool.execute(
      `SELECT id, nome, email, senha_hash, papel, status, criado_em, versao_sessao
       FROM usuario WHERE email = ? LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  }

  return {
    findUserById,
    findUserByEmail,

    async registerProfessor({ name, email, passwordHash }) {
      const existingUser = await findUserByEmail(email);

      // Compatibilidade com contas antigas criadas antes do cadastro livre:
      // se o registro existe, mas ainda não tem senha, o próprio usuário conclui o cadastro.
      if (existingUser) {
        if (
          existingUser.papel !== 'PROFESSOR' ||
          existingUser.status !== 'ATIVO' ||
          existingUser.senha_hash
        ) {
          return null;
        }

        const [result] = await pool.execute(
          `UPDATE usuario
           SET nome = ?, senha_hash = ?, status = 'ATIVO'
           WHERE id = ? AND papel = 'PROFESSOR'
             AND status = 'ATIVO' AND senha_hash IS NULL`,
          [name, passwordHash, existingUser.id],
        );

        if (result.affectedRows !== 1) return null;
        return findUserById(existingUser.id);
      }

      try {
        const [result] = await pool.execute(
          `INSERT INTO usuario (nome, email, senha_hash, papel, status)
           VALUES (?, ?, ?, 'PROFESSOR', 'ATIVO')`,
          [name, email, passwordHash],
        );

        return findUserById(result.insertId);
      } catch (error) {
        // Protege contra duas requisições simultâneas com o mesmo e-mail.
        if (error?.code === 'ER_DUP_ENTRY') return null;
        throw error;
      }
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
                u.nome, u.email, u.papel, u.status, u.senha_hash,
                u.versao_sessao
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

    async createPasswordResetToken({ userId, tokenHash, expiresInMinutes }) {
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        await connection.execute(
          `UPDATE token_recuperacao_senha
           SET usado_em = NOW()
           WHERE usuario_id = ? AND usado_em IS NULL`,
          [userId],
        );

        await connection.execute(
          `INSERT INTO token_recuperacao_senha
           (usuario_id, token_hash, expira_em)
           VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
          [userId, tokenHash, expiresInMinutes],
        );

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async findPasswordResetTokenByHash(tokenHash) {
      const [rows] = await pool.execute(
        `SELECT id, usuario_id
         FROM token_recuperacao_senha
         WHERE token_hash = ?
           AND usado_em IS NULL
           AND expira_em > NOW()
         LIMIT 1`,
        [tokenHash],
      );

      return rows[0] ?? null;
    },

    async resetPassword({ tokenId, userId, passwordHash }) {
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        const [tokenRows] = await connection.execute(
          `SELECT id FROM token_recuperacao_senha
           WHERE id = ? AND usuario_id = ?
             AND usado_em IS NULL AND expira_em > NOW()
           FOR UPDATE`,
          [tokenId, userId],
        );

        if (!tokenRows[0]) {
          await connection.rollback();
          return false;
        }

        const [result] = await connection.execute(
          `UPDATE usuario
           SET senha_hash = ?, versao_sessao = versao_sessao + 1
           WHERE id = ? AND status = 'ATIVO'`,
          [passwordHash, userId],
        );

        if (result.affectedRows !== 1) {
          await connection.rollback();
          return false;
        }

        await connection.execute(
          `UPDATE refresh_token
           SET revogado_em = NOW()
           WHERE usuario_id = ? AND revogado_em IS NULL`,
          [userId],
        );

        await connection.execute(
          `UPDATE token_recuperacao_senha
           SET usado_em = NOW()
           WHERE usuario_id = ? AND usado_em IS NULL`,
          [userId],
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

    async revokeAllSessions(userId) {
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
          `UPDATE usuario
           SET versao_sessao = versao_sessao + 1
           WHERE id = ?`,
          [userId],
        );

        if (result.affectedRows !== 1) {
          await connection.rollback();
          return false;
        }

        await connection.execute(
          `UPDATE refresh_token
           SET revogado_em = NOW()
           WHERE usuario_id = ? AND revogado_em IS NULL`,
          [userId],
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
  };
}
