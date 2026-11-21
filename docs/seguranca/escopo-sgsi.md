# Escopo e papéis do SGSI — SGP

> **Simulação acadêmica.** Definição do Sistema de Gestão da Segurança da Informação (SGSI) como seria feita na fase de planejamento da ABNT NBR ISO/IEC 27001, se o SGP fosse operado oficialmente. Versão 1.0, de 21/11/2026. Os papéis são distribuídos entre os integrantes do projeto para fins do trabalho.

## 1. O que é o SGSI do SGP

O SGSI é o conjunto de políticas, processos, papéis e controles que mantém a segurança da informação do SGP de forma contínua, e não como uma ação isolada. A ISO 27001 orienta **como** implantar, sem definir tecnologias: as escolhas técnicas ficam na [análise de riscos](analise-riscos.md) e nos [controles](controles-iso27002.md).

## 2. Escopo

**Dentro do escopo**

| Item | Descrição |
|---|---|
| Sistema | SGP: aplicação web do professor, página pública de gabarito e API |
| Processos | Cadastro e login do professor; turmas e alunos; banco de questões; montagem e aplicação de provas; geração de PDF; publicação do gabarito; correção (manual e pela foto da folha); relatórios e histórico |
| Dados | Contas de professores, dados de alunos, questões, provas, cópias, gabaritos, correções e notas |
| Infraestrutura | API no Render, banco MySQL no Aiven, front no Cloudflare Pages, repositório e publicação no GitHub |
| Pessoas | Equipe de desenvolvimento (5 integrantes) e professores usuários |

**Fora do escopo** (com a justificativa)

| Item | Por quê |
|---|---|
| Infraestrutura física dos provedores (data centers, servidores, rede) | Responsabilidade dos provedores em nuvem, que têm as próprias certificações (ver ISO 27017 nos [controles](controles-iso27002.md)) |
| Sistemas acadêmicos da instituição (matrícula oficial, diário de classe) | O SGP não se integra a eles; o professor cadastra os alunos no próprio SGP |
| Computadores e celulares dos professores | Não são administrados pela equipe; entram só pelas regras de manuseio da [classificação](classificacao-informacao.md) |
| App mobile e microsserviços | Fora do escopo do produto (ADR-001) |

## 3. Partes interessadas

| Parte | O que espera da segurança |
|---|---|
| Professores | Que suas provas não vazem antes da aplicação e que só eles vejam as notas das suas turmas |
| Alunos | Que seus dados e notas não sejam expostos e que o gabarito consultado esteja correto |
| Instituição (cliente) | Conformidade com a LGPD e confiança no sistema que vai substituir parte do processo atual |
| Equipe | Regras claras para desenvolver e manter o sistema sem expor dados |
| Provedores (Render, Aiven, Cloudflare, GitHub) | Uso das contas conforme os termos e configuração segura do que é responsabilidade do cliente |

Requisitos legais e contratuais: **LGPD** (dados pessoais de alunos e professores) e os termos de uso dos provedores.

## 4. Objetivos de segurança

Objetivos medíveis, revisados a cada entrega:

| Objetivo | Como medir | Meta |
|---|---|---|
| Nenhum acesso de um professor aos dados de outro | Testes de isolamento passando em toda entrega | 100% |
| Nenhum segredo no repositório | Revisão de PR e busca no histórico | 0 ocorrências |
| Dependências sem vulnerabilidade alta | `npm audit` a cada entrega | 0 altas ou críticas |
| Riscos altos com tratamento definido | Plano de tratamento da análise de riscos | 4 de 4 |
| Contas da equipe nos provedores com MFA | Conferência das contas | 100% |
| Restauração do backup testada | Teste registrado | 1 por semestre |

## 5. Papéis (comitê do SGSI)

| Papel | Integrante | Responsabilidades |
|---|---|---|
| **Gestor de segurança da informação** | Matheus Kuchenbecker | Manter a política, o inventário e a análise de riscos; coordenar a resposta a incidentes; apresentar o SGSI à direção (cliente) |
| **Encarregado de dados (LGPD)** | Camila Texeira | Garantir que os dados de alunos sejam usados só para a finalidade das provas; responder a pedidos dos titulares; validar novas funções que tratem dados pessoais |
| **Custodiante da infraestrutura da API e do banco** | Bruno Rovani Marcelino | Render e Aiven: segredos, backup e restauração, acessos; autenticação e sessões |
| **Custodiante do repositório e da publicação** | Felipe dos Santos | GitHub (acessos, revisão obrigatória, segredos do Actions) e Cloudflare Pages |
| **Responsável pela integridade das notas** | Miguel Carlos Bertoldi | Correção e relatórios: garantir que notas só mudem por ação do professor e que os relatórios exportados sigam a classificação Restrito |

Todos os integrantes são **desenvolvedores** e seguem as regras de desenvolvimento seguro da [política](politica-seguranca.md). A **direção** é representada pelo cliente do projeto, que aprova a política e o escopo.

## 6. Critérios de risco

Os riscos são avaliados por **probabilidade × impacto**, em escala de 1 a 3, e classificados como Baixo (1–2), Médio (3–4) ou Alto (6–9). **Riscos altos** precisam de tratamento antes da entrega; riscos médios entram no plano de tratamento; riscos baixos podem ser aceitos com justificativa registrada. Detalhes na [análise de riscos](analise-riscos.md).

## 7. Ciclo PDCA no SGP

| Fase | No SGP |
|---|---|
| **Plan** (planejar) | Escopo e papéis (este documento), [inventário de ativos](inventario-ativos.md), [análise de riscos](analise-riscos.md) e escolha dos [controles](controles-iso27002.md) |
| **Do** (executar) | Aplicar a [política](politica-seguranca.md) e a [classificação](classificacao-informacao.md); implementar os controles do plano de tratamento |
| **Check** (verificar) | Testes automatizados a cada PR, revisão de código, `npm audit`, conferência dos objetivos do item 4 e dos incidentes registrados |
| **Act** (agir) | Corrigir o que falhou, atualizar a análise de riscos e revisar a política na entrega seguinte |
