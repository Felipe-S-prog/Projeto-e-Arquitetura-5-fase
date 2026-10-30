# ADR-004: Autenticação com JWT, refresh token rotativo e cadastro por convite

## Contexto
Só professores e administradores usam o sistema; o aluno não tem conta (ADR-001). As contas precisam ser restritas à Católica SC, as senhas não podem ser guardadas em texto aberto (RNF02) e cada professor só pode enxergar os próprios dados (turmas, questões, provas, aplicações). Antes, o front mandava um `professor_id` fixo e o login era apenas um valor em memória.

## Decisão (implementada na T07, PR #28)
- **Cadastro por convite:** o administrador cria o usuário com status `CONVIDADO`; a pessoa ativa a conta definindo a senha no primeiro acesso. Os domínios de e-mail aceitos são validados por papel (`ADMIN_EMAIL_DOMAINS`, `PROFESSOR_EMAIL_DOMAINS`). O primeiro administrador é criado por um bootstrap permitido só enquanto não há administrador válido.
- **Senhas** guardadas apenas como hash bcrypt.
- **Access token JWT** de vida curta (padrão: 900 segundos), enviado no cabeçalho `Authorization: Bearer`.
- **Refresh token** aleatório, de uso único e **rotativo**: cada renovação emite um token novo e invalida o anterior. No banco fica só o hash SHA-256 do token, e a validade padrão é de 30 dias. O logout revoga o refresh token.
- Um middleware (`apiAuth`) protege os prefixos `/admin`, `/settings`, `/turmas`, `/questoes`, `/provas`, `/aplicacoes`, `/correcoes`, `/relatorios` e `/alunos`. A identidade do professor vem do **token**, não do que o front envia: o middleware injeta `professor_id` na requisição, o que manteve compatível o código que já lia esse campo.
- No front, um `AuthContext` guarda a sessão e o serviço `api.js` anexa o token e renova a sessão quando necessário. Os dados carregados são trocados quando o usuário muda.

## Consequências
- Facilita: um professor nunca vê dados de outro (testado nas telas de provas e aplicações); não há senha em texto aberto; um refresh token roubado e já usado deixa de valer.
- Custa: o front precisa gerenciar renovação e expiração de sessão; a injeção de `professor_id` é uma compatibilidade **temporária** com rotas antigas, a remover quando todas lerem a identidade direto do token.
