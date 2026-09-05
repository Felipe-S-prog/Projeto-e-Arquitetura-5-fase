const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, pra evitar confusão na hora de digitar

// Embaralha uma lista sem alterar o array original (Fisher-Yates).
function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

// Gera as cópias de uma aplicação: uma por pessoa, cada uma com sua própria
// ordem de questões e de alternativas (quando o embaralhamento está ativo).
// Quando studentNames é informado (turma vinculada), uma cópia é criada por
// aluno, na ordem da lista; caso contrário, usa "quantity" cópias anônimas.
export function buildApplicationCopies({ examQuestions, quantity, shuffleQuestions, shuffleAlternatives, studentNames, existingCodes = [] }) {
  const usedCodes = new Set(existingCodes);
  const count = studentNames?.length || quantity;

  return Array.from({ length: count }).map((_, i) => {
    const questionOrder = shuffleQuestions ? shuffle(examQuestions) : examQuestions;
    const alternativesOrder = {};
    questionOrder.forEach((q) => {
      const baseOrder = q.alternatives.map((_, idx) => idx);
      alternativesOrder[q.id] = shuffleAlternatives ? shuffle(baseOrder) : baseOrder;
    });

    let code;
    do {
      code = randomCode();
    } while (usedCodes.has(code));
    usedCodes.add(code);

    const studentName = studentNames?.[i] || null;

    return {
      code,
      label: studentName || `Prova #${String(i + 1).padStart(2, '0')}`,
      studentName,
      questionIds: questionOrder.map((q) => q.id),
      alternativesOrder,
      answerKeyPublished: false,
      answerKeyPublishedAt: null,
    };
  });
}

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
