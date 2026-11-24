# Classificação da informação — SGP

> **Simulação acadêmica.** Classificação feita como seria exigida pela ABNT NBR ISO/IEC 27001 (controle 5.12 da ISO 27002) se o SGP fosse operado oficialmente. Versão 1.0, de 21/11/2026. Complementa a [Política de Segurança](politica-seguranca.md).

Classificar a informação é o passo que permite aplicar o controle certo a cada dado: quem pode ver, como guardar, como enviar e como descartar. Sem isso, a mesma proteção valeria para um gabarito já publicado e para as notas de uma turma.

## Processo

Seguindo o processo de quatro etapas para gerenciar informações classificadas:

1. **Inserir o ativo no inventário:** todo dado do SGP está no [inventário de ativos](inventario-ativos.md), com proprietário e localização.
2. **Classificar a informação:** o proprietário define o nível, pelo impacto que a divulgação, a alteração ou a perda causariam.
3. **Rotular a informação:** o nível fica visível onde a informação aparece (tela, arquivo exportado, documento).
4. **Manusear a informação:** cada nível tem regras de acesso, armazenamento, envio e descarte.

## Níveis

| Nível | Quem pode acessar | Impacto se vazar | Exemplo no SGP |
|---|---|---|---|
| **Público** | Qualquer pessoa | Nenhum | Código-fonte (repositório público), gabarito já publicado, manual do usuário |
| **Interno** | Equipe do projeto | Baixo: expõe detalhes técnicos | Configuração da API, estrutura do banco, logs de requisição |
| **Confidencial** | O professor dono e quem ele autorizar | Médio: prejudica uma prova ou expõe dado pessoal comum | Dados de alunos, provas e PDFs antes da aplicação, imagens das questões |
| **Restrito** | Só o titular ou o próprio sistema | Alto: dano grave a pessoas ou ao sistema | Notas e respostas, hash de senhas, sessões, segredos de configuração |

Na dúvida, vale o nível mais alto, até o proprietário decidir.

## Classificação dos dados do SGP

| Informação | Ativo | Nível | Por quê |
|---|---|---|---|
| Notas, respostas marcadas por questão | INF-006 | **Restrito** | Dado pessoal de desempenho do aluno; alteração afeta a avaliação |
| Hash de senha, e-mail de login dos professores | INF-001 | **Restrito** | Base da identidade; o vazamento facilita ataques às contas |
| Refresh tokens e sessões | INF-002 | **Restrito** | Quem tem o token age como o professor |
| Chave do JWT, senha do banco, token do Cloudflare | INF-012 | **Restrito** | Dão acesso total ao sistema ou à publicação |
| Relatórios exportados (CSV, Excel, PDF) | INF-009 | **Restrito** | Reúnem as notas de uma turma inteira num arquivo |
| Fotos das folhas de resposta | INF-011 | **Restrito** | Mostram nome do aluno e respostas |
| Nome, e-mail e matrícula dos alunos | INF-003 | **Confidencial** | Dado pessoal (LGPD), sem informação de desempenho |
| Questões, alternativas corretas e provas | INF-004 | **Confidencial** | Divulgadas antes da aplicação, invalidam a prova |
| Códigos das cópias e ordem embaralhada | INF-005 | **Confidencial** | Com a ordem, dá para montar o gabarito de cada versão |
| PDFs das provas antes da aplicação | INF-008 | **Confidencial** | Contêm a prova inteira e, se vinculada, o nome do aluno |
| Imagens das questões | INF-010 | **Confidencial** | Fazem parte do conteúdo da prova |
| Gabarito **antes** de publicado | INF-005, INF-007 | **Confidencial** | Mesmo motivo da prova |
| Gabarito **depois** de publicado | INF-007 | **Público** | Publicado por decisão do professor; só as letras, sem nota ou nome |
| Configuração e estrutura do banco, logs | SW-002, SW-004 | **Interno** | Ajudam um atacante a entender o sistema, sem dados pessoais |
| Código-fonte e documentação | SW-001, INF-013 | **Público** | Repositório público; por isso nenhum segredo pode estar nele |

A classificação muda com o tempo: o gabarito passa de **Confidencial** para **Público** quando o professor publica, e volta a Confidencial se ele despublicar. A prova deixa de exigir sigilo depois da aplicação, mas os PDFs com nome de aluno continuam Confidenciais.

## Rotulagem

| Onde | Como o nível aparece | Situação |
|---|---|---|
| Tela do gabarito | Selo **Publicado** ou **Não publicado** em cada prova | Existe no sistema |
| Consulta pública do gabarito | Página separada, sem login, que mostra só as letras | Existe no sistema |
| Relatórios exportados | Rodapé "Gerado pelo SGP" com data e página | Em revisão (T66) |
| Relatórios e PDFs | Incluir "Restrito — contém notas de alunos" (relatórios) e "Confidencial até a aplicação" (provas) no cabeçalho ou rodapé | **Proposta** do plano de ação |
| Documentos do projeto | Linha de classificação no topo de cada documento de segurança | Proposta |
| Variáveis de ambiente | Nome da variável deixa claro que é segredo (`JWT_ACCESS_SECRET`, `DB_PASSWORD`) e o `.env.example` vai sem valores | Existe no projeto |

## Manuseio

| Ação | Público | Interno | Confidencial | Restrito |
|---|---|---|---|---|
| **Acesso** | Livre | Equipe do projeto | Professor dono, pelo login no sistema | Professor dono ou o próprio sistema; equipe só com motivo registrado |
| **Armazenamento** | Repositório e sistema | Repositório e provedores da equipe | No banco (com SSL) ou no computador do professor | No banco (senhas e tokens só como hash), em variáveis de ambiente ou em pasta pessoal protegida no computador do professor |
| **Envio** | Livre | Canais da equipe | Só pelo próprio sistema ou impresso no dia da prova; nunca por grupos de mensagem antes da aplicação | Nunca por e-mail ou mensagem; relatórios só para a coordenação, por canal institucional |
| **Impressão** | Livre | Evitar | Prova: só para a aplicação, guardada até o dia | Evitar; se imprimir, não deixar exposto |
| **Descarte** | Livre | Apagar quando sair de uso | Apagar arquivos após a aplicação; triturar provas sobressalentes | Apagar relatórios e fotos depois do uso; anonimizar a conta em vez de apagar notas; trocar segredos expostos |

## Controles que já aplicam esta classificação

- **Restrito:** senhas com hash bcrypt, refresh tokens com hash SHA-256, segredos fora do repositório, notas visíveis só para o professor dono, nota calculada no servidor.
- **Confidencial:** cada consulta filtra pelo professor do login, conexão com o banco por SSL, PDFs gerados sob demanda e não guardados no servidor, fotos das folhas lidas no navegador sem envio.
- **Público:** a consulta do gabarito devolve só as letras, sem nota ou nome, e não fica em cache.

O que ainda falta (rótulos nos arquivos exportados, registro de acesso às notas) está no plano de tratamento da [análise de riscos](analise-riscos.md).
