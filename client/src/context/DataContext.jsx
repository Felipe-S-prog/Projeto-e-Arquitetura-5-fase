
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from './AuthContext';
import { apiRequest } from '../services/api';

const DataContext = createContext(null);


function normalizeClass(cls) {
  return {
    id: Number(cls.id),
    name: cls.name ?? cls.nome,
    subject: cls.subject ?? cls.disciplina,
    period: cls.period ?? cls.periodo,
    status:
      cls.status === 'ARQUIVADA' || cls.status === 'Arquivada'
        ? 'Arquivada'
        : 'Ativa',
    students: (cls.students ?? []).map((student) => ({
      id: Number(student.id),
      name: student.name ?? student.nome,
      email: student.email,
      registration:
        student.registration ?? student.numero_matricula ?? student.numeroMatricula ?? null,
    })),
    codigoConvite: cls.codigoConvite ?? cls.codigo_convite ?? null,
  };
}


// Monta o corpo enviado para a API de questões.
function buildQuestionPayload(question) {
  return {
    tipo: 'OBJETIVA',
    enunciado: question.excerpt,
    imagem_url: question.imageUrl || null,
    tags: question.tags || [],
    alternativas: (question.alternatives || []).map((alternative) => ({
      texto: alternative.text,
      correta: Boolean(alternative.correct),
    })),
  };
}

// Normaliza uma prova vinda da API: { id, title, description, status, questions: [{ questionId, score }] }.
function normalizeExam(exam) {
  return {
    id: Number(exam.id),
    title: exam.title,
    description: exam.description ?? '',
    status: exam.status,
    questions: (exam.questions ?? []).map((item) => ({
      questionId: Number(item.questionId),
      score: Number(item.score),
    })),
  };
}

// A API devolve a data como AAAA-MM-DD; as telas usam DD/MM/AAAA.
function formatApiDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : null;
}

// Normaliza uma aplicação vinda da API. As cópias (copies) ainda ficam só na memória (T23).
function normalizeApplication(application, copies = []) {
  return {
    id: Number(application.id),
    examId: Number(application.examId),
    classId: Number(application.classId),
    status: application.status,
    quantity: Number(application.quantity),
    date: formatApiDate(application.date),
    shuffleQuestions: Boolean(application.shuffleQuestions),
    shuffleAlternatives: Boolean(application.shuffleAlternatives),
    linkToRoster: Boolean(application.linkToRoster),
    gradedCount: Number(application.gradedCount ?? 0),
    copies,
  };
}

function unwrapQuestion(payload) {
  return payload?.question || payload?.data || payload;
}

const DataProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [questions, setQuestions] = useState([]);

  // Carrega as questões da API.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;

    async function loadQuestions() {
      try {
        const payload = await apiRequest(
          '/questoes',
        );

        const apiQuestions = Array.isArray(payload)
          ? payload
          : payload?.data || [];

        if (cancelled) return;

        setQuestions((current) => {
          const apiIds = new Set(
            apiQuestions.map((question) => String(question.id)),
          );

          const localQuestions = current.filter(
            (question) => !apiIds.has(String(question.id)),
          );

          return [...apiQuestions, ...localQuestions];
        });
      } catch (error) {
        console.error('Erro ao carregar questões:', error);
      }
    }

    loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // Turmas vêm da API.
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');

  // Provas vêm da API.
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState('');

  // Aplicações vêm da API.
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState('');

  useEffect(() => {
    setQuestions([]);
    setClasses([]);
    setExams([]);
    setApplications([]);
    setClassesError('');
    setExamsError('');
    setApplicationsError('');
  }, [user?.id]);

  // Carrega turmas, provas e aplicações.
  useEffect(() => {
    if (!isAuthenticated) {
      setClassesLoading(false);
      setExamsLoading(false);
      setApplicationsLoading(false);
      return undefined;
    }
    let cancelled = false;

    async function loadClasses() {
      setClassesLoading(true);
      setClassesError('');

      try {
        const result = await apiRequest(
          '/turmas',
        );

        if (!Array.isArray(result)) {
          throw new Error('A API retornou uma lista de turmas inválida.');
        }

        if (!cancelled) {
          setClasses(result.map(normalizeClass));
        }
      } catch (error) {
        if (!cancelled) {
          setClassesError(error.message);
        }
      } finally {
        if (!cancelled) {
          setClassesLoading(false);
        }
      }
    }

    async function loadApplications() {
      setApplicationsLoading(true);
      setApplicationsError('');

      try {
        const [result, copies] = await Promise.all([
          apiRequest('/aplicacoes'),
          apiRequest('/copias'),
        ]);

        if (!Array.isArray(result) || !Array.isArray(copies)) {
          throw new Error('A API retornou uma lista de aplicações ou cópias inválida.');
        }

        if (!cancelled) {
          setApplications(
            result.map((item) =>
              normalizeApplication(
                item,
                copies.filter((copy) => copy.applicationId === Number(item.id)),
              ),
            ),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setApplicationsError(error.message);
        }
      } finally {
        if (!cancelled) {
          setApplicationsLoading(false);
        }
      }
    }

    async function loadExams() {
      setExamsLoading(true);
      setExamsError('');

      try {
        const result = await apiRequest(
          '/provas',
        );

        if (!Array.isArray(result)) {
          throw new Error('A API retornou uma lista de provas inválida.');
        }

        if (!cancelled) {
          setExams(result.map(normalizeExam));
        }
      } catch (error) {
        if (!cancelled) {
          setExamsError(error.message);
        }
      } finally {
        if (!cancelled) {
          setExamsLoading(false);
        }
      }
    }

    loadClasses();
    loadExams();
    loadApplications();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // Cria uma questão na API.
  const addQuestion = useCallback(async (question) => {
    const saved = unwrapQuestion(
      await apiRequest('/questoes', {
        method: 'POST',
        body: JSON.stringify(buildQuestionPayload(question)),
      }),
    );

    setQuestions((previous) => [
      saved,
      ...previous.filter((item) => String(item.id) !== String(saved.id)),
    ]);

    return saved;
  }, []);

  // Atualiza uma questão existente na API.
  const updateQuestion = useCallback(async (id, question) => {
    const saved = unwrapQuestion(
      await apiRequest(`/questoes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(buildQuestionPayload(question)),
      }),
    );

    setQuestions((previous) =>
      previous.map((item) => (String(item.id) === String(id) ? saved : item)),
    );

    return saved;
  }, []);

  // Exclui uma questão pela API.
  const deleteQuestion = useCallback(async (id) => {
    await apiRequest(
      `/questoes/${id}`,
      { method: 'DELETE' },
    );

    setQuestions((previous) =>
      previous.filter((question) => String(question.id) !== String(id)),
    );
  }, []);

  // Cadastra uma turma no MySQL.
  const addClass = useCallback(async (cls) => {
    setClassesError('');

    const name = cls.name?.trim();
    const subject = cls.subject?.trim();
    const period = cls.period?.trim();

    if (!name || !subject || !period) {
      throw new Error('Preencha o nome, a disciplina e o período.');
    }


    try {
      const createdClass = await apiRequest('/turmas', {
        method: 'POST',
        body: JSON.stringify({
          nome: name,
          disciplina: subject,
          periodo: period,
        }),
      });

      const normalized = normalizeClass(createdClass);

      setClasses((previous) => [normalized, ...previous]);

      return normalized;
    } catch (error) {
      setClassesError(error.message);
      throw error;
    }
  }, []);

  // Atualiza uma turma existente no MySQL.

  // Atualiza uma turma existente no MySQL e sincroniza a lista imediatamente.
  const updateClass = useCallback(async (id, changes) => {
    setClassesError('');

    const classId = Number(id);
    const name = changes.name?.trim();
    const subject = changes.subject?.trim();
    const period = changes.period?.trim();

    if (!name || !subject || !period) {
      throw new Error('Preencha o nome, a disciplina e o período.');
    }


    try {
      // Envia os campos no formato JSON esperado pela API.
      const response = await apiRequest(`/turmas/${classId}`, {
        method: 'PUT',
        body: JSON.stringify({
          nome: name,
          disciplina: subject,
          periodo: period,
        }),
      });

      // Usa os valores digitados, preservando alunos e código de convite.
      const returnedClass = response?.data ?? response ?? {};

      setClasses((current) =>
        current.map((item) =>
          item.id === classId
            ? {
                ...item,
                id: classId,
                name,
                subject,
                period,
                status: returnedClass.status
                  ? normalizeClass({
                      ...item,
                      ...returnedClass,
                    }).status
                  : item.status,
                students: item.students ?? [],
                codigoConvite:
                  returnedClass.codigoConvite ??
                  returnedClass.codigo_convite ??
                  item.codigoConvite ??
                  null,
              }
            : item,
        ),
      );

      return {
        ...classes.find((item) => item.id === classId),
        id: classId,
        name,
        subject,
        period,
      };
    } catch (error) {
      setClassesError(error.message);
      throw error;
    }
  }, [classes]);

  const removeStudent = useCallback(async (classId, studentId) => {
    const result = await apiRequest(`/turmas/${classId}/matriculas/${studentId}`, { method: 'DELETE' });
    setClasses((previous) => previous.map((item) => item.id === Number(classId)
      ? { ...item, students: item.students.filter((student) => student.id !== Number(studentId)) } : item));
    return result;
  }, []);
  const importStudents = useCallback(async (classId, csv) => {
    const result = await apiRequest(`/turmas/${classId}/matriculas/importar`, { method: 'POST', body: JSON.stringify({ csv }) });
    setClasses((previous) => previous.map((item) => item.id === Number(classId)
      ? { ...item, students: [...item.students.filter((student) => !result.imported.some((added) => added.id === student.id)), ...result.imported] } : item));
    return result;
  }, []);

  const deleteClass = useCallback(async (id) => {
    const result = await apiRequest(`/turmas/${id}`, { method: 'DELETE' });
    setClasses((previous) => result.archived
      ? previous.map((item) => item.id === Number(id) ? { ...item, status: 'Arquivada' } : item)
      : previous.filter((item) => item.id !== Number(id)));
    return result;
  }, []);

  // Arquiva a turma no MySQL.
  const archiveClass = useCallback(async (id) => {
    setClassesError('');

    try {
      const archivedClass = await apiRequest(`/turmas/${id}/arquivar`, {
        method: 'PATCH',
      });

      const normalized = normalizeClass(archivedClass);

      setClasses((previous) =>
        previous.map((item) =>
          item.id === Number(id) ? normalized : item,
        ),
      );

      return normalized;
    } catch (error) {
      setClassesError(error.message);
      throw error;
    }
  }, []);

  // Matricula um aluno na turma usando nome e e-mail.
  const enrollStudent = useCallback(async (classId, student) => {
    setClassesError('');

    const name = student?.name?.trim();
    const email = student?.email?.trim().toLowerCase();
    const registration = student?.registration?.trim() || null;

    if (!name) {
      throw new Error('Informe o nome do aluno.');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Informe um e-mail válido.');
    }

    const cls = classes.find((item) => item.id === Number(classId));

    if (!cls) {
      throw new Error('Turma não encontrada.');
    }

    if (cls.status === 'Arquivada') {
      throw new Error('Não é possível matricular alunos em uma turma arquivada.');
    }

    try {
      const createdStudent = await apiRequest(
        `/turmas/${classId}/matriculas`,
        {
          method: 'POST',
          body: JSON.stringify({
            nome: name,
            email,
            numero_matricula: registration,
          }),
        },
      );

      setClasses((previous) =>
        previous.map((item) => {
          if (item.id !== Number(classId)) return item;

          const alreadyAdded = item.students.some(
            (existing) => Number(existing.id) === Number(createdStudent.id),
          );

          if (alreadyAdded) return item;

          return {
            ...item,
            students: [...item.students, {
              id: Number(createdStudent.id),
              name: createdStudent.name ?? createdStudent.nome,
              email: createdStudent.email,
              registration:
                createdStudent.registration ??
                createdStudent.numero_matricula ??
                null,
            }],
          };
        }),
      );

      return createdStudent;
    } catch (error) {
      setClassesError(error.message);
      throw error;
    }
  }, [classes]);

  // Cria a prova na API (nasce em Rascunho) e devolve a prova salva.
  const addExam = useCallback(async (exam) => {
    const created = await apiRequest('/provas', {
      method: 'POST',
      body: JSON.stringify({
        title: exam.title,
        description: exam.description,
        questions: exam.questions,
      }),
    });

    const saved = normalizeExam(created);

    setExams((previous) => [
      ...previous.filter((item) => item.id !== saved.id),
      saved,
    ]);

    return saved;
  }, []);

  // Edita a prova na API (só em Rascunho) e atualiza a lista com a prova salva.
  const updateExam = useCallback(async (id, exam) => {
    const updated = await apiRequest(`/provas/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: exam.title,
        description: exam.description,
        questions: exam.questions,
      }),
    });

    const saved = normalizeExam(updated);

    setExams((previous) =>
      previous.map((item) => (item.id === saved.id ? saved : item)),
    );

    return saved;
  }, []);

  // Atualiza o status da prova na lista (a API muda Rascunho -> Pronta na 1ª aplicação).
  const syncExamStatus = useCallback((examId, status) => {
    if (!status) return;
    setExams((previous) =>
      previous.map((exam) =>
        exam.id === Number(examId) ? { ...exam, status } : exam,
      ),
    );
  }, []);

  // Cria a aplicação na API (nasce Pendente) e devolve o id salvo.
  const createApplication = useCallback(
    async ({ examId, classId, quantity }) => {
      const created = await apiRequest('/aplicacoes', {
        method: 'POST',
        body: JSON.stringify({ examId, classId, quantity }),
      });

      const saved = normalizeApplication(created);

      setApplications((previous) => [
        ...previous.filter((item) => item.id !== saved.id),
        saved,
      ]);
      syncExamStatus(saved.examId, created.examStatus);

      return saved.id;
    },
    [syncExamStatus],
  );

  // Atualiza a configuração na tela na hora e grava na API; se a API recusar, desfaz.
  const updateApplication = useCallback(
    async (id, patch) => {
      const target = applications.find((item) => item.id === Number(id));

      if (!target) return;

      const previousValues = Object.fromEntries(
        Object.keys(patch).map((key) => [key, target[key]]),
      );

      setApplicationsError('');
      setApplications((previous) =>
        previous.map((item) =>
          item.id === target.id ? { ...item, ...patch } : item,
        ),
      );

      try {
        await apiRequest(`/aplicacoes/${target.id}`, {
          method: 'PUT',
          body: JSON.stringify(patch),
        });
      } catch (error) {
        setApplications((previous) =>
          previous.map((item) =>
            item.id === target.id ? { ...item, ...previousValues } : item,
          ),
        );
        setApplicationsError(error.message);
        throw error;
      }
    },
    [applications],
  );

  // Marca a aplicação como Aplicada na API (PDF baixado) e usa a data que o servidor gravou.
  const confirmApplicationDownload = useCallback(async (id) => {
    const updated = await apiRequest(`/aplicacoes/${Number(id)}/aplicar`, {
      method: 'POST',
    });

    setApplications((previous) =>
      previous.map((item) =>
        item.id === Number(id)
          ? normalizeApplication(updated, item.copies || [])
          : item,
      ),
    );
  }, []);

  // Busca de novo uma aplicação na API depois de lançar ou excluir uma correção,
  // para o status (Aplicada ou Corrigida) e a contagem de correções ficarem em dia.
  const refreshApplication = useCallback(async (id) => {
    try {
      const updated = await apiRequest(`/aplicacoes/${Number(id)}`);
      setApplications((previous) =>
        previous.map((item) =>
          item.id === Number(id)
            ? normalizeApplication(updated, item.copies || [])
            : item,
        ),
      );
    } catch {
      // Se falhar, a tela mantém o que já tinha; o status se ajusta no próximo carregamento.
    }
  }, []);

  // Atualiza as cópias de uma aplicação com os dados da API.
  const replaceApplicationCopies = useCallback((applicationId, copies) => {
    setApplications((previous) =>
      previous.map((item) =>
        item.id === Number(applicationId)
          ? { ...item, copies, quantity: copies.length || item.quantity }
          : item,
      ),
    );
  }, []);

  // Gera as cópias no servidor.
  const generateApplicationCopies = useCallback(
    async (applicationId) => {
      const copies = await apiRequest(
        `/aplicacoes/${Number(applicationId)}/copias`,
        { method: 'POST' },
      );

      if (!Array.isArray(copies)) {
        throw new Error('A API retornou uma lista de cópias inválida.');
      }

      replaceApplicationCopies(applicationId, copies);
      return copies;
    },
    [replaceApplicationCopies],
  );

  // Publica o gabarito no servidor.
  const publishAnswerKey = useCallback(
    async (applicationId, code) => {
      const copies = await apiRequest(
        `/aplicacoes/${Number(applicationId)}/copias/gabarito`,
        {
          method: 'POST',
          body: JSON.stringify(code === 'all' ? {} : { code }),
        },
      );

      if (!Array.isArray(copies)) {
        throw new Error('A API retornou uma lista de cópias inválida.');
      }

      replaceApplicationCopies(applicationId, copies);
      return copies;
    },
    [replaceApplicationCopies],
  );

  // Tira o gabarito do ar (T59): de uma cópia pelo código ou de todas ('all').
  const unpublishAnswerKey = useCallback(
    async (applicationId, code) => {
      const path = `/aplicacoes/${Number(applicationId)}/copias/gabarito`;
      const copies = await apiRequest(
        code === 'all' ? path : `${path}/${encodeURIComponent(code)}`,
        { method: 'DELETE' },
      );

      if (!Array.isArray(copies)) {
        throw new Error('A API retornou uma lista de cópias inválida.');
      }

      replaceApplicationCopies(applicationId, copies);
      return copies;
    },
    [replaceApplicationCopies],
  );
  const findCopyByCode = useCallback(
    (code) => {
      const normalized = (code || '').trim().toUpperCase();

      if (!normalized) return null;

      for (const application of applications) {
        const copy = (application.copies || []).find(
          (item) => item.code === normalized,
        );

        if (copy) return { application, copy };
      }

      return null;
    },
    [applications],
  );

  const classStudents = useCallback(
    (classId) =>
      classes.find((item) => item.id === Number(classId))?.students || [],
    [classes],
  );

  const getClassById = useCallback(
    (id) => classes.find((item) => item.id === Number(id)),
    [classes],
  );

  const getExamById = useCallback(
    (id) => exams.find((item) => item.id === Number(id)),
    [exams],
  );

  const getApplicationById = useCallback(
    (id) =>
      applications.find((item) => item.id === Number(id)),
    [applications],
  );

  const getQuestionById = useCallback(
    (id) => questions.find((item) => item.id === Number(id)),
    [questions],
  );

  const examQuestionsDetailed = useCallback(
    (examId) => {
      const exam = getExamById(examId);

      if (!exam) return [];

      return exam.questions
        .map(({ questionId, score }) => {
          const question = getQuestionById(questionId);

          if (!question) return null;

          return { ...question, score };
        })
        .filter(Boolean);
    },
    [getExamById, getQuestionById],
  );

  const classApplications = useCallback(
    (classId) =>
      applications.filter(
        (application) => application.classId === Number(classId),
      ),
    [applications],
  );

  const selectableClasses = useMemo(
    () => classes.filter((item) => item.status !== 'Arquivada'),
    [classes],
  );

  const selectableExams = useMemo(
    () => exams.filter((item) => item.status !== 'Arquivada'),
    [exams],
  );

  const value = useMemo(
    () => ({
      questions,
      classes,
      classesLoading,
      classesError,
      exams,
      examsLoading,
      examsError,
      applications,
      applicationsLoading,
      applicationsError,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      addClass,
      updateClass,
      archiveClass,
      deleteClass,
      enrollStudent,
      removeStudent,
      importStudents,
      addExam,
      updateExam,
      createApplication,
      updateApplication,
      confirmApplicationDownload,
      refreshApplication,
      generateApplicationCopies,
      publishAnswerKey,
      unpublishAnswerKey,
      findCopyByCode,
      classStudents,
      getClassById,
      getExamById,
      getApplicationById,
      getQuestionById,
      examQuestionsDetailed,
      classApplications,
      selectableClasses,
      selectableExams,
    }),
    [
      questions,
      classes,
      classesLoading,
      classesError,
      exams,
      examsLoading,
      examsError,
      applications,
      applicationsLoading,
      applicationsError,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      addClass,
      updateClass,
      archiveClass,
      deleteClass,
      enrollStudent,
      removeStudent,
      importStudents,
      addExam,
      updateExam,
      createApplication,
      updateApplication,
      confirmApplicationDownload,
      refreshApplication,
      generateApplicationCopies,
      publishAnswerKey,
      unpublishAnswerKey,
      findCopyByCode,
      classStudents,
      getClassById,
      getExamById,
      getApplicationById,
      getQuestionById,
      examQuestionsDetailed,
      classApplications,
      selectableClasses,
      selectableExams,
    ],
  );

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export function useData() {
  const context = useContext(DataContext);

  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }

  return context;
}

export { DataProvider };
