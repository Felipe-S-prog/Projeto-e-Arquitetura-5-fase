# ADR-007: Recuperação de senha sem envio de e-mail no MVP

- Status: Aceita
- Data: 26/11/2026

## Contexto

A T39 prevê a recuperação de senha por meio de um token de uso único e com prazo de expiração.

A implementação do envio de e-mails exigiria integração com um serviço externo, configuração de domínio e credenciais de envio. A equipe não possui domínio próprio nem autonomia sobre a infraestrutura institucional de e-mail, que utiliza ferramentas Microsoft administradas pela instituição.

Considerando o escopo acadêmico e as limitações de infraestrutura do MVP, foi necessário decidir se essa integração seria implementada nesta entrega.

## Decisão

Não implementar o envio automático de e-mails para recuperação de senha nesta versão do SGP.

Manter a implementação da recuperação de senha na API e no frontend, incluindo geração segura do token, armazenamento do hash, prazo de validade, uso único e invalidação das sessões anteriores.

Em ambiente de desenvolvimento, o token é retornado pela API para permitir a demonstração e os testes do fluxo.

Em produção, o token não é exposto na resposta. Sem um serviço de envio configurado, a recuperação de senha não estará operacional para os usuários.

## Consequências

- Evita dependência de serviços externos e credenciais institucionais durante o desenvolvimento do MVP.
- Permite demonstrar e testar o fluxo completo localmente.
- O envio de instruções por e-mail permanece como evolução futura.
- Uma eventual implantação institucional deverá definir o serviço de envio, as credenciais e as permissões necessárias junto à instituição.
- A implementação atual não deve ser considerada um mecanismo operacional de recuperação de senha em produção.

## Relação com outras decisões

Esta ADR complementa a ADR-006 e substitui sua observação anterior de que não havia recuperação de senha, pois a mecânica de redefinição passou a existir na T39.
