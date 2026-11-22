# ADR-006: Sistema só do professor, com cadastro livre e sem administrador

## Contexto
O ADR-004 definiu contas criadas por convite de um administrador, com e-mails restritos ao domínio da Católica SC e um primeiro administrador criado por um bootstrap. Na revisão com a professora, no início da N3, a direção mudou: o sistema é **só do professor**, que cria a própria conta; não há administrador; e o foco da N3 passa a ser a correção das provas. O convite e a tela de administração só adicionavam passos antes do primeiro uso e uma conta privilegiada a proteger, sem trazer valor ao professor. O aluno continua sem conta (ADR-001).

## Decisão (T77, T78 e T38, PRs #100 e #99)
- **Cadastro livre:** o professor informa nome, e-mail e senha em `POST /auth/register` e já entra no sistema com uma sessão válida. E-mail já cadastrado é recusado com erro 409.
- **Removidos:** o convite e o status `CONVIDADO`, o bootstrap do primeiro administrador, o perfil de administrador, a tela `/admin` e a validação de domínio de e-mail por papel (`ADMIN_EMAIL_DOMAINS` e `PROFESSOR_EMAIL_DOMAINS`).
- **Migration `005_professor_unico`:** converte todas as contas para `PROFESSOR`, preservando os IDs para manter os vínculos com turmas, provas e notas. Contas antigas `CONVIDADO` passam a `ATIVO`, mas só entram depois de definirem uma senha pelo cadastro. A coluna `papel` aceita somente `PROFESSOR` e `status` aceita `ATIVO` e `ANONIMIZADO`.
- **Anonimização pelo próprio professor:** `POST /me/anonymize` anonimiza a conta (LGPD) e encerra todas as sessões, mantendo os registros ligados a ela.
- **Mantido do ADR-004:** senha com hash bcrypt, access token JWT de 15 minutos, refresh token rotativo de uso único com hash SHA-256 no banco, e o middleware `apiAuth`, que obtém a identidade do professor do token. Cada professor continua vendo só os próprios dados.

## Consequências
- Facilita: o professor começa a usar o sistema sem esperar um convite; há menos telas e menos código; não existe mais conta com poder sobre as demais.
- Custa: o cadastro é **público**, sem verificação de e-mail e sem restrição ao domínio da Católica SC, então qualquer pessoa pode criar uma conta. A limitação de tentativas nas rotas de login, cadastro e renovação está prevista na T40 e, enquanto não existir, essas rotas ficam sem limite.
- Custa: não há recuperação de senha (T39, opcional); quem esquecer a senha precisa criar outra conta.
- A migration não tem volta: os administradores antigos perdem o perfil e passam a professores.
- O ADR-004 deixa de valer nos itens de convite, administrador, bootstrap e domínio de e-mail; os demais itens continuam valendo.
