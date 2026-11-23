# Política de Segurança da Informação (PSI) — SGP

> **Simulação acadêmica.** Política escrita como seria exigida pela ABNT NBR ISO/IEC 27001 se o SGP fosse operado oficialmente pela instituição. Versão 1.0, de 21/11/2026.

## 1. Objetivo

Definir as normas, regras e diretrizes que orientam como as informações do **SGP – Sistema de Geração de Provas** devem ser protegidas: contas de professores, dados de alunos, provas, gabaritos, correções e notas.

Esta política busca:

- proteger as informações estratégicas do sistema, como provas antes da aplicação e notas;
- reduzir os riscos de ataques ([análise de riscos](analise-riscos.md));
- evitar o vazamento de dados pessoais de alunos e professores;
- garantir a conformidade com a LGPD;
- definir as responsabilidades de quem usa e de quem mantém o sistema;
- promover a conscientização da equipe e dos usuários.

## 2. Abrangência

Vale para:

- **todos os ativos do [inventário](inventario-ativos.md):** sistema, banco de dados, serviços em nuvem (Render, Aiven, Cloudflare e GitHub), arquivos gerados e computadores usados para operar ou desenvolver o SGP;
- **todas as pessoas com acesso:** os professores que usam o sistema e a equipe que o desenvolve e mantém.

O aluno não tem conta no SGP. Ele só consulta o gabarito publicado pelo código da própria prova, e seus dados são protegidos por esta política.

## 3. Princípios

Toda decisão de segurança no SGP segue a tríade da segurança da informação:

| Princípio | O que significa no SGP |
|---|---|
| **Confidencialidade** | Cada professor só acessa as próprias turmas, provas e notas; prova e gabarito não vazam antes da aplicação. |
| **Integridade** | Notas e gabaritos estão corretos e só mudam por ação do professor dono, com o cálculo feito pelo servidor. |
| **Disponibilidade** | O sistema está acessível quando o professor precisa gerar, corrigir ou consultar provas. |

Além disso: **mínimo privilégio** (cada um acessa só o necessário), **minimização de dados** (o sistema guarda só o que precisa) e **melhoria contínua** (a política é revisada no ciclo PDCA, item 9).

## 4. Diretrizes

### 4.1 Controle de acesso

- O acesso ao sistema é individual, com **login e senha**. Não é permitido compartilhar contas.
- A senha tem no mínimo 8 caracteres e é guardada só como hash (bcrypt). Ninguém da equipe tem acesso à senha de um usuário.
- A sessão dura pouco (token de acesso de 15 minutos, renovado automaticamente) e pode ser encerrada em todos os dispositivos.
- Cada professor só acessa os próprios dados. A identidade vem sempre do login, nunca de um valor enviado pelo navegador.
- As contas da equipe nos provedores (GitHub, Render, Aiven e Cloudflare) devem usar **autenticação multifator (MFA)**.
- O acesso da equipe aos provedores é revisto a cada entrega; quem sai do projeto perde o acesso no mesmo dia.

### 4.2 Classificação e manuseio da informação

Toda informação do SGP tem um nível (Público, Interno, Confidencial ou Restrito) e é manuseada conforme a [classificação da informação](classificacao-informacao.md).

### 4.3 Dados pessoais (LGPD)

- **Finalidade:** os dados de alunos (nome, e-mail, matrícula, respostas e notas) são usados só para gerar, corrigir e acompanhar as provas da turma.
- **Minimização:** o sistema não pede dados além desses; as fotos das folhas são lidas no navegador e não são guardadas no servidor.
- **Acesso:** só o professor da turma vê os dados dos seus alunos.
- **Direitos do titular:** o professor pode remover um aluno da turma sem apagar as notas já lançadas (T47) e anonimizar a própria conta, preservando o histórico (T38). As duas funções já estão no sistema.
- **Registro:** as atividades sobre notas devem ser registradas, para demonstrar a conformidade e investigar incidentes (ação R15 da análise de riscos).

### 4.4 Gabarito e provas

- O gabarito só é publicado por decisão do professor, depois da aplicação, e pode ser despublicado.
- A consulta pública mostra só as letras certas daquela prova, nunca nota, nome ou pontuação.
- PDFs de provas não aplicadas são **Confidenciais**: não devem ser enviados por e-mail ou grupos antes da prova.

### 4.5 Segurança operacional

- **Backup:** o banco de dados fica num serviço gerenciado com backup; a restauração deve ser testada ao menos uma vez por semestre.
- **Atualizações:** as dependências são verificadas (`npm audit`) a cada entrega, e as vulnerabilidades altas são corrigidas antes de publicar.
- **Proteção contra malware:** os computadores da equipe devem ter sistema e antivírus atualizados; o envio de imagens ao sistema confere o tipo real do arquivo e limita o tamanho.

### 4.6 Desenvolvimento seguro

- Toda mudança entra por Pull Request revisado por outro integrante, com os testes passando.
- Segredos (chave do JWT, senha do banco, tokens) ficam só em variáveis de ambiente e nos segredos do GitHub, **nunca no código**. O repositório é público.
- Toda rota nova filtra os dados pelo professor do login e tem teste de isolamento.

### 4.7 Ameaças e conscientização

A equipe e os professores devem conhecer as principais ameaças:

| Ameaça | Exemplo no SGP | Conduta esperada |
|---|---|---|
| **Malware** | Arquivo malicioso enviado como "imagem da questão" ou instalado no computador | Manter antivírus e sistema atualizados; o sistema só aceita imagens válidas |
| **Phishing** | E-mail falso "do GitHub" ou "do Render" pedindo login | Não clicar em links de e-mails inesperados; entrar sempre pelo endereço oficial; usar MFA |
| **Engenharia social** | Alguém se passa por colega e pede a senha do banco ou o token de publicação | Nunca enviar senhas ou segredos por mensagem; confirmar por outro canal |

Ao entrar no projeto, cada integrante lê esta política, e a apresentação do sistema ao cliente inclui um resumo das regras para os professores.

### 4.8 Incidentes

Um incidente é qualquer evento que comprometa a confidencialidade, a integridade ou a disponibilidade, como suspeita de senha vazada, acesso indevido, gabarito divulgado antes da prova ou sistema fora do ar.

1. **Registrar:** quem perceber avisa o gestor de segurança imediatamente, com data, hora e o que observou.
2. **Conter:** encerrar sessões ("sair de todos os dispositivos"), trocar segredos comprometidos, despublicar gabarito, tirar a funcionalidade do ar se preciso.
3. **Recuperar:** restaurar dados do backup, se necessário, e conferir as notas afetadas.
4. **Aprender:** registrar a causa e a correção e atualizar a análise de riscos.

Se envolver dados pessoais de alunos, a instituição avalia a comunicação aos titulares e à ANPD, como prevê a LGPD.

## 5. Direitos

- **Professores:** usar o sistema com segurança; acessar, corrigir e exportar os dados das próprias turmas; encerrar as próprias sessões; anonimizar a própria conta; ser avisados em caso de incidente que os afete.
- **Alunos (titulares):** ter seus dados usados só para a finalidade da prova; consultar o próprio gabarito sem login e sem expor nota; pedir ao professor a correção ou a remoção dos próprios dados da turma.
- **Equipe:** ter o acesso necessário para desenvolver e manter o sistema e receber orientação sobre esta política.

## 6. Responsabilidades

| Papel | Responsabilidade |
|---|---|
| **Gestor de segurança** | Manter esta política, a análise de riscos e o inventário; coordenar a resposta a incidentes |
| **Encarregado de dados (LGPD)** | Garantir o uso dos dados pessoais conforme a finalidade e responder aos titulares |
| **Custodiantes da infraestrutura** | Operar a API, o banco e a publicação com segurança: segredos, backup, acessos |
| **Desenvolvedores** | Seguir o desenvolvimento seguro (item 4.6) e revisar os PRs dos colegas com atenção à segurança |
| **Professores (usuários)** | Proteger a própria senha; não compartilhar a conta; manusear provas, relatórios e fotos conforme a classificação; avisar sobre qualquer suspeita |

Os papéis são distribuídos entre os integrantes no documento de escopo e papéis do SGSI.

## 7. Punições

O descumprimento desta política é tratado conforme a gravidade e a intenção:

| Gravidade | Exemplos | Medida |
|---|---|---|
| **Leve** | Deixar a tela desbloqueada; não ativar o MFA no prazo | Orientação e registro |
| **Média** | Compartilhar a própria conta; enviar PDF de prova antes da aplicação; subir código sem revisão | Advertência formal e revisão dos acessos |
| **Grave** | Colocar um segredo no repositório; acessar dados de outro professor; divulgar notas | Suspensão imediata dos acessos e apuração |
| **Gravíssima** | Vazamento intencional de dados pessoais ou alteração de notas | Desligamento do projeto e encaminhamento às medidas disciplinares e legais da instituição (LGPD) |

## 8. Divulgação e treinamento

Esta política é publicada no repositório do projeto, apresentada à equipe e resumida no manual do usuário para os professores. Cada novo integrante lê a política antes de receber acesso aos provedores.

## 9. Revisão (melhoria contínua)

A política segue o ciclo **PDCA**: planejar (riscos e controles), executar (aplicar a política), verificar (revisar incidentes, testes e acessos) e agir (corrigir e melhorar). É revisada a cada entrega do projeto ou sempre que houver incidente ou mudança importante no sistema.
