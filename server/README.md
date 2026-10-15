# SGP — API (back-end)

API do Sistema de Geração de Provas: **Node.js + Express + MySQL**, organizada em camadas
`rota → controller → service → repository → model`. Esta pasta é a base que todas as frentes
(Autenticação, Turmas e Questões, Provas e Aplicações, PDF e Gabarito, Correção e Notas) vão usar.

## O que já existe

- Servidor Express com CORS restrito ao front, cabeçalhos de segurança (helmet) e JSON de erro padronizado.
- Conexão com o MySQL por *pool* (`mysql2`), configurada por variáveis de ambiente.
- Sistema de **migrations**: scripts `.sql` aplicados uma única vez por banco, na ordem do nome.
- Uma fatia de exemplo completa, `health`, que percorre todas as camadas (use como modelo).
- Testes automatizados (`npm test`) que não precisam de MySQL.

> As **tabelas** ainda não existem: elas vêm do script SQL do MER/DER (tarefa T02) e entram como a
> primeira migration (veja "Migrations" abaixo).

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

O arquivo `.env` **nunca** vai para o GitHub (está no `.gitignore`); só o `.env.example`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | API em modo desenvolvimento (reinicia ao salvar) |
| `npm start` | API em modo normal |
| `npm run db:migrate` | Cria o banco e aplica as migrations pendentes |
| `npm run db:reset` | **Apaga o banco** e aplica tudo de novo (só desenvolvimento; bloqueado com `NODE_ENV=production`) |
| `npm test` | Roda os testes automatizados |

## Migrations

Cada arquivo `.sql` em `database/migrations/` roda **uma vez** por banco, em ordem de nome
(`001_...`, `002_...`). O nome fica registrado na tabela `schema_migrations`, então todo mundo do
grupo chega ao mesmo banco com `npm run db:migrate`.

- O script de criação das tabelas (T02) entra como `database/migrations/001_schema_inicial.sql`.
- **Não edite uma migration já aplicada**: o sistema detecta a mudança (checksum) e para com um aviso.
  Para alterar o banco, crie um arquivo novo (`002_ajuste_xyz.sql`). Se for só no seu computador,
  `npm run db:reset` recria tudo do zero.
- No MySQL, `CREATE`/`ALTER TABLE` não têm *rollback*: se uma migration falhar no meio, o que veio antes
  dela no arquivo já foi aplicado. Por isso prefira arquivos pequenos.

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
