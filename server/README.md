# SGP — API (back-end)

API do Sistema de Geração de Provas: **Node.js + Express + MySQL**, organizada em camadas `rota → controller → serviço → repositório → model`.

## Autenticação

O sistema possui somente contas de **Professor**. Não existe perfil de administrador, criação de usuários por terceiros ou ativação por convite.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cria uma conta de professor e inicia a sessão. |
| POST | `/api/auth/login` | Autentica o professor e emite JWT + refresh token. |
| POST | `/api/auth/refresh` | Renova a sessão e revoga o refresh token anterior. |
| GET | `/api/auth/session` | Verifica a sessão atual. |
| POST | `/api/auth/logout` | Revoga o refresh token da sessão atual. |
| POST | `/api/auth/logout-all` | Encerra as sessões do professor em todos os dispositivos. |

O cadastro recebe `name`, `email` e `password`. O papel `PROFESSOR` e o status `ATIVO` são definidos exclusivamente no backend. O e-mail é normalizado e precisa ser único. A senha tem no mínimo 8 caracteres e é armazenada com bcrypt. Os refresh tokens são armazenados somente como hash SHA-256.

Contas antigas sem senha podem concluir o próprio cadastro usando o e-mail já registrado. Contas que já possuem senha continuam acessando o sistema normalmente.

## Configuração

Requisitos: Node.js 20.19 ou superior e MySQL 8.0.

Na pasta `server`:

```bash
npm install
cp .env.example .env
npm run db:migrate
npm test
npm run dev
```

No Windows PowerShell, use `Copy-Item .env.example .env` no lugar do `cp`.

Variáveis principais:

| Variável | Uso |
|---|---|
| `PORT` | Porta da API (padrão 3333). |
| `CLIENT_ORIGIN` | Origem do frontend autorizada no CORS. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexão MySQL. |
| `JWT_ACCESS_SECRET` | Segredo JWT; obrigatório em produção e com pelo menos 32 caracteres. |
| `JWT_ACCESS_TTL_SECONDS` | Validade do JWT de acesso. |
| `REFRESH_TOKEN_TTL_DAYS` | Validade dos refresh tokens. |

Não há mais `ALLOW_ADMIN_BOOTSTRAP`, `ADMIN_EMAIL_DOMAINS` ou fluxo de convite.

## Migration da N3

A migration `005_professor_unico.sql` converte registros antigos de administrador para professor e transforma contas pendentes em registros ativos sem senha. Os IDs e os vínculos com turmas, provas e notas são preservados. Uma conta sem senha só consegue entrar depois de concluir o cadastro público.

Não edite migrations já aplicadas. Rode `npm run db:migrate` para aplicar a nova migration.

## Testes

```bash
npm test
```

Antes da PR, valide também o cadastro e o login manualmente, incluindo e-mail repetido, senha curta, conta antiga sem senha e acesso isolado por professor.
