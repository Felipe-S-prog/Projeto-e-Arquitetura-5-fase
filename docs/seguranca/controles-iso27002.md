# Controles de segurança — SGP (ISO 27002 e normas complementares)

> **Simulação acadêmica.** Declaração de aplicabilidade simplificada: quais controles da ABNT NBR ISO/IEC 27002 o SGP aplica, como e com que evidência, e como as normas ISO 27017, 27018 e 27701 se aplicam ao sistema. Posição em 21/11/2026, com base no código da `main`.

A ISO 27001 pede que a organização escolha os controles a partir dos riscos; a ISO 27002 é o guia de boas práticas desses controles. Os riscos citados (R01 a R16) estão na [análise de riscos](analise-riscos.md).

**Situação:** ✅ aplicado · 🟡 parcial · ❌ não aplicado (está no plano de ação).

## 1. Controles da ISO 27002 por categoria

| Categoria | Situação | Como o SGP aplica | Evidência | Riscos |
|---|---|---|---|---|
| **Política de segurança** | ✅ | Política com objetivos, diretrizes, direitos, responsabilidades e punições, revisada a cada entrega | [`politica-seguranca.md`](politica-seguranca.md) | Todos |
| **Segurança organizacional** | ✅ | Escopo do SGSI, comitê com papéis definidos e partes interessadas | [`escopo-sgsi.md`](escopo-sgsi.md) | R09, R12 |
| **Classificação e controle de ativos de informação** | ✅ | Inventário com proprietário e custodiante; classificação em quatro níveis (controle 5.12) com regras de manuseio | [`inventario-ativos.md`](inventario-ativos.md), [`classificacao-informacao.md`](classificacao-informacao.md) | R04, R14 |
| **Segurança relacionada às pessoas** | 🟡 | Responsabilidades e conduta frente a malware, phishing e engenharia social estão na política; falta exigir MFA nas contas da equipe e registrar a leitura da política | Política, itens 4.1, 4.7 e 8 | R12, R13 |
| **Segurança ambiental e física** | ✅ (transferido) | Servidores e rede ficam nos data centers dos provedores, que respondem pela segurança física (ver ISO 27017 abaixo); nos computadores da equipe, bloqueio de tela e disco criptografado pela política | Escopo, item 2 | R13 |
| **Gerenciamento das operações e comunicações** | 🟡 | HTTPS no front e na API; conexão com o banco por SSL; cabeçalhos de segurança (helmet); CORS só para o front; limite de 1 MB nas requisições; dependências sem vulnerabilidades (`npm audit`); falta testar o backup e automatizar a verificação de dependências | `server/src/app.js`, `server/src/database/pool.js` | R06, R07, R10 |
| **Controle de acesso** | 🟡 | Login individual; senha com hash bcrypt (custo 12) e mínimo de 8 caracteres; JWT de 15 minutos e refresh token rotativo guardado como hash; sair de todos os dispositivos; cada professor só acessa os próprios dados; mensagem genérica em login errado; falta limitar tentativas | `server/src/utils/password.js`, `server/src/middlewares/apiAuth.js`, `server/src/services/auth.service.js` | R01, R02, R03, R11 |
| **Desenvolvimento e manutenção de sistemas** | ✅ | Toda mudança por Pull Request revisado; testes automatizados de isolamento entre professores; segredos fora do código; migrations versionadas com verificação de integridade; operações críticas em transação; nota calculada no servidor; upload confere o tipo real do arquivo; erros internos não vazam detalhes | `server/test/` (8 arquivos com testes de isolamento), `server/src/database/migrator.js`, `server/src/middlewares/errorHandler.js` | R02, R09, R16 |
| **Gestão de incidentes de segurança** | 🟡 | Roteiro de registro, contenção, recuperação e aprendizado; ferramentas de contenção no sistema (sair de todos os dispositivos, despublicar gabarito); falta log com o usuário para investigar | Política, item 4.8; `server/src/middlewares/requestLogger.js` | R15, R16 |
| **Gestão da continuidade do negócio** | 🟡 | Banco gerenciado com backup pelo provedor; rota de verificação `/api/health`; falta plano B para a API e teste de restauração | `server/src/routes/health.routes.js` | R06, R07, R08 |
| **Conformidade com as diretrizes da empresa** | 🟡 | LGPD aplicada: finalidade, minimização (fotos não guardadas), acesso só do professor dono, anonimização de conta (T38, na main); objetivos de segurança medidos a cada entrega | Política, item 4.3; escopo, item 4 | R14, R15 |

Resumo: **5 categorias aplicadas** (uma delas por transferência aos provedores) e **6 parciais**, todas com a ação correspondente no plano de ação (seção 3).

## 2. Normas complementares

### ISO 27017 — Segurança em nuvem

Todo o SGP roda em nuvem (Render, Aiven, Cloudflare e GitHub). A norma trata da **responsabilidade compartilhada**: o provedor protege a infraestrutura; o cliente, o que configura nela.

| Controle importante | Quem responde | No SGP |
|---|---|---|
| **Gestão de acessos** | SGP | Contas individuais da equipe em cada provedor, revistas a cada entrega; MFA obrigatório pela política; segredos só nas variáveis de ambiente e nos segredos do GitHub |
| **Separação entre clientes** | Provedor (entre empresas) e SGP (entre professores) | Os provedores isolam os clientes deles; dentro do SGP, cada professor é isolado dos outros em toda consulta (testes de isolamento) |
| **Proteção de máquinas virtuais** | Provedor | Render e Aiven mantêm os servidores e o sistema operacional atualizados; o SGP não administra servidores |
| **Monitoramento contínuo** | Ambos | Provedor: disponibilidade da plataforma. SGP: `/api/health`, log de requisições; plano de verificação periódica (T42) |

### ISO 27018 — Proteção de dados pessoais em nuvem

Os dados pessoais de alunos e professores ficam no MySQL do Aiven. Aplicando o que a norma pede:

| Requisito | No SGP |
|---|---|
| **Limitar acessos** | Só o professor da turma vê os dados dos alunos; a equipe não usa dados reais nos testes (banco local com dados fictícios) |
| **Registrar operações** | Hoje há log de requisições sem o usuário; o registro de quem acessou notas e relatórios é ação do plano (R15, T41) |
| **Utilizar criptografia** | Em trânsito: HTTPS no front e na API e SSL até o banco. Em repouso: senhas e tokens só como hash; o Aiven criptografa em repouso tanto as instâncias do banco quanto os backups (confirmado pelo custodiante, Bruno, em 22/11/2026, na [documentação de segurança do Aiven](https://aiven.io/docs/platform/concepts/cloud-security)) |

### ISO 27701 — Gestão da privacidade

Extensão da ISO 27001 para a privacidade, usada aqui para mostrar a conformidade com a LGPD:

| Princípio | No SGP |
|---|---|
| Finalidade | Dados de alunos usados só para gerar, corrigir e acompanhar provas |
| Minimização | Só nome, e-mail, matrícula, respostas e notas; fotos das folhas lidas no navegador e descartadas |
| Transparência | A política é publicada no repositório e resumida no manual do usuário |
| Direitos do titular | Remoção do aluno da turma (T47) e anonimização da conta do professor preservando as notas (T38), ambas já na main |
| Responsabilização | Encarregado de dados definido no [escopo](escopo-sgsi.md); roteiro de incidentes com avaliação de comunicação à ANPD |

## 3. Plano de ação

Ações para os controles parciais, priorizadas pela [análise de riscos](analise-riscos.md). Na escolha de tecnologias, os critérios foram: **preço** (o projeto usa planos gratuitos), **uso corporativo** (solução conhecida e mantida) e **compatibilidade** com o que o SGP já usa (Node.js, React e os provedores atuais, em Windows e Linux).

| Prioridade | Ação | Riscos | Tecnologia escolhida | Critério da escolha | Tipo |
|---|---|---|---|---|---|
| 1 | Limitar tentativas no login, cadastro, renovação de sessão e consulta pública | R01, R05 | Middleware de limite de requisições para Express (`express-rate-limit`) | Gratuito, amplamente usado, integra direto na API atual | Preventiva |
| 1 | Exigir MFA nas contas da equipe (GitHub, Render, Aiven, Cloudflare) | R12 | Recurso nativo de MFA dos próprios provedores, com aplicativo autenticador | Sem custo e sem código | Preventiva |
| 1 | Guardar as imagens das questões fora do disco do servidor | R08 | Armazenar no próprio MySQL ou num serviço de armazenamento de objetos com plano gratuito | Mantém a infraestrutura atual ou usa padrão de mercado; decisão a registrar em ADR | Corretiva |
| 1 | Mensagem de espera e verificação periódica da API; plano B para a apresentação | R06 | Verificação agendada de `/api/health` e aviso no front (T51, T42) | Gratuito; usa o que o sistema já tem | Preventiva |
| 2 | Testar a restauração do backup do banco | R07 | Backup nativo do Aiven | Já incluído no provedor | Controle |
| 2 | Logs com o usuário e registro de acesso a notas e relatórios | R15, R16 | Log estruturado em JSON na API (T41) | Sem nova dependência obrigatória; fácil de buscar | Controle |
| 2 | Verificação automática de dependências a cada PR | R10 | `npm audit` no GitHub Actions ou alertas de dependências do GitHub | Gratuito no GitHub; já usado para publicar o front | Preventiva |
| 3 | Política de conteúdo (CSP) no front publicado | R03 | Arquivo de cabeçalhos do Cloudflare Pages | Gratuito, configuração simples no provedor atual | Preventiva |
| 3 | Confirmação ao publicar o gabarito de aplicação pendente | R04 | Ajuste na tela do gabarito | Sem custo | Preventiva |
| 3 | Gerar os códigos das provas com gerador criptográfico | R05 | `crypto.randomInt` do Node.js | Nativo do Node, sem dependência | Preventiva |
| 3 | Rótulos "Restrito" e "Confidencial" nos relatórios e PDFs | R14 | Texto no rodapé dos arquivos gerados | Sem custo | Preventiva |

Cada ação é implantada primeiro no ambiente local de testes e só depois publicada, pelo mesmo fluxo de Pull Request revisado.
