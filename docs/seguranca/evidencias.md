# Evidências dos controles de segurança — SGP

> **Simulação acadêmica.** Verificação (fase *Check* do PDCA) de que os controles descritos nos [controles da ISO 27002](controles-iso27002.md) existem de fato no SGP. Executada em 21/11/2026, no sistema local com o código da `main` e no sistema publicado (só leitura), com contas e dados de teste.

## Resumo

| # | Evidência | Resultado | Controle (27002) | Risco |
|---|---|---|---|---|
| 1 | Cabeçalhos de segurança no sistema publicado | ✅ API com HSTS, CSP, `nosniff` e proteção contra embutir a página; http redireciona para https. 🟡 Front **sem CSP nem HSTS** | Gerenciamento das operações e comunicações | R03 |
| 2 | Senha e sessão guardadas só como hash | ✅ Senha em bcrypt com custo 12; refresh token em SHA-256 | Controle de acesso | — |
| 3 | Login com senha errada | ✅ Mensagem genérica, que não revela se o e-mail existe. 🟡 **Nenhuma das 8 tentativas foi bloqueada** | Controle de acesso | R01 |
| 4 | Isolamento entre professores | ✅ Dados de outro professor respondem 404, mesmo forjando o `professor_id` | Controle de acesso; separação entre clientes (27017) | R02 |
| 5 | Consulta pública do gabarito | ✅ Só código, título, data e letras; sem cache; gabarito não publicado responde 403 | Classificação (Público); minimização (27018) | R05 |
| 6 | Sair de todos os dispositivos | ✅ A outra sessão para de valer na hora e não consegue renovar | Controle de acesso; gestão de incidentes (contenção) | R03 |
| 7 | Upload de arquivo disfarçado de imagem | ✅ Recusado pela assinatura do conteúdo, não pelo nome | Segurança operacional (malware) | — |
| 8 | Segredos fora do repositório público | ✅ Só os `.env.example` estão versionados; o `.env` é ignorado pelo Git | Desenvolvimento e manutenção de sistemas | R09 |
| 9 | Dependências | ✅ `npm audit`: 0 vulnerabilidades no servidor e no front | Gerenciamento das operações (atualizações) | R10 |

As duas evidências parciais (1 e 3) confirmam riscos já registrados na [análise de riscos](analise-riscos.md), com ação no plano: CSP e HSTS no front (R03) e limite de tentativas no login (R01, T40).

## Observação sobre o ambiente

Na máquina usada, um software de segurança inspeciona o tráfego HTTPS, e o Node.js e o npm não reconheceram a cadeia de certificados até receberem a opção `--use-system-ca`, que usa os certificados do Windows. Não é uma falha do SGP. Vale registrar como cuidado operacional: desligar a verificação de certificado (`NODE_TLS_REJECT_UNAUTHORIZED=0`) nunca é a solução, porque abre caminho para interceptação.

## Saída completa

```text
Evidências de segurança do SGP — 21/11/2026, 15:49:04
Sistema local (código da main) e sistema publicado (somente leitura). Contas e dados de teste.

==============================================================================
EVIDÊNCIA 1 — Cabeçalhos de segurança no sistema publicado
Referência: Gerenciamento das operações e comunicações (27002) · R03
==============================================================================
API (Render) — https://sgp-api-97te.onrender.com/api/health → HTTP 200
   ✔ strict-transport-security: max-age=31536000; includeSubDomains
   ✔ content-security-policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;form-a…
   ✔ x-content-type-options: nosniff
   ✔ x-frame-options: SAMEORIGIN
   ✔ referrer-policy: no-referrer
   ✔ cross-origin-opener-policy: same-origin
Front (Cloudflare Pages) — https://sgp-front-dc1.pages.dev → HTTP 200
   ✘ strict-transport-security: (ausente)
   ✘ content-security-policy: (ausente)
   ✔ x-content-type-options: nosniff
   ✘ x-frame-options: (ausente)
   ✔ referrer-policy: strict-origin-when-cross-origin
   ✘ cross-origin-opener-policy: (ausente)
Acesso por http:// → 301 para https://sgp-front-dc1.pages.dev/
Conclusão: a API envia todos os cabeçalhos do helmet; o front ainda não tem CSP nem HSTS (ação do plano para R03).

==============================================================================
EVIDÊNCIA 2 — Senha e sessão guardadas só como hash no banco
Referência: Controle de acesso (27002) · classificação Restrito
==============================================================================
usuario.senha_hash de professor.demo@catolicasc.edu.br: "$2b$12$…" (60 caracteres)
   → "$2b$12$" = bcrypt com custo 12; a senha em si não fica em lugar nenhum.
refresh_token.token_hash: 64 caracteres hexadecimais (SHA-256); o token entregue ao navegador não é guardado.

==============================================================================
EVIDÊNCIA 3 — Login com senha errada
Referência: Controle de acesso (27002) · R01
==============================================================================
   8 tentativas → 401 "E-mail ou senha inválidos."
Conclusão: a mensagem não revela se o e-mail existe; nenhuma tentativa foi bloqueada (não há HTTP 429) — é o risco R01, tratado pela T40.

==============================================================================
EVIDÊNCIA 4 — Um professor não acessa os dados de outro
Referência: Controle de acesso / Desenvolvimento seguro (27002) · R02 · separação entre clientes (27017)
==============================================================================
   Professora Exemplo → própria aplicação (9016): HTTP 200
   Professora Exemplo → aplicação de Professor Demonstração (9015): HTTP 404 "Aplicação não encontrada."
   Professora Exemplo → cópias da aplicação de Professor Demonstração: HTTP 404 "Aplicação não encontrada."
   Professora Exemplo → tentativa de forjar professor_id=1 na URL: HTTP 404 "Aplicação não encontrada."
Conclusão: o dado de outro professor responde 404 (nem confirma que existe); o professor_id enviado pelo navegador é ignorado.

==============================================================================
EVIDÊNCIA 5 — Consulta pública do gabarito: só as letras, sem login
Referência: Classificação (Público) · ISO 27018 (minimização) · R05
==============================================================================
GET /api/gabarito/K8U22P (sem token) → HTTP 200, Cache-Control: no-store
   campos devolvidos: code, examTitle, publishedAt, answers
   respostas: 1=B  2=D  3=A  4=C  5=B
GET /api/gabarito/DEMA22 (gabarito não publicado) → HTTP 403 "O gabarito desta prova ainda não foi publicado pelo professor."
Conclusão: nada de nota, nome ou pontuação; gabarito não publicado não aparece; resposta não fica em cache.

==============================================================================
EVIDÊNCIA 6 — Sair de todos os dispositivos encerra as outras sessões
Referência: Controle de acesso / Gestão de incidentes (contenção) (27002) · R03
==============================================================================
Duas sessões da Professora Exemplo: dispositivo A e dispositivo B.
   B antes: GET /relatorios/aplicacoes → HTTP 200
   A chama POST /auth/logout-all → HTTP 204
   B depois, com o mesmo token: HTTP 401 "Sua sessão foi encerrada. Entre novamente."
   B tenta renovar a sessão: HTTP 401 "Refresh token inválido ou expirado."
Conclusão: em caso de suspeita de senha vazada, todas as sessões param de valer na hora.

==============================================================================
EVIDÊNCIA 7 — Upload recusa arquivo disfarçado de imagem
Referência: Segurança operacional (malware) / Desenvolvimento seguro (27002)
==============================================================================
Arquivo de texto com nome "foto.png" e tipo image/png → HTTP 400 "O conteúdo do arquivo não corresponde a uma imagem válida."
Conclusão: o servidor confere o conteúdo real do arquivo (assinatura), não só o nome ou o tipo informado.

==============================================================================
EVIDÊNCIA 8 — Nenhum segredo no repositório (que é público)
Referência: Desenvolvimento seguro (27002) · R09
==============================================================================
Arquivos .env versionados: client/.env.example, server/.env.example
server/.env está ignorado pelo Git: server/.gitignore:2:.env	server/.env
Conclusão: só os modelos (.env.example), sem valores, estão no repositório.

==============================================================================
EVIDÊNCIA 9 — Dependências sem vulnerabilidades conhecidas
Referência: Gerenciamento das operações (atualizações) (27002) · R10
==============================================================================
npm audit (server): found 0 vulnerabilities
npm audit (client): found 0 vulnerabilities

Fim das evidências.
```
