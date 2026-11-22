export function createMeRepository(pool) {
  return {
    async anonymizeAccount(userId) {
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        const [users] = await connection.execute(
          `SELECT id
             FROM usuario
            WHERE id = ? AND status = 'ATIVO'
            FOR UPDATE`,
          [userId],
        );

        if (users.length !== 1) {
          await connection.rollback();
          return false;
        }

        const [result] = await connection.execute(
          `UPDATE usuario
              SET nome = ?,
                  email = ?,
                  senha_hash = NULL,
                  status = 'ANONIMIZADO',
                  versao_sessao = versao_sessao + 1
            WHERE id = ? AND status = 'ATIVO'`,
          [
            `Conta anonimizada #${userId}`,
            `anonimizado-${userId}@anonimizado.invalid`,
            userId,
          ],
        );

        if (result.affectedRows !== 1) {
          await connection.rollback();
          return false;
        }

        // Revoga todas as sessões e remove a identificação dos dispositivos.
        await connection.execute(
          `UPDATE refresh_token
              SET revogado_em = COALESCE(revogado_em, NOW()),
                  dispositivo = NULL
            WHERE usuario_id = ?`,
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
