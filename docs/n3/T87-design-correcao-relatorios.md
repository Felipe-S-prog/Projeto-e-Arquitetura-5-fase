# N3: T87, padrão visual nas telas de correção e relatórios (Miguel Bertoldi)

## Base

O guia do design system (T86) ainda não existe no repositório. Para não travar, a T87 segue as decisões do estudo de UX do GradePen e do ProvaFácil (T85, Felipe), as variáveis de cor que já estão em `client/src/index.css` e o que a Camila fez na T88 (links de verdade para navegar, `EmptyState`, grades que se ajustam ao celular). Os componentes novos ficaram em `client/src/components/ui.jsx`, para a T86 documentar e as outras telas reaproveitarem.

## Padrões aplicados

| Padrão do estudo (T85) | Como ficou |
| --- | --- |
| Uma só ação principal por tela, sempre no mesmo lugar | Botão azul só para a ação principal: "Enviar foto da folha" na entrada da correção, "Corrigir a próxima pendente" na lista, "Corrigir prova" ao marcar e "Próxima pendente" no resultado. O resto virou botão branco ou link. |
| Caminho no topo e botão Voltar | Todas as telas de correção e relatórios usam `Breadcrumb` e `PageHeader`. Na prova aberta, o título passou a ser "Prova CÓDIGO", com o aluno, a prova e a turma logo abaixo, e "Trocar prova" fica no topo. |
| Lista com estado em cor, busca, filtro e ação em cada linha | Mesma tabela (`DataTable`, `Th`, `Td`) e mesma ação por linha (`RowLink`, link com cara de botão pequeno) na lista da correção e nos relatórios. As cores de estado seguem `Badge`: verde para corrigida, cinza para pendente, âmbar para o que pede atenção (sem folha, leitura duvidosa). Lançamento manual deixou de usar âmbar, porque não é alerta. |
| Revisar só os casos duvidosos | Mantido da T64: a leitura pela foto destaca em âmbar só as questões a conferir. |
| Relatórios com nomes claros | Abas e filtros usam o mesmo componente (`SegmentedControl`) em todas as telas, e os números do topo usam o mesmo cartão (`StatCard`). |

Outros ajustes:

- Na escolha da aplicação, a que tem provas sem identificação aparece como tal. Antes, duas aplicações da mesma prova e turma tinham nomes iguais. A API passou a mandar `nominal` em `GET /api/relatorios/aplicacoes`.
- Removido o botão "Corrigir outra prova" do resultado, que repetia o "Trocar prova" do topo. "Excluir correção" usa o `DangerButton`, como na T88.
- Mensagens de erro com `role="alert"` (`ErrorMessage`), para o leitor de tela anunciar. Os seletores (abas, filtros, modo de correção e câmera ou imagem no leitor de QR) são botões com `aria-pressed`. No leitor de QR eles eram `div` e não funcionavam pelo teclado.
- Botões desabilitados ficam mais claros e com cursor de bloqueio. O foco do teclado aparece em botões e links.

## Celular

A correção pela foto é feita no celular, então as telas precisam caber em 390 px de largura:

- Tabelas rolam para o lado dentro do próprio cartão, e a página não rola mais.
- Grades de cartões e cabeçalhos quebram a linha em vez de empurrar a tela.
- Em telas de até 560 px, o menu lateral vira uma faixa no topo que rola para o lado (`AppLayout.css`). Antes ele ocupava 174 px fixos, e sobrava pouco para o conteúdo. Essa mudança vale para todas as telas.

## Verificação

- `npm test` no servidor (inclui o teste novo do campo `nominal`) e no front, `npm run lint` sem avisos nos arquivos alterados e `npm run build`.
- Teste no navegador com MySQL local: escolher a aplicação, filtrar, abrir pela lista, ler a foto de uma folha real (gerada pelo sistema, inclinada, com marcação dupla e questão em branco), salvar (nota 7 de 10), "Próxima pendente", voltar à lista e exportar Excel, PDF e CSV.
- Telas de correção, lista, resultado, relatórios (três abas) e histórico do aluno conferidas em 1366 px e 390 px. Nenhuma rola para o lado no celular.

## Para a T86

Componentes novos em `ui.jsx` que podem entrar no guia: `SectionCard`, `StatCard`, `StatGrid`, `SegmentedControl`, `ErrorMessage`, `DataTable`, `Th`, `Td` e `RowLink`. Também foram ajustados `PrimaryButton`, `SecondaryButton` e `DangerButton` (estado desabilitado) e `PageHeader` (quebra de linha no celular).
