export async function withTransaction(pool, operation) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    try {
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    connection.release();
  }
}
