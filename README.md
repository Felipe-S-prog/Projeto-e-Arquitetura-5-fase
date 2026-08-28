<div align="center">

# 🚀 SGP – Sistema de Geração de Provas

**Plataforma web para professores criarem, aplicarem e corrigirem provas de forma automatizada, com consulta de notas e gabaritos pelos alunos.**

🔗 **Link do sistema hospedado:** '''https://...
<br>
🔗 **Link dos slides:** https://catolicasc-my.sharepoint.com/:p:/g/personal/matheus_kuchenbecker_catolicasc_edu_br/IQAvxzL0gGprSa9NjLN3J_VeATAhEe-oNpuc5HMO3loNs6I?e=BOYppk

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-F5A623?style=flat-square)
![Entrega](https://img.shields.io/badge/entrega%20atual-N1-3D348B?style=flat-square)
![Licença](https://img.shields.io/badge/licença-uso%20acadêmico-7B4FA6?style=flat-square)

</div>

## 👥 Equipe

| Nome completo | Papel / principais frentes no projeto |
|---|---|
| BRUNO ROVANI MARCELINO | Autenticação e Perfil — cadastro/login de professor e aluno, JWT/refresh token, anonimização de conta (LGPD) |
| CAMILA TEXEIRA | 	Turmas e Questões — criação de turmas, matrícula por e-mail/código de convite, CRUD do banco de questões |
| FELIPE DOS SANTOS | Provas e Aplicações — montagem de provas (banco de questões da prova), aplicação de provas a turmas |
| MATHEUS KUCHENBECKER | Geração de PDF e Gabarito — versões, embaralhamento de questões/alternativas, identificação do aluno, publicação de gabarito |
| MIGUEL CARLOS BERTOLDI | Correção e Notas — fluxo de correção, lançamento manual de nota, relatórios e histórico de notas do aluno |

## 📑 Sumário

- [1. Visão Geral](#1-visão-geral)
- [2. Requisitos](#2-requisitos)
  - [2.1 Funcionais (RF)](#21-funcionais-rf)
  - [2.2 Não Funcionais (RNF)](#22-não-funcionais-rnf)
- [3. Modelagem (UML)](#3-modelagem-uml)
- [4. Telas do Sistema](#4-telas-do-sistema)
- [5. Arquitetura de Software](#5-arquitetura-de-software)
- [6. Decisões Arquiteturais (ADRs)](#6-decisões-arquiteturais-adrs)
- [7. Modelo de Dados](#7-modelo-de-dados)
- [8. Stack Tecnológica](#8-stack-tecnológica)
- [9. Estrutura de Pastas](#9-estrutura-de-pastas)
- [10. Como Executar o Projeto](#10-como-executar-o-projeto)
- [11. Especificação da API](#11-especificação-da-api)
- [12. Testes e Validações](#12-testes-e-validações)
- [13. Manual do Usuário](#13-manual-do-usuário)
- [14. Equipe e Contribuições](#14-equipe-e-contribuições)

---

## 1. Visão Geral

📌 **N1**

**Contexto e problema**

O projeto nasce de uma dor real relatada por professores da Católica SC: em semanas de avaliação, um único professor pode acumular de 200 a 400 provas para corrigir manualmente, um tempo desproporcional diante das demais atividades da rotina docente (aulas, orientações, gestão de turma). Hoje esse processo é resolvido por ferramentas de terceiros como o **GradePen** (gera a prova com embaralhamento de questões/alternativas e corrige via QR Code, mas não indica qual alternativa o aluno marcou em cada questão) e o **Prova Fácil** (faz essa análise estatística, mas não permite montar a prova dentro do próprio sistema, e a geração de caderno de provas nominal só existe no plano pago institucional). Nenhuma das duas resolve o problema de ponta a ponta.

**Objetivo**

Entregar uma plataforma que permita ao professor cadastrar questões, montar provas, gerar o PDF de aplicação (com controle de versões, embaralhamento de questões e alternativas e, quando desejado, identificação do aluno), corrigir a prova a partir da leitura do gabarito preenchido e lançar as notas — tudo em um único sistema, para professores e alunos da Católica SC, reduzindo o tempo de correção e concentrando em um só lugar o que hoje está dividido entre ferramentas concorrentes.

**Escopo**

Dentro do escopo do projeto:

- Cadastro e login de professores e alunos (com domínios de e-mail distintos por papel).
- Banco de questões por professor, objetivas e discursivas.
- Criação de turmas e matrícula de alunos (por e-mail ou código de convite).
- Criação de provas reutilizáveis (banco de questões da prova) e aplicação dessas provas a uma ou mais turmas.
- Geração de um PDF único consolidado por aplicação, com quantidade configurável de versões, embaralhamento de questões e alternativas, e opção de prova com ou sem identificação do aluno.
- Publicação de gabarito (por versão ou por aplicação) para consulta do aluno.
- Correção automatizada a partir da leitura do gabarito preenchido pelo aluno.
- Lançamento manual de nota quando a prova foi gerada sem identificação do aluno.
- Relatórios de notas (por aplicação e consolidados), com exportação.
- Histórico de notas e desempenho do aluno.

Fora do escopo do semestre (ponto em aberto, a validar com o cliente e com a professora da disciplina antes da apresentação de 28/08):

- **App mobile nativo** dedicado à leitura de QR Code — a especificação de referência do cliente prevê um app React Native exclusivo do professor para essa etapa; como a disciplina exige stack **Node.js + Express + MySQL**, a equipe ainda vai decidir se a correção será feita via **web** (ex.: upload da foto do gabarito) ou se o app mobile fica como extensão futura, fora do MVP entregue no semestre.
- **Arquitetura de microsserviços** (Auth, Exam/Class/Application, Grade, Sync, Vision) proposta na especificação de referência — o projeto da disciplina segue uma **arquitetura em camadas única** (rota → controle → serviço → repositório → model), conforme exigido pela metodologia da disciplina.
- Fila de sincronização offline e deduplicação de correções (dependem diretamente do app mobile acima).
- Exclusão física de dados (LGPD) — só a anonimização de conta está prevista.

## 2. Requisitos

📌 **N1** (podem ser ajustados nas entregas seguintes, se o escopo mudar)

### 2.1 Funcionais (RF)

| Código | Requisito |
|---|---|
| RF01 | O sistema deve permitir cadastro e login de professores e alunos. |
| RF02 | O professor deve poder criar, editar, listar e excluir (soft-delete) questões objetivas e discursivas, com tags e filtros. |
| RF03 | O professor deve poder criar turmas e matricular alunos, seja diretamente por e-mail, seja por um código de convite compartilhável. |
| RF04 | O professor deve poder montar provas com quantidade livre de questões (até 20) e pontuação definida individualmente por questão. |
| RF05 | O professor deve poder aplicar uma prova já criada a uma ou mais turmas, gerando aplicações independentes entre si (permitindo reaplicação, ex.: segunda chamada). |
| RF06 | O sistema deve gerar um PDF único e consolidado por aplicação, com opção de múltiplas versões e embaralhamento independente de questões e de alternativas por versão. |
| RF07 | O sistema deve permitir gerar a prova com ou sem identificação do aluno no cabeçalho. |
| RF08 | O sistema deve permitir a publicação do gabarito (por versão ou por aplicação) para consulta do aluno. |
| RF09 | O sistema deve corrigir automaticamente a prova a partir da leitura do gabarito preenchido, calculando a nota conforme a pontuação de cada questão. |
| RF10 | Quando a prova foi gerada sem identificação, o professor deve poder lançar manualmente a nota, associando-a ao aluno correto. |
| RF11 | O professor deve poder gerar relatórios de notas por aplicação e consolidados, com exportação (ao menos CSV/Excel). |
| RF12 | O aluno deve poder consultar seu histórico de notas e o gabarito das provas já publicadas. |

### 2.2 Não Funcionais (RNF)

| Código | Requisito |
|---|---|
| RNF01 | O sistema deve seguir a arquitetura em camadas definida pela disciplina: rota → controle → serviço → repositório → model. |
| RNF02 | As senhas devem ser armazenadas com hash seguro (ex.: bcrypt), nunca em texto puro. |
| RNF03 | O login deve emitir token JWT de acesso e refresh token, com suporte a logout do dispositivo atual e logout de todos os dispositivos. |
| RNF04 | O isolamento de dados entre alunos deve ser garantido: um aluno só pode acessar suas próprias notas e provas. |
| RNF05 | O sistema deve responder em tempo aceitável em uma conexão padrão (meta inicial: até 2s nas operações comuns). |
| RNF06 | O sistema deve estar hospedado em um serviço gratuito (Netlify, Vercel, GitHub Pages ou similar) e permanecer acessível ao longo do semestre. |

## 3. Modelagem (UML)

📌 **N2**

Diagrama de casos de uso, diagrama de classes e diagrama de atividades do sistema (e demais diagramas que forem necessários). Exporte cada diagrama como imagem (PNG ou SVG) e salve em `docs/uml/`, depois insira aqui:

```

- CRIAÇÃO DOS DIAGRAMAS
![Diagrama de Casos de Uso](docs/uml/casos-de-uso.png)

![Diagrama de Classes](docs/uml/diagrama-classes.png)

![Diagrama de Atividades](docs/uml/diagrama-atividades.png)
```

Abaixo de cada imagem, escreva um parágrafo curto explicando o que o diagrama representa.

## 4. Telas do Sistema

📌 **N1**

Prints das telas principais, na ordem do fluxo de navegação (a tela A leva à tela B), salvos em `docs/telas/`. Insira as imagens e, embaixo de cada uma, uma legenda de uma linha dizendo o que ela faz:

```
- CRIAÇÃO DE UMA IMAGEM COM A TELA DE LOGIN
![Tela de login](docs/telas/tela-login.png)
*Tela de login: autenticação do usuário por e-mail e senha.*
```

## 5. Arquitetura de Software

📌 **N3** (pode ser esboçada antes, mas passa a ser obrigatória na entrega final)

Estilo em camadas usado no projeto: `rota → controle → serviço → repositório → model`. Explique, em poucas linhas, a responsabilidade de cada camada (o que ela pode e não pode fazer) e como uma requisição passa por elas até chegar no banco de dados e voltar como resposta.

Insira aqui o **desenho da arquitetura** (diagrama de componentes/camadas), exportado como imagem e salvo em `docs/arquitetura/`:

```
- CRIAÇÃO E APRIMORAMENTO DOS DIAGRAMAS
![Diagrama de arquitetura em camadas](docs/arquitetura/diagrama-camadas.png)
```

## 6. Decisões Arquiteturais (ADRs)

📌 **N2** (primeiras decisões, como a escolha do banco e da estrutura de camadas) e **N3** (registro completo)

Um ADR (*Architecture Decision Record*) documenta uma decisão técnica importante: o que foi decidido, por quê, e quais as consequências. Crie um arquivo por decisão em `docs/adr/`, numerado (`ADR-001-nome-da-decisao.md`, `ADR-002-...`), seguindo este modelo mínimo dentro de cada arquivo:

```
# ADR-001: Título curto da decisão

## Contexto
Qual problema ou dúvida técnica motivou essa decisão.

## Decisão
O que a equipe decidiu fazer.

## Consequências
O que essa escolha facilita, o que ela custa ou limita.
```

Aqui no README, liste os ADRs (Registros de Decisão Arquitetural) criados (se necessário e houver), com link para cada arquivo:

- [ADR-001: Título da decisão](docs/adr/ADR-001-titulo-da-decisao.md)
- [ADR-002: Título da decisão](docs/adr/ADR-002-titulo-da-decisao.md)

> Já há pelo menos uma decisão relevante a registrar aqui: **escopo reduzido em relação à especificação de referência do cliente** (sem app mobile nativo e sem microsserviços, por exigência da stack da disciplina — ver seção 1).

## 7. Modelo de Dados

📌 **N2**

Diagrama MER/DER do banco de dados, exportado como imagem e salvo em `docs/modelo-dados/`:

```
![Modelo Entidade-Relacionamento](docs/modelo-dados/mer-der.png)
```

Em seguida, o dicionário de dados: uma tabela por entidade, com os campos, tipos e uma breve descrição.

| Campo | Tipo | Descrição |
|---|---|---|
| id | INT (PK) | Identificador único do registro |
| nome | VARCHAR(120) | Nome do usuário |

## 8. Stack Tecnológica

📌 **N1** (lista inicial, pode crescer nas entregas seguintes)

Tecnologias usadas no projeto e por que cada uma foi escolhida. A stack obrigatória da disciplina é:

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white)

- **Node.js**: ambiente de execução do back-end.
- **Express**: framework para as rotas e a API REST.
- **MySQL**: banco de dados relacional.

Se a equipe usar outras bibliotecas relevantes (ex.: JWT para autenticação, bcrypt para senhas, dotenv para variáveis de ambiente), liste aqui também, com uma linha dizendo para que serve cada uma.

## 9. Estrutura de Pastas

📌 **N1**, atualizada conforme o projeto cresce

```
src/
  routes/        # define os endpoints e direciona para os controllers
  controllers/    # recebe a requisição, valida e chama o service
  services/       # regras de negócio
  repositories/   # acesso ao banco de dados
  models/         # representação das entidades
docs/
  uml/
  telas/
  arquitetura/
  adr/
  modelo-dados/
  api/
```

## 10. Como Executar o Projeto

📌 **N1**, revisado a cada entrega

Passo a passo para clonar e rodar o projeto localmente, incluindo as versões usadas (ex.: Node 20.x):

```
1. git clone https://github.com/Felipe-S-prog/Projeto-e-Arquitetura-5-fase.git
2. cd Projeto-e-Arquitetura-5-fase
3. npm install
4. copiar .env.example para .env e configurar as variáveis (ex.: dados de acesso ao MySQL)
5. npm run dev
```

## 11. Especificação da API

📌 **N2**

Tabela com os principais endpoints da API. Se a lista crescer muito, mova para um arquivo separado (ex.: `docs/api/especificacao.md`) ou uma coleção do Postman/Insomnia exportada em `docs/api/`, e deixe aqui só o link.

| Método | Rota | Descrição |
|---|---|---|
| GET | /api/recurso | Lista os recursos |
| POST | /api/recurso | Cria um novo recurso |
| PUT | /api/recurso/:id | Atualiza um recurso existente |
| DELETE | /api/recurso/:id | Remove um recurso |

## 12. Testes e Validações

📌 **N3** (validações e tratamento de erros/casos de borda passam a ser cobrados nesta entrega)

Como testar os endpoints principais: descreva o passo a passo ou aponte para a coleção do Postman/Insomnia salva em `docs/api/`. Descreva também as validações e o tratamento de erros e casos de borda implementados (ex.: campo obrigatório vazio, e-mail duplicado, item inexistente), e como o sistema responde em cada caso.

## 13. Manual do Usuário

📌 **N3**

Guia rápido de como usar o sistema, do ponto de vista de quem vai operá-lo (o cliente), não do desenvolvedor: passo a passo das principais funcionalidades, com prints. Pode ficar em um arquivo separado, `docs/manual-usuario.md`, com o link a partir daqui:

📘 [Manual do Usuário](docs/manual-usuario.md)

## 14. Equipe e Contribuições

📌 **N1**, mantido até a N3

Nome: principais contribuições no projeto (ex.: telas de cadastro, integração com banco, documentação). Serve para deixar claro quem fez o quê na entrega da equipe; não substitui o diário de organização de tarefas individual de cada pessoa.

- **Bruno**: Autenticação e Perfil (cadastro/login, JWT/refresh, anonimização de conta).
- **Camila**: Turmas e Questões (turmas, matrícula, banco de questões).
- **Felipe dos Santos**: Provas e Aplicações (montagem e aplicação de provas às turmas).
- **Matheus**: Provas e Aplicações (montagem e aplicação de provas às turmas).
- **Miguel**: Correção e Notas (fluxo de correção, lançamento manual, relatórios, histórico do aluno).

---

<div align="center">

*README elaborado para a disciplina de Projeto e Arquitetura de Software*

</div>
