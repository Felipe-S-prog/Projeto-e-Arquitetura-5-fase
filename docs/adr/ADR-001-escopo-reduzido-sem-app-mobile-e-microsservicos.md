# ADR-001: Escopo reduzido em relação à especificação de referência do cliente

## Contexto
A especificação de referência do cliente prevê um app mobile nativo (React Native) para a leitura do QR Code e uma arquitetura de microsserviços (Auth, Exam/Class/Application, Grade, Sync, Vision), com fila de sincronização offline. A disciplina de Projeto e Arquitetura de Software, porém, exige a stack **Node.js + Express + MySQL** e uma **arquitetura em camadas única**, e o semestre tem prazo fechado. Era preciso decidir o que entra no MVP e o que fica de fora.

## Decisão
O MVP do SGP é uma plataforma **web** (front-end React + API Node/Express + MySQL), sem app mobile nativo e sem microsserviços. A fila de sincronização offline e a deduplicação de correções, que dependem do app mobile, também ficam fora. O aluno não tem conta nem login: o único contato dele com o sistema é o gabarito publicado em link público. Contas de professor são criadas por um administrador (ver ADR-004). A exclusão física de dados (LGPD) não é feita; está prevista apenas a anonimização de conta.

## Consequências
- Facilita: um único código para aplicar a metodologia da disciplina, com menos infraestrutura para manter e testar.
- Custa: a correção feita pelo celular (leitura do gabarito preenchido) fica fora do MVP; a correção segue pela via web.
- Quem retomar o projeto depois do semestre pode tratar o app mobile e a separação em serviços como evolução futura.

Detalhes do escopo: seção 1 do README ("Fora do escopo do semestre").
