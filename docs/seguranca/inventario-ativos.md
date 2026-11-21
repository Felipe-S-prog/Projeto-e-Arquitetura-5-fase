# Inventário de ativos de informação — SGP

> **Simulação acadêmica.** O SGP não tem certificação. Este inventário mostra o que seria exigido pela ABNT NBR ISO/IEC 27001 se o sistema fosse operado oficialmente. Posição em 21/11/2026, com base no código da `main` e na hospedagem atual.

O inventário é o registro dos ativos que processam, armazenam ou transmitem informação no SGP. É a base da [análise de riscos](analise-riscos.md) e da classificação da informação. A planilha com os mesmos dados está em [`inventario-ativos.csv`](inventario-ativos.csv) (abre no Excel).

## Como foi feito

Seguindo as etapas essenciais de estruturação do inventário:

1. **Levantar os ativos:** por frente do projeto (autenticação, turmas e questões, provas e aplicações, PDF e gabarito, correção e notas) e pela infraestrutura usada (repositório, hospedagem, banco), conferindo no código e nos arquivos de configuração.
2. **Registrar os atributos:** identificação única, descrição, categoria, proprietário, custodiante e localização.
3. **Classificar:** nível de sensibilidade (controle 5.12 da ISO 27002) e criticidade em confidencialidade, integridade e disponibilidade (C-I-D). Nos ativos de identidade (contas e sessões), a autenticidade acompanha a integridade.
4. **Manter atualizado:** revisar a cada mudança de infraestrutura, sistema ou processo (por exemplo, quando entrarem o cadastro livre de professores e a leitura da folha pela foto) e, no mínimo, a cada entrega.

## Campos

| Campo | Significado |
|---|---|
| ID | Código único: `INF` informação, `SW` software, `NUV` serviço em nuvem, `HRD` hardware, `PES` pessoas |
| Nome e descrição | O que é o ativo e para que serve |
| Categoria | Informação, Software, Serviço em nuvem, Hardware ou Pessoas |
| Proprietário | Quem responde pelo ciclo de vida e pela segurança do ativo (responsável da frente) |
| Custodiante | Quem opera ou guarda o ativo no dia a dia |
| Localização | Onde o ativo está (nuvem, servidor, computador) |
| Classificação | Público, Interno, Confidencial ou Restrito (ver abaixo) |
| C / I / D | Impacto se houver perda de confidencialidade, integridade ou disponibilidade: Alta, Média ou Baixa |

Níveis de classificação usados (detalhados na [classificação da informação](classificacao-informacao.md)):

| Nível | Quem pode ver | Exemplo no SGP |
|---|---|---|
| **Público** | Qualquer pessoa | Código-fonte (repositório público), gabarito já publicado |
| **Interno** | Equipe do projeto | Estrutura do banco, configuração da API |
| **Confidencial** | Só o professor dono e quem ele autorizar | Dados de alunos, provas antes da aplicação |
| **Restrito** | Só o titular ou o próprio sistema; vazamento causa dano grave | Notas, hash de senha, tokens, segredos |

Responsáveis por frente (papéis simulados; o comitê do SGSI é definido em documento próprio): Bruno — autenticação e infraestrutura da API e do banco; Camila — turmas e questões; Felipe — provas, aplicações, repositório e publicação do front; Matheus — PDF e gabarito; Miguel — correção e notas.

## Inventário

### Informação

| ID | Nome e descrição | Categoria | Proprietário | Custodiante | Localização | Classificação | C | I | D |
|---|---|---|---|---|---|---|---|---|---|
| INF-001 | Contas de professor: nome, e-mail e hash da senha (bcrypt) — tabela `usuario` | Informação | Bruno (Autenticação) | Bruno (banco) | MySQL no Aiven | Restrito | Alta | Alta | Média |
| INF-002 | Sessões: refresh tokens guardados como hash SHA-256, dispositivo e validade — tabela `refresh_token` | Informação | Bruno (Autenticação) | Bruno (banco) | MySQL no Aiven | Restrito | Alta | Alta | Média |
| INF-003 | Alunos e matrículas: nome, e-mail e número de matrícula — tabelas `aluno` e `matricula` (dado pessoal, LGPD) | Informação | Camila (Turmas) | Bruno (banco) | MySQL no Aiven | Confidencial | Alta | Média | Média |
| INF-004 | Banco de questões e provas: enunciados, alternativas, alternativa correta, pontuação — `questao`, `alternativa`, `prova`, `prova_questao` | Informação | Camila (Questões) e Felipe (Provas) | Bruno (banco) | MySQL no Aiven | Confidencial | Média | Alta | Média |
| INF-005 | Aplicações e cópias: código de cada prova, ordem embaralhada, aluno vinculado e situação do gabarito — `aplicacao`, `copia_prova` | Informação | Felipe (Aplicações) e Matheus (Cópias) | Bruno (banco) | MySQL no Aiven | Confidencial | Alta | Alta | Média |
| INF-006 | Correções e notas: nota, respostas marcadas por questão e aluno — `correcao`, `correcao_resposta` (dado pessoal de desempenho) | Informação | Miguel (Correção) | Bruno (banco) | MySQL no Aiven | Restrito | Alta | Alta | Média |
| INF-007 | Gabarito publicado: letras certas de cada prova, consultadas sem login pelo código | Informação | Matheus (Gabarito) | Bruno (API) | API no Render | Público | Baixa | Alta | Média |
| INF-008 | PDFs das provas impressas (com nome do aluno, quando vinculadas) | Informação | Matheus (PDF) | Professor (usuário) | Gerados na API e baixados no computador do professor; não ficam no servidor | Confidencial | Média | Alta | Média |
| INF-009 | Relatórios exportados de notas (CSV, Excel e PDF) | Informação | Miguel (Relatórios) | Professor (usuário) | Computador do professor | Restrito | Alta | Média | Baixa |
| INF-010 | Imagens das questões enviadas pelo professor (JPG, PNG, WebP até 5 MB) | Informação | Camila (Questões) | Bruno (API) | Disco do servidor da API no Render (`server/uploads/questoes`) | Confidencial | Média | Média | Média |
| INF-011 | Fotos das folhas de resposta para a leitura automática (nome do aluno e marcações) | Informação | Miguel (Correção) | Professor (usuário) | Celular ou computador do professor; lidas no navegador, não enviadas ao servidor | Restrito | Alta | Média | Baixa |
| INF-012 | Segredos de configuração: chave de assinatura do JWT, senha do banco, token de publicação do Cloudflare | Informação | Bruno (API e banco) e Felipe (publicação) | Bruno e Felipe | Variáveis de ambiente no Render, segredos do GitHub Actions e `.env` local (fora do Git) | Restrito | Alta | Alta | Alta |
| INF-013 | Documentação do projeto: README, ADRs, especificação da API, manual | Informação | Matheus (documentação) | Equipe | Repositório no GitHub | Público | Baixa | Média | Baixa |

### Software

| ID | Nome e descrição | Categoria | Proprietário | Custodiante | Localização | Classificação | C | I | D |
|---|---|---|---|---|---|---|---|---|---|
| SW-001 | Código-fonte do SGP (front, API, migrations, testes) | Software | Felipe (repositório) | Equipe | GitHub (repositório público) | Público | Baixa | Alta | Média |
| SW-002 | API Node.js/Express: autenticação, regras de negócio, geração de PDF, relatórios | Software | Bruno (API) | Bruno | Render | Interno | Média | Alta | Alta |
| SW-003 | Aplicação web React usada pelo professor e página pública de gabarito | Software | Felipe (front) | Felipe | Cloudflare Pages | Público | Baixa | Alta | Alta |
| SW-004 | Estrutura do banco MySQL 8 (migrations versionadas com verificação de integridade) | Software | Camila (modelo de dados) | Bruno (banco) | Aiven e repositório | Interno | Média | Alta | Alta |
| SW-005 | Bibliotecas de terceiros (npm): express, helmet, bcryptjs, mysql2, pdf-lib, qrcode, multer, React, Vite, jsQR | Software | Equipe | Equipe | `package.json` e `package-lock.json` | Público | Baixa | Alta | Média |

### Serviços em nuvem

| ID | Nome e descrição | Categoria | Proprietário | Custodiante | Localização | Classificação | C | I | D |
|---|---|---|---|---|---|---|---|---|---|
| NUV-001 | Render: hospedagem da API (plano gratuito, dorme após inatividade) | Serviço em nuvem | Bruno (infraestrutura) | Provedor Render | Nuvem | Interno | Média | Alta | Alta |
| NUV-002 | Aiven: MySQL gerenciado (dados de produção, conexão com SSL) | Serviço em nuvem | Bruno (infraestrutura) | Provedor Aiven | Nuvem | Restrito | Alta | Alta | Alta |
| NUV-003 | Cloudflare Pages: hospedagem do front, publicado a cada merge na `main` | Serviço em nuvem | Felipe (publicação) | Provedor Cloudflare | Nuvem | Público | Baixa | Alta | Alta |
| NUV-004 | GitHub: repositório, revisão por PR e GitHub Actions (com segredos de publicação) | Serviço em nuvem | Felipe (repositório) | Provedor GitHub | Nuvem | Interno | Média | Alta | Média |

### Hardware e pessoas

| ID | Nome e descrição | Categoria | Proprietário | Custodiante | Localização | Classificação | C | I | D |
|---|---|---|---|---|---|---|---|---|---|
| HRD-001 | Computadores da equipe: código, `.env` local e banco local (Docker) com dados de teste | Hardware | Cada integrante | Cada integrante | Computadores pessoais | Confidencial | Média | Média | Baixa |
| HRD-002 | Computador e celular do professor: sessão no navegador, PDFs, relatórios e fotos das folhas | Hardware | Professor (usuário) | Professor (usuário) | Dispositivos pessoais | Confidencial | Alta | Média | Média |
| PES-001 | Equipe de desenvolvimento (5 integrantes) com acesso ao repositório e às contas dos provedores | Pessoas | Felipe (coordenação do repositório) | Cada integrante | — | Interno | Alta | Alta | Média |
| PES-002 | Professores usuários do sistema (únicos usuários com login) | Pessoas | Coordenação (cliente) | — | — | Interno | Alta | Média | Média |

## Observações do levantamento

- **Nenhum segredo está versionado:** o `.env` fica fora do Git e só o `.env.example`, sem valores, vai para o repositório. Como o repositório é público, isso é essencial.
- **Dados pessoais de alunos** aparecem em INF-003, INF-005, INF-006, INF-008, INF-009 e INF-011. Eles são o foco da LGPD e das normas ISO 27018 e 27701.
- **Dados que não ficam no servidor:** os PDFs e os relatórios são gerados sob demanda e baixados, e as fotos das folhas são lidas no próprio navegador. Isso reduz o que fica guardado na nuvem, mas passa a responsabilidade do arquivo para o professor.
- **Imagens das questões no disco do servidor (INF-010):** em serviços sem disco persistente, o Render apaga os arquivos a cada nova publicação. Isso é tratado como risco na análise.
