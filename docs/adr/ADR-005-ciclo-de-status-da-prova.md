# ADR-005: Ciclo de status da prova (Rascunho → Pronta → Arquivada)

## Contexto
Uma prova que já foi aplicada não pode mudar: se as questões ou a pontuação fossem alteradas depois, as cópias geradas, os gabaritos e as notas já lançadas deixariam de bater com a prova original. Ao mesmo tempo, o professor precisa poder montar a prova com calma antes de usá-la e tirar de circulação as provas antigas. O sistema precisava de uma regra clara de quando a prova pode ser editada.

## Decisão (T17, T18 e T19, PRs #26, #30 e #32)
- A prova **nasce como Rascunho** e só nesse estado pode ter título, descrição, questões e pontuação alterados (a API responde 409 nos outros casos).
- Ela passa **automaticamente para Pronta** na primeira vez em que é ligada a uma turma, isto é, quando se cria a primeira aplicação. Essa mudança acontece na **mesma transação** que cria a aplicação, então os dois registros nunca ficam inconsistentes.
- **Arquivada é sempre uma ação manual** do professor, permitida para prova em Rascunho ou Pronta. Prova arquivada não aceita novas aplicações (409).
- Na prova, valem 1 a 20 questões, pontuação maior que zero, sem questão repetida, e só questões do próprio professor que não foram excluídas.
- A aplicação nasce **Pendente** e vira **Aplicada** quando o professor confirma o download do PDF; a data fica gravada no servidor, no fuso de Brasília. Enquanto está Pendente, pode-se alterar a quantidade e as opções de embaralhamento; depois de Aplicada, a configuração não muda.

## Consequências
- Facilita: garante que uma prova usada em aplicação nunca é alterada por engano, e o professor não precisa mudar o status à mão para poder aplicar.
- Custa: para corrigir uma prova já Pronta é preciso criar uma nova prova; não existe "voltar para Rascunho".
