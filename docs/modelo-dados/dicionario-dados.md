# Dicionário de dados

Gerado a partir do mesmo modelo do DER e do `schema.sql`. Uma tabela por entidade, com campos, tipos e descrição.

### usuario

Professores e administradores (RF01). O aluno não tem conta no sistema.

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| nome | VARCHAR(120) | Nome completo do usuário |
| email | VARCHAR(160) (UQ) | E-mail de login; único (o domínio é validado por papel) |
| senha_hash | VARCHAR(255) (aceita nulo) | Hash bcrypt da senha (RNF02); fica nulo enquanto o usuário está Convidado |
| papel | ENUM('ADMINISTRADOR','PROFESSOR') | Perfil de acesso |
| status | ENUM('CONVIDADO','ATIVO','ANONIMIZADO') | Situação da conta; ANONIMIZADO mantém o histórico (LGPD) |
| criado_em | DATETIME | Data e hora de criação do cadastro |

### refresh_token

Refresh tokens emitidos no login, um por dispositivo (RNF03).

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| usuario_id | INT UNSIGNED (FK → usuario.id) | Dono do token |
| token_hash | CHAR(64) (UQ) | Hash SHA-256 do token (o token em si não é guardado) |
| dispositivo | VARCHAR(120) (aceita nulo) | Identificação do dispositivo, usada no logout do dispositivo atual |
| expira_em | DATETIME | Data e hora de expiração |
| revogado_em | DATETIME (aceita nulo) | Preenchido no logout; "sair de todos os dispositivos" revoga todos do usuário |

### turma

Turmas de um professor (RF03). Cada professor só vê as próprias turmas (RNF04).

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| professor_id | INT UNSIGNED (FK → usuario.id) | Professor dono da turma |
| nome | VARCHAR(100) | Nome da turma (ex.: Cálculo I - Turma A) |
| disciplina | VARCHAR(80) | Disciplina (ex.: Matemática) |
| periodo | VARCHAR(10) | Período letivo (ex.: 2026/2) |
| status | ENUM('ATIVA','ARQUIVADA') | Turmas arquivadas não aceitam novas aplicações |
| codigo_convite | CHAR(8) (UQ, aceita nulo) | Código para o aluno entrar na turma; único, gerado e regenerado pelo professor |

### aluno

Registro do aluno informado pelo professor (nome e e-mail). Não gera conta de acesso (RF03).

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| nome | VARCHAR(120) | Nome do aluno |
| email | VARCHAR(160) (UQ) | E-mail do aluno; único |
| numero_matricula | VARCHAR(30) (aceita nulo) | Número de matrícula acadêmica, quando informado (atributo matricula do diagrama de classes) |

### matricula

Matrícula de um aluno em uma turma (ClassEnrollment). Resolve a relação N:N entre turma e aluno.

| Campo | Tipo | Descrição |
|---|---|---|
| turma_id | INT UNSIGNED (PK, FK → turma.id) | Turma |
| aluno_id | INT UNSIGNED (PK, FK → aluno.id) | Aluno matriculado |
| matriculado_em | DATETIME | Data e hora da matrícula |

### questao

Banco de questões de cada professor (RF02): objetivas e discursivas, com exclusão lógica.

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| professor_id | INT UNSIGNED (FK → usuario.id) | Professor dono da questão |
| tipo | ENUM('OBJETIVA','DISCURSIVA') | Tipo da questão |
| enunciado | TEXT | Texto do enunciado |
| imagem_url | VARCHAR(500) (aceita nulo) | Caminho ou URL da imagem anexada à questão |
| excluida_em | DATETIME (aceita nulo) | Exclusão lógica (soft-delete): preenchido quando a questão é excluída |

### tag

Rótulos usados para filtrar questões (ex.: Álgebra).

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| nome | VARCHAR(50) (UQ) | Texto da tag; único |

### questao_tag

Associa tags a questões. Resolve a relação N:N entre questão e tag.

| Campo | Tipo | Descrição |
|---|---|---|
| questao_id | INT UNSIGNED (PK, FK → questao.id) | Questão |
| tag_id | INT UNSIGNED (PK, FK → tag.id) | Tag |

### alternativa

Alternativas das questões objetivas, no máximo 5 por questão (o mínimo de 2 é validado na API). Questões discursivas não têm alternativas.

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| questao_id | INT UNSIGNED (FK → questao.id) | Questão a que a alternativa pertence |
| texto | TEXT | Texto da alternativa |
| correta | TINYINT(1) | 1 se for a alternativa correta |
| ordem | TINYINT UNSIGNED | Posição original da alternativa, de 0 a 4 (no máximo 5 por questão); única dentro da questão |

### prova

Prova reutilizável do professor (RF04). Status: RASCUNHO, PRONTA (na primeira aplicação) e ARQUIVADA (manual).

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| professor_id | INT UNSIGNED (FK → usuario.id) | Professor dono da prova |
| titulo | VARCHAR(150) | Título da prova |
| descricao | TEXT (aceita nulo) | Descrição ou assunto da prova |
| status | ENUM('RASCUNHO','PRONTA','ARQUIVADA') | Situação da prova |
| criada_em | DATETIME | Data e hora de criação |

### prova_questao

Questões de uma prova, com ordem e pontuação individual. Resolve a relação N:N entre prova e questão; o limite de 20 questões (RF04) é garantido pela posição de 1 a 20.

| Campo | Tipo | Descrição |
|---|---|---|
| prova_id | INT UNSIGNED (PK, FK → prova.id) | Prova |
| questao_id | INT UNSIGNED (PK, FK → questao.id) | Questão incluída na prova |
| posicao | TINYINT UNSIGNED | Posição da questão na prova, de 1 a 20; única dentro da prova |
| pontuacao | DECIMAL(5,2) | Pontos que a questão vale nesta prova (RF04) |

### aplicacao

Aplicação de uma prova a uma turma (RF05). A mesma prova pode ser aplicada várias vezes (ex.: segunda chamada).

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| turma_id | INT UNSIGNED (FK → turma.id) | Turma que recebe a prova |
| prova_id | INT UNSIGNED (FK → prova.id) | Prova aplicada |
| status | ENUM('PENDENTE','APLICADA') | PENDENTE até o PDF ser baixado; depois APLICADA |
| quantidade | INT UNSIGNED | Quantidade de cópias a gerar (sem vínculo com a turma) |
| data_aplicacao | DATE (aceita nulo) | Data em que a prova foi aplicada |
| embaralhar_questoes | TINYINT(1) | 1 para embaralhar a ordem das questões em cada cópia (RF06) |
| embaralhar_alternativas | TINYINT(1) | 1 para embaralhar as alternativas em cada cópia (RF06) |
| vincular_alunos | TINYINT(1) | 1 para gerar uma cópia nominal por aluno matriculado (RF07) |
| criada_em | DATETIME | Data e hora de criação |

### copia_prova

Cópia da prova gerada para uma pessoa (uma cópia por aluno ou anônima), com ordem própria de questões e alternativas.

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| aplicacao_id | INT UNSIGNED (FK → aplicacao.id) | Aplicação a que a cópia pertence |
| aluno_id | INT UNSIGNED (FK → aluno.id, aceita nulo) | Aluno identificado na cópia; nulo quando a prova é gerada sem identificação (RF07) |
| codigo | CHAR(6) (UQ) | Código público da cópia, usado no QR Code e na consulta do gabarito |
| rotulo | VARCHAR(120) | Nome do aluno ou "Prova #01" quando anônima |
| ordem_embaralhamento | JSON | Ordem das questões e das alternativas desta cópia (RF06) |
| gabarito_publicado | TINYINT(1) | 1 quando o gabarito foi publicado no link público (RF08) |
| gabarito_publicado_em | DATETIME (aceita nulo) | Data e hora da publicação do gabarito |

### correcao

Correção de uma cópia: nota calculada automaticamente (RF09) ou lançada manualmente (RF10).

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT UNSIGNED (PK) | Identificador único do registro |
| aluno_id | INT UNSIGNED (FK → aluno.id, aceita nulo) | Aluno dono da nota; nos lançamentos manuais é o aluno escolhido pelo professor |
| copia_prova_id | INT UNSIGNED (FK → copia_prova.id, UQ) | Cópia corrigida; no máximo uma correção por cópia |
| professor_id | INT UNSIGNED (FK → usuario.id) | Professor que corrigiu ou lançou a nota |
| nota | DECIMAL(5,2) | Soma da pontuação das questões corretas |
| tipo | ENUM('AUTOMATICA','MANUAL') | Como a nota foi obtida |
| corrigida_em | DATETIME | Data e hora da correção ou do lançamento |

### correcao_resposta

Resposta de cada questão em uma correção pelas respostas marcadas (migration `003_correcao_respostas.sql`). Lançamentos manuais não têm linhas aqui.

| Campo | Tipo | Descrição |
|---|---|---|
| correcao_id | INT UNSIGNED (PK, FK → correcao.id) | Correção a que a resposta pertence |
| questao_id | INT UNSIGNED (PK, FK → questao.id) | Questão respondida |
| numero | TINYINT UNSIGNED (UQ com correcao_id) | Número da questão como foi impressa nesta cópia (1 a 20) |
| letra_marcada | CHAR(1) (aceita nulo) | Letra marcada pelo aluno, na ordem impressa da cópia; nulo quando ficou em branco ou é discursiva |
| correta | TINYINT(1) (aceita nulo) | 1 se a letra marcada é a correta; nulo nas discursivas |
| pontos | DECIMAL(5,2) | Pontos obtidos na questão |
