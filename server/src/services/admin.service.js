
export function createAdminService(repository) {
  function validateUser(data, { updating = false } = {}) {
    const name = String(data.name ?? '').trim();
    const email = String(data.email ?? '').trim().toLowerCase();
    const role = data.role;
    const status = data.status ?? 'Convidado';

    if (!name) {
      const error = new Error('Informe o nome completo.');
      error.statusCode = 400;
      throw error;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const error = new Error('Informe um e-mail válido.');
      error.statusCode = 400;
      throw error;
    }

    if (!['Professor', 'Administrador'].includes(role)) {
      const error = new Error('Papel de usuário inválido.');
      error.statusCode = 400;
      throw error;
    }

    if (updating && !['Ativo', 'Convidado'].includes(status)) {
      const error = new Error('Status de usuário inválido.');
      error.statusCode = 400;
      throw error;
    }

    return { name, email, role, status };
  }

  return {
    listUsers() {
      return repository.listUsers();
    },

    createUser(data) {
      return repository.createUser(validateUser(data));
    },

    updateUser(id, data) {
      const userId = Number(id);

      if (!Number.isInteger(userId) || userId <= 0) {
        const error = new Error('ID de usuário inválido.');
        error.statusCode = 400;
        throw error;
      }

      return repository.updateUser(
        userId,
        validateUser(data, { updating: true }),
      );
    },

    removeUser(id) {
      const userId = Number(id);

      if (!Number.isInteger(userId) || userId <= 0) {
        const error = new Error('ID de usuário inválido.');
        error.statusCode = 400;
        throw error;
      }

      return repository.removeUser(userId);
    },
  };
}
