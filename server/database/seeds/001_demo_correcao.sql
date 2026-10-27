-- Dados de demonstração da Correção e Notas (T29 a T33).
-- Uso (na pasta server, depois do db:migrate):  npm run db:seed
--
-- Enquanto a geração de cópias no banco (T23) não está pronta, este seed cria uma
-- turma, uma prova e cópias já geradas para testar a correção, os relatórios e o
-- histórico. Os ids começam em 9001 para não colidir com dados reais; o professor
-- é o id 1. O usuário fica Convidado para definir a senha no primeiro acesso. Pode rodar várias vezes.
--
-- Cópias para testar (digite o código na tela Correção):
--   Aplicação 9001 (nominal):   DEMA22 Ana, DEMA33 Bruno, DEMA44 Carla, DEMA55 Diego
--   Aplicação 9002 (anônima):   DEMB22, DEMB33  -> associe a um aluno na correção

INSERT INTO usuario (nome, email, papel, status) VALUES
  ('Professor Demonstração', 'professor.demo@catolicasc.edu.br', 'PROFESSOR', 'CONVIDADO')
ON DUPLICATE KEY UPDATE
  status = IF(senha_hash IS NULL, 'CONVIDADO', status);

SET @professor_demo_id = (
  SELECT id FROM usuario WHERE email = 'professor.demo@catolicasc.edu.br' LIMIT 1
);

INSERT IGNORE INTO turma (id, professor_id, nome, disciplina, periodo, status) VALUES
  (9001, @professor_demo_id, 'Cálculo I - Turma Demo', 'Matemática', '2026/2', 'ATIVA');

INSERT IGNORE INTO aluno (id, nome, email, numero_matricula) VALUES
  (9001, 'Ana Beatriz Souza', 'ana.souza.demo@catolicasc.edu.br', '2026001'),
  (9002, 'Bruno Cardoso Lima', 'bruno.lima.demo@catolicasc.edu.br', '2026002'),
  (9003, 'Carla Fernandes Rocha', 'carla.rocha.demo@catolicasc.edu.br', '2026003'),
  (9004, 'Diego Martins Alves', 'diego.alves.demo@catolicasc.edu.br', '2026004'),
  (9005, 'Eduarda Nunes Prado', 'eduarda.prado.demo@catolicasc.edu.br', '2026005');

INSERT IGNORE INTO matricula (turma_id, aluno_id) VALUES
  (9001, 9001), (9001, 9002), (9001, 9003), (9001, 9004), (9001, 9005);

INSERT IGNORE INTO questao (id, professor_id, tipo, enunciado) VALUES
  (9001, @professor_demo_id, 'OBJETIVA', 'Qual é a derivada de f(x) = x²?'),
  (9002, @professor_demo_id, 'OBJETIVA', 'Quanto vale o limite de (x² - 1)/(x - 1) quando x tende a 1?'),
  (9003, @professor_demo_id, 'OBJETIVA', 'Qual é a integral indefinida de 2x?'),
  (9004, @professor_demo_id, 'OBJETIVA', 'A derivada de uma função constante é:'),
  (9005, @professor_demo_id, 'DISCURSIVA', 'Explique, com suas palavras, o significado geométrico da derivada.');

-- "ordem" é a posição original da alternativa (0 = primeira cadastrada).
INSERT IGNORE INTO alternativa (questao_id, texto, correta, ordem) VALUES
  (9001, '2x', 1, 0), (9001, 'x', 0, 1), (9001, 'x²/2', 0, 2), (9001, '2', 0, 3),
  (9002, '0', 0, 0), (9002, '1', 0, 1), (9002, '2', 1, 2), (9002, 'Não existe', 0, 3),
  (9003, 'x² + C', 1, 0), (9003, '2x² + C', 0, 1), (9003, 'x + C', 0, 2), (9003, '2 + C', 0, 3),
  (9004, 'Zero', 1, 0), (9004, 'Um', 0, 1), (9004, 'A própria constante', 0, 2), (9004, 'Não existe', 0, 3);

INSERT IGNORE INTO prova (id, professor_id, titulo, descricao, status) VALUES
  (9001, @professor_demo_id, 'Prova Demo - Derivadas e Integrais', 'Prova de demonstração da correção e notas.', 'PRONTA');

-- Nota máxima: 2 + 2 + 2 + 2 + 2 = 10 pontos.
INSERT IGNORE INTO prova_questao (prova_id, questao_id, posicao, pontuacao) VALUES
  (9001, 9001, 1, 2.00), (9001, 9002, 2, 2.00), (9001, 9003, 3, 2.00), (9001, 9004, 4, 2.00), (9001, 9005, 5, 2.00);

INSERT IGNORE INTO aplicacao (id, turma_id, prova_id, status, quantidade, data_aplicacao, embaralhar_questoes, embaralhar_alternativas, vincular_alunos) VALUES
  (9001, 9001, 9001, 'APLICADA', 4, '2026-10-20', 1, 1, 1),
  (9002, 9001, 9001, 'APLICADA', 2, '2026-10-27', 1, 1, 0);

-- ordem_embaralhamento no formato do front (utils/answerKey.js): ordem impressa das
-- questões e, para cada questão, a ordem original das alternativas impressas como A, B, C, D.
INSERT IGNORE INTO copia_prova (id, aplicacao_id, aluno_id, codigo, rotulo, ordem_embaralhamento) VALUES
  (9001, 9001, 9001, 'DEMA22', 'Ana Beatriz Souza',
    '{"questionIds":[9001,9002,9003,9004,9005],"alternativesOrder":{"9001":[0,1,2,3],"9002":[0,1,2,3],"9003":[0,1,2,3],"9004":[0,1,2,3],"9005":[]}}'),
  (9002, 9001, 9002, 'DEMA33', 'Bruno Cardoso Lima',
    '{"questionIds":[9003,9001,9005,9004,9002],"alternativesOrder":{"9001":[2,0,3,1],"9002":[3,2,1,0],"9003":[1,3,0,2],"9004":[0,2,1,3],"9005":[]}}'),
  (9003, 9001, 9003, 'DEMA44', 'Carla Fernandes Rocha',
    '{"questionIds":[9002,9004,9001,9003,9005],"alternativesOrder":{"9001":[1,2,3,0],"9002":[2,0,1,3],"9003":[3,0,2,1],"9004":[3,1,0,2],"9005":[]}}'),
  (9004, 9001, 9004, 'DEMA55', 'Diego Martins Alves',
    '{"questionIds":[9004,9003,9002,9005,9001],"alternativesOrder":{"9001":[3,1,0,2],"9002":[1,3,2,0],"9003":[2,1,3,0],"9004":[2,3,0,1],"9005":[]}}'),
  (9005, 9002, NULL, 'DEMB22', 'Prova #01',
    '{"questionIds":[9005,9002,9004,9001,9003],"alternativesOrder":{"9001":[1,0,2,3],"9002":[0,2,3,1],"9003":[2,0,1,3],"9004":[1,0,3,2],"9005":[]}}'),
  (9006, 9002, NULL, 'DEMB33', 'Prova #02',
    '{"questionIds":[9001,9005,9003,9002,9004],"alternativesOrder":{"9001":[3,0,1,2],"9002":[1,2,0,3],"9003":[0,3,2,1],"9004":[2,1,3,0],"9005":[]}}');
