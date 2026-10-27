
const SELECT_USERS = `
  SELECT id, nome, email, papel, status, criado_em
  FROM usuario
  WHERE status <> 'ANONIMIZADO'
  ORDER BY id DESC
`;

function mapUser(row) {
  return {
    id: row.id,
    name: row.nome,
    email: row.email,
    role: row.papel === 'ADMINISTRADOR' ? 'Administrador' : 'Professor',
    status:
      row.status === 'ATIVO'
        ? 'Ativo'
        : row.status === 'CONVIDADO'
          ? 'Convidado'
          : row.status,
    createdAt: row.criado_em,
  };
}

export function createAdminRepository(pool) {
  return {
    async listUsers() {
      const [rows] = await pool.query(SELECT_USERS);
      return rows.map(mapUser);
    },

    async createUser({ name, email, role }) {
      const papel = role === 'Administrador' ? 'ADMINISTRADOR' : 'PROFESSOR';

      const [result] = await pool.execute(
        `INSERT INTO usuario (nome, email, papel, status)
         VALUES (?, ?, ?, 'CONVIDADO')`,
        [name.trim(), email.trim().toLowerCase(), papel],
      );

      const [rows] = await pool.execute(
        `SELECT id, nome, email, papel, status, criado_em
         FROM usuario WHERE id = ?`,
        [result.insertId],
      );

      return mapUser(rows[0]);
    },

    async updateUser(id, { name, email, role, status }) {
      const papel = role === 'Administrador' ? 'ADMINISTRADOR' : 'PROFESSOR';
      const situacao = status === 'Ativo' ? 'ATIVO' : 'CONVIDADO';

      const [result] = await pool.execute(
        `UPDATE usuario
         SET nome = ?, email = ?, papel = ?,
             status = CASE WHEN ? = 'ATIVO' AND senha_hash IS NULL THEN 'CONVIDADO' ELSE ? END
         WHERE id = ? AND status <> 'ANONIMIZADO'`,
        [name.trim(), email.trim().toLowerCase(), papel, situacao, situacao, id],
      );

      if (result.affectedRows === 0) return null;

      const [rows] = await pool.execute(
        `SELECT id, nome, email, papel, status, criado_em
         FROM usuario WHERE id = ?`,
        [id],
      );

      return rows[0] ? mapUser(rows[0]) : null;
    },

    async removeUser(id) {
      const [result] = await pool.execute(
        `UPDATE usuario
         SET status = 'ANONIMIZADO'
         WHERE id = ? AND status <> 'ANONIMIZADO'`,
        [id],
      );

      return result.affectedRows > 0;
    },
  };
}
