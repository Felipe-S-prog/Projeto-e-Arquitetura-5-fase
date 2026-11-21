# Análise de riscos de segurança da informação — SGP

> **Simulação acadêmica.** Análise feita como seria exigido pela ABNT NBR ISO/IEC 27001, seguindo o processo de gestão de riscos da ISO/IEC 27005. Posição em 21/11/2026, com base no código da `main` e na hospedagem atual. Os IDs de ativos vêm do [inventário](inventario-ativos.md). A planilha está em [`analise-riscos.csv`](analise-riscos.csv).

## Processo

1. **Identificação — o que pode acontecer?** Para cada ativo do inventário, a ameaça (o que pode dar errado) e a vulnerabilidade (a falha que permite isso).
2. **Análise — qual a probabilidade e o impacto?** Escalas simples de 1 a 3, e o nível do risco é a multiplicação.
3. **Tratamento — o que fazer?** Para cada risco, os controles que o SGP já tem (com a evidência no código) e a decisão: **mitigar** (reduzir com um novo controle), **aceitar** (conviver, com justificativa), **transferir** (passar a um terceiro, como o provedor) ou **evitar** (deixar de fazer a atividade).
4. **Monitoramento — revisar a cada entrega** e sempre que o sistema mudar (ciclo PDCA).

### Escalas

| Valor | Probabilidade | Impacto |
|---|---|---|
| 1 — Baixa/Baixo | Pouco provável no período do projeto | Afeta poucos dados ou é fácil de corrigir |
| 2 — Média/Médio | Pode acontecer | Afeta uma turma ou aplicação, ou exige trabalho para corrigir |
| 3 — Alta/Alto | Esperado acontecer | Expõe dados pessoais, altera notas ou deixa o sistema fora do ar |

**Nível = Probabilidade × Impacto:** 1–2 **Baixo**, 3–4 **Médio**, 6–9 **Alto**.

## Matriz de riscos

| Probabilidade \ Impacto | 1 — Baixo | 2 — Médio | 3 — Alto |
|---|---|---|---|
| **3 — Alta** | | R06, R08 | |
| **2 — Média** | | R04, R10, R14, R15 | R01, R12 |
| **1 — Baixa** | R05 | R11, R13 | R02, R03, R07, R09, R16 |

Resumo: **4 altos** (R01, R06, R08, R12), **9 médios** e **3 baixos** (R05, R11, R13).

## Registro de riscos

| ID | Risco (ameaça e vulnerabilidade) | Ativos | C-I-D | P | I | Nível | Controles existentes (evidência) | Tratamento e ação |
|---|---|---|---|---|---|---|---|---|
| R01 | Tentativas em massa de senha no login (força bruta) aproveitando que não há limite de tentativas | INF-001, SW-002 | C | 2 | 3 | Alto (6) | Senha com hash bcrypt e mínimo de 8 caracteres (`utils/password.js`); mensagem genérica "e-mail ou senha inválidos" | **Mitigar:** limitar tentativas no login, cadastro e renovação de sessão, com resposta 429 (T40) |
| R02 | Um professor ver ou alterar dados de outro professor por falha de filtro numa rota | INF-003 a INF-006 | C, I | 1 | 3 | Médio (3) | Toda consulta filtra pelo professor do token; o `professor_id` enviado pelo navegador é ignorado (`middlewares/apiAuth.js`); testes de isolamento entre professores | **Mitigar:** manter os testes de isolamento e a revisão obrigatória de PR para toda rota nova |
| R03 | Roubo da sessão por script malicioso na página (XSS), já que os tokens ficam no `localStorage` | INF-002, SW-003 | C | 1 | 3 | Médio (3) | React escapa o conteúdo exibido; token de acesso dura 15 minutos; refresh token rotativo; "sair de todos os dispositivos" invalida as sessões | **Mitigar:** cabeçalho de política de conteúdo (CSP) no front publicado. **Aceitar** o `localStorage` nesta versão (trocar por cookie protegido exige mudar o login) |
| R04 | Gabarito ou prova divulgados antes da aplicação (publicação por engano ou PDF compartilhado) | INF-004, INF-005, INF-008 | C | 2 | 2 | Médio (4) | Publicação é manual e por aplicação; pode ser desfeita ("despublicar", T59); a consulta exige o código impresso; os PDFs não ficam no servidor | **Mitigar:** pedir confirmação ao publicar o gabarito de aplicação ainda pendente; orientar no manual o manuseio do PDF (Confidencial até a prova) |
| R05 | Descobrir gabaritos testando códigos na consulta pública | INF-007 | C | 1 | 1 | Baixo (1) | 32⁶ ≈ 1 bilhão de códigos possíveis; só responde gabarito já publicado; devolve só as letras, nunca nota ou nome; resposta não fica em cache (`gabarito.controller.js`) | **Aceitar**, com melhoria simples: gerar os códigos com gerador criptográfico (`crypto.randomInt` no lugar de `Math.random`) e incluir a rota pública no limite de tentativas |
| R06 | API fora do ar ou lenta: o plano gratuito "dorme" depois de um tempo sem uso | NUV-001, SW-002 | D | 3 | 2 | Alto (6) | Rota de verificação `/api/health`; o front mostra erro de conexão | **Mitigar:** mensagem de espera no front (T51), verificação periódica e plano B para o dia da apresentação (T42). **Transferir** em produção real: plano pago com disponibilidade garantida |
| R07 | Perda ou corrupção dos dados do banco (falha do provedor, exclusão acidental, migration com erro) | NUV-002, SW-004, INF-001 a INF-006 | I, D | 1 | 3 | Médio (3) | Migrations versionadas com verificação de integridade; operações críticas em transação; banco gerenciado pelo Aiven | **Mitigar:** documentar o backup do provedor e fazer um teste de restauração (T42) |
| R08 | Imagens das questões perdidas quando a API é publicada de novo (disco do servidor não é persistente) | INF-010, NUV-001 | D, I | 3 | 2 | Alto (6) | Upload valida tipo pelo conteúdo do arquivo e limita a 5 MB; o PDF avisa quando uma imagem não carrega | **Mitigar:** guardar as imagens fora do disco do servidor (no banco ou num serviço de armazenamento persistente) |
| R09 | Vazamento de segredo (chave do JWT, senha do banco, token do Cloudflare), com o repositório público aumentando o impacto | INF-012, SW-001 | C, I | 1 | 3 | Médio (3) | `.env` fora do Git (conferido: nenhum segredo versionado); segredos só no Render e no GitHub Actions; conexão com o banco por SSL | **Mitigar:** procedimento de troca dos segredos em caso de suspeita e checagem de segredos na revisão de PR |
| R10 | Biblioteca de terceiros com vulnerabilidade conhecida | SW-005 | C, I, D | 2 | 2 | Médio (4) | `npm audit` sem vulnerabilidades no servidor e no front em 21/11/2026 | **Mitigar:** rodar `npm audit` automaticamente a cada PR ou ativar alertas de dependências no GitHub |
| R11 | Alguém assumir uma conta antiga ainda sem senha só informando o e-mail (cadastro livre de professores) | INF-001 | C, I (autenticidade) | 1 | 2 | Baixo (2) | Só vale para contas criadas antes do cadastro livre e nunca ativadas; o fluxo de convite antigo já funcionava assim | **Aceitar** nesta versão e registrar; em produção real, **mitigar** com confirmação por e-mail (T39) |
| R12 | Golpe (phishing ou engenharia social) para obter a senha da conta de um integrante no GitHub, Render, Aiven ou Cloudflare | PES-001, NUV-001 a NUV-004, INF-012 | C, I, D | 2 | 3 | Alto (6) | Contas individuais, sem senha compartilhada | **Mitigar:** exigir autenticação em dois fatores (MFA) nas contas da equipe nesses provedores e conscientizar a equipe |
| R13 | Perda ou roubo do computador de um integrante com o `.env` e o banco local | HRD-001, INF-012 | C | 1 | 2 | Baixo (2) | O banco local tem só dados de teste; segredos de produção não ficam no repositório | **Mitigar** pela política: bloqueio de tela, criptografia do disco e troca dos segredos se o equipamento for perdido |
| R14 | Relatórios com notas e fotos de folhas esquecidos ou compartilhados a partir do computador do professor | INF-009, INF-011, HRD-002 | C | 2 | 2 | Médio (4) | Exportação só para o professor dono; fotos lidas no navegador, sem envio ao servidor | **Mitigar** com orientação no manual e na política: manuseio de informação Restrita e descarte dos arquivos |
| R15 | Não conseguir investigar um incidente porque não há registro de quem acessou as notas | INF-006, SW-002 | C (rastreabilidade) | 2 | 2 | Médio (4) | Log de cada requisição com método, rota, status e tempo (`middlewares/requestLogger.js`), sem o usuário | **Mitigar:** logs estruturados com o usuário e registro de acesso a notas e relatórios (T41) |
| R16 | Nota alterada indevidamente (erro ou ação maliciosa) | INF-006 | I | 1 | 3 | Médio (3) | Só o professor dono corrige; a nota é calculada no servidor a partir das respostas, sem confiar no valor do navegador; corrigir de novo exige substituição explícita | **Mitigar** junto com R15: registrar quem lançou ou substituiu cada correção |

## Plano de tratamento por prioridade

| Prioridade | Riscos | Ação | Onde está no backlog |
|---|---|---|---|
| 1 | R01 | Limite de tentativas no login, cadastro e renovação de sessão | T40 (Bruno) |
| 1 | R06 | Mensagem de espera, verificação periódica e plano B da apresentação | T51 (Felipe) e T42 (Bruno) |
| 1 | R08 | Armazenamento persistente das imagens das questões | Nova (proposta) |
| 1 | R12 | MFA obrigatório nas contas da equipe nos provedores | Nova (procedimento, sem código) |
| 2 | R07 | Documentar e testar a restauração do backup | T42 (Bruno) |
| 2 | R15, R16 | Logs com usuário e registro de acesso às notas | T41 (opcional no backlog) |
| 2 | R10 | Verificação automática de dependências | Junto com a integração contínua (T43) |
| 3 | R03, R04, R05, R09, R13, R14 | CSP no front, confirmação ao publicar gabarito, gerador criptográfico dos códigos, procedimento de troca de segredos, orientações de manuseio | Novas (pequenas) |
| — | R11 | Aceito nesta versão, com registro | T39 se houver tempo |

## Riscos aceitos

| Risco | Justificativa |
|---|---|
| R05 | O dado exposto é o gabarito já publicado, que é público por decisão do professor, e o espaço de códigos torna a tentativa e erro impraticável. |
| R11 | Afeta só contas antigas nunca ativadas, que no ambiente atual são de teste; sem serviço de e-mail no plano gratuito, a confirmação fica para uma versão futura. |
| R03 (parcial) | Mover a sessão para cookie protegido muda o fluxo de login de todo o sistema perto da entrega; os controles atuais (token curto, rotação, logout geral) reduzem o tempo de exposição. |
