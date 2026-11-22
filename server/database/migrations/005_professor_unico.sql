-- N3 / T77: o SGP passa a ter somente contas de professor.
-- Preserva os usuários e seus IDs para manter vínculos com turmas, provas e notas.
-- Contas antigas de administrador são convertidas em professor.
-- Contas convidadas antigas passam para ATIVO, mas continuam sem conseguir entrar
-- até que o próprio usuário conclua o cadastro e defina sua senha.

UPDATE usuario
SET papel = 'PROFESSOR',
    status = CASE WHEN status = 'CONVIDADO' THEN 'ATIVO' ELSE status END;

ALTER TABLE usuario
  MODIFY COLUMN papel ENUM('PROFESSOR') NOT NULL DEFAULT 'PROFESSOR',
  MODIFY COLUMN status ENUM('ATIVO', 'ANONIMIZADO') NOT NULL DEFAULT 'ATIVO';
