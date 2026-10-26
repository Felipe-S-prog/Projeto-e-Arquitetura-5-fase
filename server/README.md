# SGP — API (back-end)

API do Sistema de Geração de Provas: **Node.js + Express + MySQL**, organizada em camadas
`rota → controller → service → repository → model`. Esta pasta é a base que todas as frentes
(Autenticação, Turmas e Questões, Provas e Aplicações, PDF e Gabarito, Correção e Notas) vão usar.

## O que já existe

- Servidor Express com CORS restrito ao front, cabeçalhos de segurança (helmet) e JSON de erro padronizado.
- Conexão com o MySQL por *pool* (`mysql2`), configurada por variáveis de ambiente.
- Sistema de **migrations**: scripts `.sql` aplicados uma única vez por banco, na ordem do nome.
- Uma fatia de exemplo completa, `health`, que percorre todas as camadas (use como modelo).
- Testes automatizados (`npm test`) para validar as regras e utilitários sem precisar subir o servidor.
- Migrations compartilhadas `001`, `002` e `003` para criar a estrutura atual do banco.
- Autenticação com senha bcrypt, JWT de acesso e refresh token rotativo (T07).

## Requisitos

- Node.js **20.19 ou superior** (testado com Node 22)
- MySQL **8.0** — pode ser o instalado na sua máquina **ou** o do Docker (`docker-compose.yml`)

## Como rodar

```powershell
cd server
npm install
Copy-Item .env.example .env      # Linux/Mac: cp .env.example .env
```

Escolha **uma** das opções de banco:

**A) MySQL instalado na sua máquina** — edite o `.env` com o seu acesso, por exemplo:

```
DB_USER=root
DB_PASSWORD=a_senha_do_seu_mysql
DB_NAME=sgp
```

**B) MySQL no Docker** — não precisa mudar o `.env` (os valores já batem com o `docker-compose.yml`):

```powershell
docker compose up -d
```

Depois:

```powershell
npm run db:migrate    # cria o banco "sgp" (se não existir) e aplica as migrations pendentes
npm run dev           # sobe a API em http://localhost:3333 (reinicia sozinha ao salvar)
```

Conferindo:

- <http://localhost:3333/api/health> → a API está de pé.
- <http://localhost:3333/api/health/db> → o MySQL respondeu (mostra o nome do banco e a latência).

## Variáveis de ambiente (`.env`)

| Variável | Padrão | Para que serve |
|---|---|---|
| `PORT` | `3333` | Porta da API |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Endereço(s) do front autorizados a chamar a API (CORS); vários separados por vírgula |
| `DB_HOST` | `127.0.0.1` | Servidor do MySQL |
| `DB_PORT` | `3306` | Porta do MySQL |
| `DB_USER` | — (obrigatória) | Usuário do MySQL |
| `DB_PASSWORD` | — (obrigatória, pode ser vazia) | Senha do MySQL |
| `DB_NAME` | — (obrigatória) | Nome do banco (só letras, números e `_`) |
| `JWT_ACCESS_SECRET` | segredo de desenvolvimento | Segredo JWT; obrigatório e exclusivo em produção (mínimo de 32 caracteres) |
| `JWT_ACCESS_TTL_SECONDS` | `900` | Validade do token de acesso, em segundos |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Validade do refresh token, em dias |
| `ALLOW_ADMIN_BOOTSTRAP` | `true` em desenvolvimento; `false` em produção | Habilita a configuração inicial do administrador na tela de login |
| `ADMIN_EMAIL_DOMAINS` | `catolicasc.org.br` | Domínios aceitos para administradores, separados por vírgula |
| `PROFESSOR_EMAIL_DOMAINS` | `catolicasc.org.br,catolicasc.edu.br` | Domínios aceitos para professores, separados por vírgula |

O arquivo `.env` **nunca** vai para o GitHub (está no `.gitignore`); só o `.env.example`.

## Autenticação (T07)

- `GET /api/auth/bootstrap-status`: informa se ainda falta criar o primeiro administrador.
- `POST /api/auth/bootstrap-admin`: cria o primeiro administrador; só funciona enquanto não houver administrador não anonimizado.
- `POST /api/auth/register`: ativa um convite criado pelo administrador, definindo a senha inicial.
- `POST /api/auth/login`: valida e-mail e senha e emite JWT de acesso + refresh token.
- `POST /api/auth/refresh`: troca o refresh token por um novo par de tokens; o token anterior é revogado.
- `POST /api/auth/logout`: revoga o refresh token da sessão atual.

As senhas são armazenadas com bcrypt. O banco guarda apenas o hash SHA-256 dos refresh tokens. As rotas de negócio exigem `Authorization: Bearer <accessToken>`; a API consulta a conta no banco e valida o papel antes de permitir o acesso. As listas de domínios devem ser ajustadas em `.env` para os endereços institucionais usados pela equipe.

O primeiro uso deve ser feito na tela de login, em **Configurar o primeiro administrador**. Em produção, defina `JWT_ACCESS_SECRET` com um valor aleatório exclusivo (a variável fica vazia no `.env.example` de propósito). Para configurar o primeiro administrador em produção, habilite `ALLOW_ADMIN_BOOTSTRAP=true` temporariamente; depois do cadastro, desabilite a opção no provedor de hospedagem. Depois, o administrador cadastra os usuários como **Convidado**; a pessoa convidada usa **Primeiro acesso? Ative seu convite** para escolher a senha. O status de usuário não substitui a validação de senha: convidados não conseguem fazer login.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API em modo desenvolvimento (reinicia ao salvar) |
| `npm start` | API em modo normal |
| `npm run db:migrate` | Cria o banco e aplica as migrations pendentes |
| `npm run db:reset` | **Apaga o banco** e aplica tudo de novo (só desenvolvimento; bloqueado com `NODE_ENV=production`) |
| `npm run db:seed` | Insere os dados de demonstração de `database/seeds/` (só desenvolvimento; pode rodar várias vezes) |
| `npm test` | Roda os testes automatizados |

## Migrations

Cada arquivo `.sql` em `database/migrations/` roda **uma vez** por banco, em ordem de nome
(`001_...`, `002_...`). O nome fica registrado na tabela `schema_migrations`, então todo mundo do
grupo chega ao mesmo banco com `npm run db:migrate`.

- A migration inicial compartilhada é `database/migrations/001_criar_tabelas.sql`; as migrations já aplicadas não devem ser editadas.
- **Não edite uma migration já aplicada**: o sistema detecta a mudança (checksum) e para com um aviso.
  Para alterar o banco, crie um arquivo novo (`002_ajuste_xyz.sql`). Se for só no seu computador,
  `npm run db:reset` recria tudo do zero.
- No MySQL, `CREATE`/`ALTER TABLE` não têm *rollback*: se uma migration falhar no meio, o que veio antes
  dela no arquivo já foi aplicado. Por isso prefira arquivos pequenos.

## Dados de demonstração (seeds)

Os arquivos `.sql` de `database/seeds/` inserem dados de exemplo para testar as telas sem cadastrar tudo
à mão. Ao contrário das migrations, **não** são registrados no banco: rodam sempre que você chamar
`npm run db:seed` e são escritos para não duplicar nada (`INSERT IGNORE` com ids fixos a partir de 9001).

- `001_demo_correcao.sql`: turma, alunos, prova e cópias já geradas para testar Correção, Relatórios e
  Histórico do aluno (códigos e passo a passo no próprio arquivo).

## Estrutura e responsabilidade de cada camada

```
server/
├── database/migrations/     # scripts .sql do banco
├── src/
│   ├── routes/              # liga "método + caminho" ao controller e monta as camadas
│   ├── controllers/         # fala HTTP: lê a requisição, chama o service, devolve a resposta
│   ├── services/            # regras de negócio; não conhece Express nem SQL
│   ├── repositories/        # ÚNICA camada que escreve SQL
│   ├── models/              # converte a linha do banco no objeto usado pela aplicação
│   ├── middlewares/         # erros, rota inexistente, log de requisições
│   ├── errors/              # AppError (erros esperados, com status HTTP)
│   ├── database/            # pool, migrations e mensagens de erro de conexão
│   ├── config/              # leitura e validação das variáveis de ambiente
│   ├── utils/               # funções auxiliares (ex.: snake_case → camelCase)
│   ├── app.js               # monta o Express
│   └── server.js            # ponto de entrada
└── test/
```

Uma requisição segue sempre o mesmo caminho: `route → controller → service → repository → MySQL` e
volta pelo mesmo caminho como JSON. Regra de ouro: **SQL só no repository** e **req/res só no controller**.

## Como criar um recurso novo (ex.: questões)

1. `models/question.model.js` — converte a linha do banco em objeto (use `toCamelCase`).
2. `repositories/question.repository.js` — `createQuestionRepository(pool)` com as consultas SQL.
3. `services/question.service.js` — regras de negócio; lance `AppError.notFound(...)`, `AppError.badRequest(...)` etc.
4. `controllers/question.controller.js` — lê `req.params`/`req.body` e responde com `res.json(...)`.
5. `routes/question.routes.js` — monta repository → service → controller e define os caminhos.
6. Registre em `routes/index.js`: `router.use('/questoes', createQuestionRoutes({ pool }));`

Use sempre `?` (ou `:nome`) para os valores no SQL; **nunca** concatene texto vindo do usuário na consulta.
Copie a fatia `health` como ponto de partida.

## Formato dos erros

Toda resposta de erro tem o mesmo formato:

```json
{ "error": { "code": "NOT_FOUND", "message": "Questão não encontrada" } }
```

| Situação | Status | `code` |
|---|---|---|
| Dados inválidos / JSON quebrado | 400 | `BAD_REQUEST` / `INVALID_JSON` |
| Não autenticado / sem permissão | 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN` |
| Rota ou registro inexistente | 404 | `NOT_FOUND` |
| Valor repetido (UNIQUE), FK inexistente, registro em uso | 409 | `DUPLICATE_ENTRY` / `REFERENCE_NOT_FOUND` / `IN_USE` |
| Banco fora do ar ou credencial recusada | 503 | `DB_UNAVAILABLE` |
| Bug inesperado | 500 | `INTERNAL_ERROR` (sem detalhe interno) |

## Conferindo no seu MySQL (2 minutos)

Para ver o sistema de migrations funcionando de verdade:

1. Crie `database/migrations/000_teste.sql` com `CREATE TABLE teste (id INT PRIMARY KEY);`
2. `npm run db:migrate` → mostra `aplicada: 000_teste.sql`.
3. Rode de novo → `0 aplicada(s), 1 já estavam aplicadas`.
4. Edite o conteúdo do arquivo e rode de novo → aviso de que a migration foi alterada.
5. **Apague** o arquivo de teste e rode `npm run db:reset` para voltar ao estado limpo. Não commite esse arquivo.
