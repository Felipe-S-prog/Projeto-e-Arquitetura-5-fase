# Arquitetura em camadas do SGP

Este documento descreve como a API do SGP (`server/`) é organizada e por que. Ele vale para todas as
frentes (Autenticação, Turmas e Questões, Provas e Aplicações, PDF e Gabarito, Correção e Notas): cada
recurso novo segue o mesmo caminho, e qualquer pessoa do grupo sabe onde procurar cada coisa.

![Diagrama da arquitetura em camadas](diagrama-camadas.png)

## 1. Visão geral

O SGP tem três partes:

| Parte | Tecnologia | Papel |
|---|---|---|
| Front-end (`client/`) | React 19 + Vite, publicado no Netlify | Telas do professor e a página pública do gabarito. Só conversa com a API por HTTP/JSON. |
| API (`server/`) | Node.js + Express 5 | Regras de negócio, validação, isolamento de dados entre professores e acesso ao banco. |
| Banco | MySQL 8 | Dados persistentes. A estrutura é criada pelas migrations em `server/database/migrations/`. |

Dentro da API, cada requisição atravessa sempre as mesmas camadas, nesta ordem:

```
rota  →  controller  →  service  →  repository  →  MySQL
                                        │
                                      model  (converte a linha do banco no objeto da API)
```

A resposta volta pelo mesmo caminho, como JSON. A **dependência é sempre de cima para baixo**: o
controller conhece o service, o service conhece o repository, mas nunca o contrário. Assim, trocar o
banco ou testar uma regra não exige mexer nas camadas de cima.

Essa é a arquitetura exigida pela disciplina (RNF01). A especificação de referência do cliente propunha
microsserviços; o projeto usa uma **API única em camadas**, que atende ao escopo do semestre com bem menos
infraestrutura (ver Seção 1 do README).

## 2. Responsabilidade de cada camada

| Camada | Pasta | Pode | Não pode |
|---|---|---|---|
| **Rota** | `src/routes/` | Ligar "método + caminho" a uma função do controller; montar as camadas do recurso (pool → repository → service → controller); aplicar middlewares do recurso. | Ter regra de negócio, ler `req.body`, escrever SQL. |
| **Controller** | `src/controllers/` | Falar HTTP: ler `req.params`, `req.query` e `req.body`, chamar o service e responder com `res.status(...).json(...)`. | Decidir regra de negócio ou acessar o banco. |
| **Service** | `src/services/` | Regras de negócio e validações (ex.: "uma prova tem no máximo 20 questões"); lançar `AppError` quando uma regra é violada; combinar dados de mais de um repository. | Conhecer Express (`req`/`res`) ou escrever SQL. |
| **Repository** | `src/repositories/` | Ser a **única** camada com SQL; executar consultas com parâmetros (`?`); devolver objetos do model. | Ter regra de negócio ou devolver a linha crua do banco. |
| **Model** | `src/models/` | Converter a linha do banco (`snake_case`, `DECIMAL`, `DATETIME`) no objeto da API (`camelCase`, número, texto ISO). | Acessar o banco ou HTTP. |

Regras de ouro: **SQL só no repository**, **`req`/`res` só no controller** e **regra de negócio só no
service**.

### Peças transversais

Além das cinco camadas, alguns módulos atendem todas elas:

| Pasta | O que tem |
|---|---|
| `src/middlewares/` | `requestLogger` (log de cada requisição), `notFound` (rota inexistente → 404) e `errorHandler` (transforma qualquer erro na resposta JSON padrão). |
| `src/errors/` | `AppError`: erro "esperado", com status HTTP (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`). |
| `src/config/` | Leitura e validação das variáveis de ambiente (`.env`). A API não sobe com configuração inválida. |
| `src/database/` | Pool de conexões do MySQL, sistema de migrations e mensagens claras para erros de conexão. |
| `src/utils/` | Funções auxiliares sem regra de negócio (ex.: `toCamelCase`). |
| `src/app.js` | Monta o Express: segurança (helmet), CORS restrito ao front, leitura de JSON, rotas e tratamento de erros. |
| `src/server.js` | Ponto de entrada: lê a configuração, cria o pool, sobe o servidor e faz o encerramento limpo. |

## 3. O caminho de uma requisição

Exemplo real, a fatia `health` (que serve de modelo para os outros recursos): `GET /api/health/db`.

1. **`app.js`** recebe a requisição, aplica helmet, CORS e o leitor de JSON e entrega para o roteador
   montado em `/api`.
2. **`routes/index.js`** encaminha `/health` para `routes/health.routes.js`, que já montou as camadas do
   recurso:
   ```js
   const repository = createHealthRepository(pool);
   const service = createHealthService(repository);
   const controller = createHealthController(service);
   router.get('/db', controller.database);
   ```
3. **`controllers/health.controller.js`** chama `healthService.database()` e responde com `res.json(...)`.
4. **`services/health.service.js`** mede o tempo, chama `healthRepository.pingDatabase()` e monta o
   resultado (`status`, `database`, `latencyMs`).
5. **`repositories/health.repository.js`** executa `SELECT DATABASE(), NOW(3)` no pool e passa a linha
   para o model.
6. **`models/health.model.js`** converte a linha `{ db, now }` em `{ database, serverTime }`.
7. A resposta volta subindo as camadas e sai como JSON:
   `{ "status": "ok", "database": "sgp", "serverTime": "...", "latencyMs": 3 }`.

### Quando algo dá errado

Nenhuma camada monta resposta de erro. Elas **lançam** e o `errorHandler` (último middleware) responde:

| Origem do erro | Resposta |
|---|---|
| Service lança `AppError.notFound('Questão não encontrada')` | `404 { "error": { "code": "NOT_FOUND", "message": "Questão não encontrada" } }` |
| MySQL recusa valor duplicado em coluna `UNIQUE` | `409 DUPLICATE_ENTRY` |
| MySQL fora do ar ou credencial errada | `503 DB_UNAVAILABLE` |
| JSON quebrado no corpo | `400 INVALID_JSON` |
| Qualquer outro erro (bug) | `500 INTERNAL_ERROR`, sem detalhe interno; o erro real aparece só no terminal da API |

No Express 5, funções `async` que lançam erro já chegam ao `errorHandler`, então os controllers não
precisam de `try/catch`.

## 4. Injeção de dependências

Cada camada é uma **fábrica** que recebe a camada de baixo como parâmetro
(`createXService(repository)`, `createXRepository(pool)`), e quem liga tudo é o arquivo de rotas. O pool
de conexões é criado uma única vez em `server.js` e passado para `createApp({ pool, config })`.

Isso tem duas consequências práticas:

- **Testes sem banco:** os testes passam um pool falso para a API, ou um repository falso para o service,
  e verificam o comportamento sem precisar de MySQL (`npm test`).
- **Troca localizada:** se o acesso ao banco mudar, só o repository muda; service e controller continuam
  iguais.

## 5. Banco de dados e migrations

- A estrutura do banco vem do MER/DER (`docs/modelo-dados/`) e é aplicada pelas **migrations**
  (`server/database/migrations/NNN_descricao.sql`), em ordem de nome, uma vez por banco
  (`npm run db:migrate`). O nome e o checksum de cada uma ficam na tabela `schema_migrations`.
- Migration já aplicada **não é editada**: qualquer mudança no banco é uma migration nova.
- As consultas usam sempre parâmetros (`?`), nunca texto do usuário concatenado no SQL (proteção contra
  SQL injection).
- O pool usa UTC (`timezone: 'Z'`) e devolve `DECIMAL` como número, então todos do grupo veem as mesmas
  datas e notas.

## 6. Segurança e isolamento

- **CORS** restrito ao endereço do front (`CLIENT_ORIGIN`).
- **helmet** envia os cabeçalhos HTTP de segurança e remove o `X-Powered-By`.
- **Erros 500 não vazam** mensagem interna para quem chamou a API.
- **Isolamento entre professores (RNF04):** os repositories filtram pelo professor dono do registro
  (prova, turma, questão). Registro de outro professor responde `404`, como se não existisse.
- Senhas com hash (bcrypt) e JWT + refresh token entram com a frente de Autenticação (T07); a partir daí
  o professor da requisição passa a vir do token.

## 7. Como criar um recurso novo

1. `models/<recurso>.model.js`: converte a linha do banco no objeto da API.
2. `repositories/<recurso>.repository.js`: `create<Recurso>Repository(pool)` com as consultas SQL.
3. `services/<recurso>.service.js`: regras de negócio; lança `AppError` quando algo é inválido.
4. `controllers/<recurso>.controller.js`: lê a requisição e responde.
5. `routes/<recurso>.routes.js`: monta repository → service → controller e define os caminhos.
6. Registra em `routes/index.js`: `router.use('/<recurso>', create<Recurso>Routes({ pool }));`
7. Se o banco mudou, cria a migration `NNN_<descricao>.sql`.
8. Escreve os testes em `server/test/` (service com repository falso; rotas com pool falso).

Use a fatia `health` como ponto de partida. Os detalhes de execução (variáveis de ambiente, scripts e
formato dos erros) estão em [`server/README.md`](../../server/README.md).

## 8. Estrutura de pastas da API

```
server/
├── database/migrations/     # scripts .sql do banco, aplicados em ordem
├── src/
│   ├── routes/              # método + caminho → controller; monta as camadas do recurso
│   ├── controllers/         # HTTP: lê a requisição e devolve a resposta
│   ├── services/            # regras de negócio
│   ├── repositories/        # SQL (única camada que acessa o banco)
│   ├── models/              # linha do banco → objeto da API
│   ├── middlewares/         # log, 404 e tratamento de erros
│   ├── errors/              # AppError
│   ├── database/            # pool, migrations e mensagens de erro de conexão
│   ├── config/              # variáveis de ambiente
│   ├── utils/               # funções auxiliares
│   ├── app.js               # monta o Express
│   └── server.js            # ponto de entrada
└── test/                    # testes automatizados (node --test), sem MySQL
```
