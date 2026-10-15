# Diagrama de Atividades — SGP (Sistema de Geração de Provas)

> Fluxo modelado: **aplicar uma prova — da criação da aplicação até a consulta pública do gabarito.**

---

## Passo 2A — Escolha do fluxo

O caso de uso do grupo (`caso-de-uso.png`) tem várias ações do Professor: *Criar Aplicação*, *Gerar Provas em PDF* e *Publicar Gabarito*. Elas formam **um único fluxo de ponta a ponta**, e é o único em que o processo passa por mais de um participante (Professor, Sistema e, no final, o Aluno). Por isso foi o escolhido, e por isso o diagrama usa **raias**.

## Passo 2B — Início e fim

| | Descrição |
|---|---|
| **Início** | O Professor decide aplicar uma prova e seleciona prova, turma e quantidade de pessoas. |
| **Fim 1** | Aluno informa um código que não existe → vê o aviso "código não encontrado". |
| **Fim 2** | Código existe, mas o professor ainda não publicou → aviso "gabarito ainda não publicado". |
| **Fim 3** | Código existe e o gabarito está publicado → aluno consulta as respostas corretas. |

## Passo 2C — Atividades em ordem cronológica

1. **Professor** seleciona a prova, a turma e a quantidade de pessoas.
2. **Sistema** cria a aplicação (status "Pendente").
3. **Professor** configura a geração: embaralhar questões e alternativas.
4. **Decisão:** vincular aos alunos matriculados na turma?
   - **[Sim]** → Sistema ajusta a quantidade ao nº de alunos matriculados.
   - **[Não]** → segue com a quantidade informada (cópias identificadas só pelo código).
5. **Sistema** gera as cópias, cada uma com código único e ordem própria.
6. **Sistema** exibe a pré-visualização das provas.
7. **Professor** revisa e pede para baixar todas em PDF.
8. **Decisão:** confirmar o download?
   - **[Não]** → volta a revisar a pré-visualização.
   - **[Sim]** → Sistema disponibiliza o PDF consolidado e marca a aplicação como "Aplicada".
9. **Professor** publica o gabarito (todas as cópias ou uma específica).
10. **Sistema** marca o gabarito como "Publicado".
11. **Professor** divulga o link público do gabarito aos alunos.
12. **Aluno** acessa a página pública (sem login) e digita o código da prova.
13. **Sistema** busca a cópia pelo código.
14. **Decisão:** código encontrado?
    - **[Não]** → Aluno vê o aviso "código não encontrado" (**fim 1**).
    - **[Sim]** → próxima decisão.
15. **Decisão:** gabarito publicado?
    - **[Não]** → Aluno vê o aviso "gabarito ainda não publicado" (**fim 2**).
    - **[Sim]** → Sistema exibe o gabarito → Aluno consulta as respostas corretas (**fim 3**).

## Passo 2D — Raias

| Raia | Responsabilidades |
|---|---|
| **Professor** | Configurar e pedir a geração, revisar, confirmar o download, publicar e divulgar o gabarito |
| **Sistema (SGP)** | Criar aplicação, gerar cópias, exibir pré-visualização, disponibilizar PDF, marcar como publicado, buscar cópia por código |
| **Aluno (sem login)** | Acessar a página pública, informar o código e consultar o resultado |

> O Aluno **não tem conta nem login** (decisão de escopo do projeto): o único contato dele com o sistema é a consulta pública do gabarito por código.

## Passo 2E — Montagem no Draw.io

1. Criar 3 raias verticais (*Swimlane*) com os nomes Professor, Sistema (SGP) e Aluno (sem login).
2. Inserir o **nó inicial** (círculo preto) na raia do Professor.
3. Inserir cada **atividade** como retângulo arredondado, sempre na raia de quem a executa, de cima para baixo na ordem do passo 2C.
4. Inserir as 4 **decisões** como losangos, com a pergunta dentro.
5. Ligar tudo com setas; nas saídas dos losangos escrever **[Sim]** / **[Não]**. A seta que volta da decisão "Confirmar download?" para a revisão representa o laço do **[Não]**.
6. Inserir os 3 **nós finais** (círculo duplo), um por desfecho.
7. Exportar como PNG (`diagrama-atividades.png`) e salvar o fonte editável (`diagrama-atividades.drawio`).

## 🖼️ Diagrama de Atividades

![Diagrama de Atividades do SGP com raias](diagrama-atividades.png)
