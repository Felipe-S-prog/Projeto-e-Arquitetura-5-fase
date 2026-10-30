const LETTERS = ['A', 'B', 'C', 'D', 'E'];

// As cópias (código, ordem das questões e das alternativas) são geradas e gravadas pelo
// servidor (T23: server/src/services/copia.geracao.js); o front só as lê da API.

// Resolve o gabarito de uma cópia específica: só a letra correta de cada
// questão, na ordem impressa naquela prova. Nunca inclui nota/pontuação.
export function resolveAnswerKey(copy, examQuestions) {
  return copy.questionIds
    .map((questionId, i) => {
      const question = examQuestions.find((q) => q.id === questionId);
      if (!question) return null;
      const order = copy.alternativesOrder[questionId] || question.alternatives.map((_, idx) => idx);
      const correctPosition = order.findIndex((altIndex) => question.alternatives[altIndex].correct);
      return {
        number: i + 1,
        statement: question.excerpt,
        correctLetter: LETTERS[correctPosition] ?? '—',
      };
    })
    .filter(Boolean);
}
