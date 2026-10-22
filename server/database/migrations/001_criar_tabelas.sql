-- =====================================================================
-- 001 - Criação das tabelas do SGP (backlog T02)
-- Modelo: docs/modelo-dados/mer-der.png | Dicionário: docs/modelo-dados/dicionario-dados.md
-- Aplicada por: npm run db:migrate (na pasta server)
-- Não edite depois de aplicada: crie uma nova migration (002_...).
-- =====================================================================

-- usuario (Autenticação e Perfil - Bruno)
CREATE TABLE `usuario` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `nome` VARCHAR(120) NOT NULL COMMENT 'Nome completo do usuário',
  `email` VARCHAR(160) NOT NULL COMMENT 'E-mail de login; único (o domínio é validado por papel)',
  `senha_hash` VARCHAR(255) NULL COMMENT 'Hash bcrypt da senha (RNF02); fica nulo enquanto o usuário está Convidado',
  `papel` ENUM('ADMINISTRADOR','PROFESSOR') NOT NULL COMMENT 'Perfil de acesso',
  `status` ENUM('CONVIDADO','ATIVO','ANONIMIZADO') NOT NULL DEFAULT 'CONVIDADO' COMMENT 'Situação da conta; ANONIMIZADO mantém o histórico (LGPD)',
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora de criação do cadastro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuario_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Professores e administradores (RF01). O aluno não tem conta no sistema.';

-- refresh_token (Autenticação e Perfil - Bruno)
CREATE TABLE `refresh_token` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `usuario_id` INT UNSIGNED NOT NULL COMMENT 'Dono do token',
  `token_hash` CHAR(64) NOT NULL COMMENT 'Hash SHA-256 do token (o token em si não é guardado)',
  `dispositivo` VARCHAR(120) NULL COMMENT 'Identificação do dispositivo, usada no logout do dispositivo atual',
  `expira_em` DATETIME NOT NULL COMMENT 'Data e hora de expiração',
  `revogado_em` DATETIME NULL COMMENT 'Preenchido no logout; "sair de todos os dispositivos" revoga todos do usuário',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_token_token_hash` (`token_hash`),
  CONSTRAINT `fk_refresh_token_usuario_id` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Refresh tokens emitidos no login, um por dispositivo (RNF03).';

-- turma (Turmas e Questões - Camila)
CREATE TABLE `turma` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `professor_id` INT UNSIGNED NOT NULL COMMENT 'Professor dono da turma',
  `nome` VARCHAR(100) NOT NULL COMMENT 'Nome da turma (ex.: Cálculo I - Turma A)',
  `disciplina` VARCHAR(80) NOT NULL COMMENT 'Disciplina (ex.: Matemática)',
  `periodo` VARCHAR(10) NOT NULL COMMENT 'Período letivo (ex.: 2026/2)',
  `status` ENUM('ATIVA','ARQUIVADA') NOT NULL DEFAULT 'ATIVA' COMMENT 'Turmas arquivadas não aceitam novas aplicações',
  `codigo_convite` CHAR(8) NULL COMMENT 'Código para o aluno entrar na turma; único, gerado e regenerado pelo professor',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_turma_codigo_convite` (`codigo_convite`),
  CONSTRAINT `fk_turma_professor_id` FOREIGN KEY (`professor_id`) REFERENCES `usuario` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Turmas de um professor (RF03). Cada professor só vê as próprias turmas (RNF04).';

-- aluno (Turmas e Questões - Camila)
CREATE TABLE `aluno` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `nome` VARCHAR(120) NOT NULL COMMENT 'Nome do aluno',
  `email` VARCHAR(160) NOT NULL COMMENT 'E-mail do aluno; único',
  `numero_matricula` VARCHAR(30) NULL COMMENT 'Número de matrícula acadêmica, quando informado (atributo matricula do diagrama de classes)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_aluno_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Registro do aluno informado pelo professor (nome e e-mail). Não gera conta de acesso (RF03).';

-- matricula (Turmas e Questões - Camila)
CREATE TABLE `matricula` (
  `turma_id` INT UNSIGNED NOT NULL COMMENT 'Turma',
  `aluno_id` INT UNSIGNED NOT NULL COMMENT 'Aluno matriculado',
  `matriculado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora da matrícula',
  PRIMARY KEY (`turma_id`, `aluno_id`),
  CONSTRAINT `fk_matricula_turma_id` FOREIGN KEY (`turma_id`) REFERENCES `turma` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_matricula_aluno_id` FOREIGN KEY (`aluno_id`) REFERENCES `aluno` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Matrícula de um aluno em uma turma (ClassEnrollment). Resolve a relação N:N entre turma e aluno.';

-- questao (Turmas e Questões - Camila)
CREATE TABLE `questao` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `professor_id` INT UNSIGNED NOT NULL COMMENT 'Professor dono da questão',
  `tipo` ENUM('OBJETIVA','DISCURSIVA') NOT NULL COMMENT 'Tipo da questão',
  `enunciado` TEXT NOT NULL COMMENT 'Texto do enunciado',
  `imagem_url` VARCHAR(500) NULL COMMENT 'Caminho ou URL da imagem anexada à questão',
  `excluida_em` DATETIME NULL COMMENT 'Exclusão lógica (soft-delete): preenchido quando a questão é excluída',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_questao_professor_id` FOREIGN KEY (`professor_id`) REFERENCES `usuario` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Banco de questões de cada professor (RF02): objetivas e discursivas, com exclusão lógica.';

-- tag (Turmas e Questões - Camila)
CREATE TABLE `tag` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `nome` VARCHAR(50) NOT NULL COMMENT 'Texto da tag; único',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tag_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Rótulos usados para filtrar questões (ex.: Álgebra).';

-- questao_tag (Turmas e Questões - Camila)
CREATE TABLE `questao_tag` (
  `questao_id` INT UNSIGNED NOT NULL COMMENT 'Questão',
  `tag_id` INT UNSIGNED NOT NULL COMMENT 'Tag',
  PRIMARY KEY (`questao_id`, `tag_id`),
  CONSTRAINT `fk_questao_tag_questao_id` FOREIGN KEY (`questao_id`) REFERENCES `questao` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_questao_tag_tag_id` FOREIGN KEY (`tag_id`) REFERENCES `tag` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Associa tags a questões. Resolve a relação N:N entre questão e tag.';

-- alternativa (Turmas e Questões - Camila)
CREATE TABLE `alternativa` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `questao_id` INT UNSIGNED NOT NULL COMMENT 'Questão a que a alternativa pertence',
  `texto` TEXT NOT NULL COMMENT 'Texto da alternativa',
  `correta` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 se for a alternativa correta',
  `ordem` TINYINT UNSIGNED NOT NULL COMMENT 'Posição original da alternativa, de 0 a 4 (no máximo 5 por questão); única dentro da questão',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_alternativa_questao_id_ordem` (`questao_id`, `ordem`),
  CONSTRAINT `fk_alternativa_questao_id` FOREIGN KEY (`questao_id`) REFERENCES `questao` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_alternativa_1` CHECK (ordem BETWEEN 0 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Alternativas das questões objetivas, no máximo 5 por questão (o mínimo de 2 é validado na API). Questões discursivas não têm alternativas.';

-- prova (Provas e Aplicações - Felipe)
CREATE TABLE `prova` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `professor_id` INT UNSIGNED NOT NULL COMMENT 'Professor dono da prova',
  `titulo` VARCHAR(150) NOT NULL COMMENT 'Título da prova',
  `descricao` TEXT NULL COMMENT 'Descrição ou assunto da prova',
  `status` ENUM('RASCUNHO','PRONTA','ARQUIVADA') NOT NULL DEFAULT 'RASCUNHO' COMMENT 'Situação da prova',
  `criada_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora de criação',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_prova_professor_id` FOREIGN KEY (`professor_id`) REFERENCES `usuario` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Prova reutilizável do professor (RF04). Status: RASCUNHO, PRONTA (na primeira aplicação) e ARQUIVADA (manual).';

-- prova_questao (Provas e Aplicações - Felipe)
CREATE TABLE `prova_questao` (
  `prova_id` INT UNSIGNED NOT NULL COMMENT 'Prova',
  `questao_id` INT UNSIGNED NOT NULL COMMENT 'Questão incluída na prova',
  `posicao` TINYINT UNSIGNED NOT NULL COMMENT 'Posição da questão na prova, de 1 a 20; única dentro da prova',
  `pontuacao` DECIMAL(5,2) NOT NULL COMMENT 'Pontos que a questão vale nesta prova (RF04)',
  PRIMARY KEY (`prova_id`, `questao_id`),
  UNIQUE KEY `uq_prova_questao_prova_id_posicao` (`prova_id`, `posicao`),
  CONSTRAINT `fk_prova_questao_prova_id` FOREIGN KEY (`prova_id`) REFERENCES `prova` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_prova_questao_questao_id` FOREIGN KEY (`questao_id`) REFERENCES `questao` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ck_prova_questao_1` CHECK (posicao BETWEEN 1 AND 20),
  CONSTRAINT `ck_prova_questao_2` CHECK (pontuacao > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Questões de uma prova, com ordem e pontuação individual. Resolve a relação N:N entre prova e questão; o limite de 20 questões (RF04) é garantido pela posição de 1 a 20.';

-- aplicacao (Provas e Aplicações - Felipe)
CREATE TABLE `aplicacao` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `turma_id` INT UNSIGNED NOT NULL COMMENT 'Turma que recebe a prova',
  `prova_id` INT UNSIGNED NOT NULL COMMENT 'Prova aplicada',
  `status` ENUM('PENDENTE','APLICADA') NOT NULL DEFAULT 'PENDENTE' COMMENT 'PENDENTE até o PDF ser baixado; depois APLICADA',
  `quantidade` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Quantidade de cópias a gerar (sem vínculo com a turma)',
  `data_aplicacao` DATE NULL COMMENT 'Data em que a prova foi aplicada',
  `embaralhar_questoes` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 para embaralhar a ordem das questões em cada cópia (RF06)',
  `embaralhar_alternativas` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 para embaralhar as alternativas em cada cópia (RF06)',
  `vincular_alunos` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 para gerar uma cópia nominal por aluno matriculado (RF07)',
  `criada_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora de criação',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_aplicacao_turma_id` FOREIGN KEY (`turma_id`) REFERENCES `turma` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_aplicacao_prova_id` FOREIGN KEY (`prova_id`) REFERENCES `prova` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Aplicação de uma prova a uma turma (RF05). A mesma prova pode ser aplicada várias vezes (ex.: segunda chamada).';

-- copia_prova (Geração de PDF e Gabarito - Matheus)
CREATE TABLE `copia_prova` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `aplicacao_id` INT UNSIGNED NOT NULL COMMENT 'Aplicação a que a cópia pertence',
  `aluno_id` INT UNSIGNED NULL COMMENT 'Aluno identificado na cópia; nulo quando a prova é gerada sem identificação (RF07)',
  `codigo` CHAR(6) NOT NULL COMMENT 'Código público da cópia, usado no QR Code e na consulta do gabarito',
  `rotulo` VARCHAR(120) NOT NULL COMMENT 'Nome do aluno ou "Prova #01" quando anônima',
  `ordem_embaralhamento` JSON NOT NULL COMMENT 'Ordem das questões e das alternativas desta cópia (RF06)',
  `gabarito_publicado` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 quando o gabarito foi publicado no link público (RF08)',
  `gabarito_publicado_em` DATETIME NULL COMMENT 'Data e hora da publicação do gabarito',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_copia_prova_codigo` (`codigo`),
  CONSTRAINT `fk_copia_prova_aplicacao_id` FOREIGN KEY (`aplicacao_id`) REFERENCES `aplicacao` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_copia_prova_aluno_id` FOREIGN KEY (`aluno_id`) REFERENCES `aluno` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Cópia da prova gerada para uma pessoa (uma cópia por aluno ou anônima), com ordem própria de questões e alternativas.';

-- correcao (Correção e Notas - Miguel)
CREATE TABLE `correcao` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador único do registro',
  `aluno_id` INT UNSIGNED NULL COMMENT 'Aluno dono da nota; nos lançamentos manuais é o aluno escolhido pelo professor',
  `copia_prova_id` INT UNSIGNED NOT NULL COMMENT 'Cópia corrigida; no máximo uma correção por cópia',
  `professor_id` INT UNSIGNED NOT NULL COMMENT 'Professor que corrigiu ou lançou a nota',
  `nota` DECIMAL(5,2) NOT NULL COMMENT 'Soma da pontuação das questões corretas',
  `tipo` ENUM('AUTOMATICA','MANUAL') NOT NULL COMMENT 'Como a nota foi obtida',
  `corrigida_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora da correção ou do lançamento',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_correcao_copia_prova_id` (`copia_prova_id`),
  CONSTRAINT `fk_correcao_aluno_id` FOREIGN KEY (`aluno_id`) REFERENCES `aluno` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_correcao_copia_prova_id` FOREIGN KEY (`copia_prova_id`) REFERENCES `copia_prova` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_correcao_professor_id` FOREIGN KEY (`professor_id`) REFERENCES `usuario` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Correção de uma cópia: nota calculada automaticamente (RF09) ou lançada manualmente (RF10).';
