# T42 — Estabilização da hospedagem — Bruno — 23/11/2026

## Infraestrutura publicada

| Componente | Serviço | Situação |
| --- | --- | --- |
| Frontend | Cloudflare Pages | Publicado |
| API | Render | Publicada e respondendo |
| Banco de dados | Aiven MySQL 8.4.11 | Conectado à API |

Deploy da API validado no commit `1df1ef5`. A conexão com o banco utiliza SSL com verificação do certificado da Aiven.

## Verificação de disponibilidade e latência

Medições realizadas em 23/11/2026, com cinco requisições para cada endpoint.

### API — `/api/health`

Todas as cinco requisições retornaram HTTP 200.

| Tentativa | Tempo de resposta |
| --- | ---: |
| 1 | 232,552 ms |
| 2 | 239,409 ms |
| 3 | 251,969 ms |
| 4 | 213,207 ms |
| 5 | 285,521 ms |
| **Média** | **244,532 ms** |

### API + MySQL — `/api/health/db`

Todas as cinco requisições retornaram HTTP 200 e JSON com `status: ok` e `database: sgp`.

| Tentativa | Tempo HTTP total | Latência interna do banco |
| --- | ---: | ---: |
| 1 | 370,872 ms | 101 ms |
| 2 | 300,538 ms | 90 ms |
| 3 | 326,755 ms | 90 ms |
| 4 | 314,912 ms | 91 ms |
| 5 | 312,981 ms | 90 ms |
| **Média** | **325,212 ms** | **92,4 ms** |

A API respondeu normalmente e conseguiu consultar o banco em todas as tentativas. As medições representam apenas o período do teste, não uma garantia de disponibilidade contínua.

## Backups

- O painel da Aiven apresentava backups completos em 21, 22 e 23/11/2026.
- O backup mais recente exibido no painel era de 23/11/2026 às 09:58 UTC.
- Foi gerado também um backup lógico independente com `mysqldump`, utilizando conexão SSL com verificação do certificado.
- Arquivo local: `sgp-pos-migrations-2026-11-23-174055.sql`.
- Tamanho aproximado: 60 KB.
- Local de armazenamento: `$HOME/backups-sgp/`.
- Permissões do arquivo: `600`.

O backup local não deve ser enviado ao repositório, pois contém dados do banco.

## Teste de restauração

O backup lógico foi importado em um container Docker isolado, utilizando MySQL 8.4.13, sem alterar o banco de produção.

Resultado da verificação:

- 17 tabelas restauradas.
- 6 registros de migrations presentes em `schema_migrations`.
- Migrations `001` a `004` e as migrations `005_normalizar_tags.sql` e `005_professor_unico.sql` presentes.
- Importação concluída sem erros.
- Consulta de verificação confirmou a estrutura restaurada.

O teste comprova que o backup lógico pode ser restaurado em uma instância MySQL independente.

## Limitações e observações

- As medições de disponibilidade e latência são pontuais, não um monitoramento contínuo.
- O teste de restauração validou o banco de dados, não a execução completa da aplicação a partir do ambiente restaurado.
- Não foi realizado teste de failover ou de indisponibilidade dos provedores.
- O plano gratuito da Aiven atende à necessidade de hospedagem até a apresentação de 27/11. Caso o projeto seja adotado pela instituição, a infraestrutura deverá ser disponibilizada nos servidores institucionais.
- O backup lógico independente foi armazenado localmente; não está versionado no Git.

## Evidências

As evidências desta validação incluem:

- Respostas dos endpoints de saúde da API e do banco.
- Medições de tempo realizadas pelo terminal.
- Painel da Aiven com o estado do serviço e os backups disponíveis.
- Saída do `mysqldump` concluído com sucesso.
- Saída da restauração no Docker e consulta confirmando as 17 tabelas e as 6 migrations.

## Plano B para a apresentação

Foi preparado e testado um ambiente local de contingência em 23/11/2026:

- MySQL 8.4.13 em Docker, na porta 3307.
- Backup restaurado com 17 tabelas e 6 migrations.
- API local conectada ao banco restaurado, na porta 3333.
- Frontend local apontando para a API, na porta 5173.
- `/api/health` e `/api/health/db` responderam HTTP 200.
- Frontend abriu normalmente e funcionou com a infraestrutura local.

Em caso de indisponibilidade da hospedagem, iniciar o container `sgp-presentation-db`, a API local e o frontend local. O ambiente alternativo não depende do Render, Cloudflare Pages ou Aiven.

## Verificação até a apresentação

Realizar verificações manuais da API hospedada antes dos ensaios e da apresentação, registrando data, horário, status HTTP e tempo de resposta.

Comando:

`curl -sS -o /dev/null -w 'HTTP %{http_code} | %{time_total}s\n' https://sgp-api-97te.onrender.com/api/health`

Em caso de indisponibilidade, utilizar o plano B local.