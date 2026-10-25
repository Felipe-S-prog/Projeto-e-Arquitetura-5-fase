
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import questionsSeed from '../data/questions.json';
import examsSeed from '../data/exams.json';
import applicationsSeed from '../data/applications.json';
import { todayBR } from '../utils/status';
import { buildApplicationCopies } from '../utils/answerKey';

const DataContext = createContext(null);

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3333/api';

// ID temporário para desenvolvimento.
// Corresponde ao professor de teste cadastrado no banco.
const DEFAULT_PROFESSOR_ID = Number(import.meta.env.VITE_PROFESSOR_ID || 1);

async function adminApiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      errorData.error?.message ||
        errorData.message ||
        `Erro na API (${response.status}).`,
    );
  }

  if (response.status === 204) return null;

  return response.json();
}

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
    students: cls.students ?? [],
  };
}

// Monta o corpo enviado para a API de questões.
function buildQuestionPayload(question) {
  return {
    professor_id: DEFAULT_PROFESSOR_ID,
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

function unwrapQuestion(payload) {
  return payload?.question || payload?.data || payload;
}

const DataProvider = ({ children }) => {
  const [questions, setQuestions] = useState(() =>
    questionsSeed.map((question) => ({ ...question })),
  );

  // Carrega as questões da API.
  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      try {
        const payload = await adminApiRequest(
          `/questoes?professor_id=${DEFAULT_PROFESSOR_ID}`,
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
  }, []);

  // Turmas passam a vir da API, não mais do classes.json.
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');

  const [exams, setExams] = useState(() =>
    examsSeed.map((exam) => ({ ...exam })),
  );

  const [applications, setApplications] = useState(() =>
    applicationsSeed.map((application) => ({
      ...application,
      copies: application.copies || [],
    })),
  );

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(true);
  const [adminUsersError, setAdminUsersError] = useState('');

  const [settings, setSettings] = useState({
    institutionName: '',
    defaultPeriod: '',
  });

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');

  // Carrega turmas, usuários administrativos e configurações.
  useEffect(() => {
    let cancelled = false;

    async function loadClasses() {
      setClassesLoading(true);
      setClassesError('');

      try {
        const result = await adminApiRequest(
          `/turmas?professor_id=${DEFAULT_PROFESSOR_ID}`,
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

    async function loadAdminUsers() {
      setAdminUsersLoading(true);
      setAdminUsersError('');

      try {
        const users = await adminApiRequest('/admin/usuarios');

        if (!cancelled) {
          setAdminUsers(users);
        }
      } catch (error) {
        if (!cancelled) {
          setAdminUsersError(error.message);
        }
      } finally {
        if (!cancelled) {
          setAdminUsersLoading(false);
        }
      }
    }

    async function loadSettings() {
      setSettingsLoading(true);
      setSettingsError('');

      try {
        const savedSettings = await adminApiRequest('/settings');

        if (!cancelled) {
          setSettings(savedSettings);
        }
      } catch (error) {
        if (!cancelled) {
          setSettingsError(error.message);
        }
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      }
    }

    loadClasses();
    loadAdminUsers();
    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  // Cria uma questão na API.
  const addQuestion = useCallback(async (question) => {
    const saved = unwrapQuestion(
      await adminApiRequest('/questoes', {
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
      await adminApiRequest(`/questoes/${id}`, {
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
    await adminApiRequest(
      `/questoes/${id}?professor_id=${DEFAULT_PROFESSOR_ID}`,
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

    const duplicate = classes.some(
      (item) =>
        item.name.trim().toLowerCase() === name.toLowerCase() &&
        item.subject.trim().toLowerCase() === subject.toLowerCase() &&
        item.period.trim().toLowerCase() === period.toLowerCase(),
    );

    if (duplicate) {
      throw new Error(
        'Já existe uma turma com esse nome, disciplina e período.',
      );
    }

    try {
      const createdClass = await adminApiRequest('/turmas', {
        method: 'POST',
        body: JSON.stringify({
          professor_id: DEFAULT_PROFESSOR_ID,
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
  }, [classes]);

  // Atualiza uma turma existente no MySQL.
  const updateClass = useCallback(async (id, changes) => {
    setClassesError('');

    const name = changes.name?.trim();
    const subject = changes.subject?.trim();
    const period = changes.period?.trim();

    if (!name || !subject || !period) {
      throw new Error('Preencha o nome, a disciplina e o período.');
    }

    const duplicate = classes.some(
      (item) =>
        item.id !== Number(id) &&
        item.name.trim().toLowerCase() === name.toLowerCase() &&
        item.subject.trim().toLowerCase() === subject.toLowerCase() &&
        item.period.trim().toLowerCase() === period.toLowerCase(),
    );

    if (duplicate) {
      throw new Error(
        'Já existe outra turma com esse nome, disciplina e período.',
      );
    }

    try {
      const updatedClass = await adminApiRequest(`/turmas/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          professor_id: DEFAULT_PROFESSOR_ID,
          nome: name,
          disciplina: subject,
          periodo: period,
        }),
      });

      const normalized = normalizeClass(updatedClass);

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
  }, [classes]);

  // Arquiva a turma no MySQL.
  const archiveClass = useCallback(async (id) => {
    setClassesError('');

    try {
      const archivedClass = await adminApiRequest(
        `/turmas/${id}/arquivar`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            professor_id: DEFAULT_PROFESSOR_ID,
          }),
        },
      );

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

  const addExam = useCallback((exam) => {
    setExams((previous) => {
      const id =
        previous.reduce(
          (max, item) => Math.max(max, Number(item.id) || 0),
          0,
        ) + 1;

      return [...previous, { id, status: 'Rascunho', ...exam }];
    });
  }, []);

  const createApplication = useCallback(
    ({ examId, classId, quantity }) => {
      let newId;

      setApplications((previous) => {
        newId =
          previous.reduce(
            (max, item) => Math.max(max, Number(item.id) || 0),
            0,
          ) + 1;

        return [
          ...previous,
          {
            id: newId,
            examId,
            classId,
            status: 'Pendente',
            quantity,
            date: null,
            shuffleQuestions: true,
            shuffleAlternatives: true,
            linkToRoster: false,
            copies: [],
          },
        ];
      });

      return newId;
    },
    [],
  );

  const updateApplication = useCallback((id, patch) => {
    setApplications((previous) =>
      previous.map((application) =>
        application.id === id
          ? { ...application, ...patch }
          : application,
      ),
    );
  }, []);

  const confirmApplicationDownload = useCallback((id) => {
    setApplications((previous) =>
      previous.map((application) =>
        application.id === id
          ? {
              ...application,
              status: 'Aplicada',
              date: application.date || todayBR(),
            }
          : application,
      ),
    );
  }, []);

  // Gera cópias da prova para uma aplicação.
  const generateApplicationCopies = useCallback(
    (applicationId) => {
      setApplications((previous) => {
        const application = previous.find(
          (item) => item.id === Number(applicationId),
        );

        if (!application) return previous;

        const exam = exams.find(
          (item) => item.id === application.examId,
        );

        if (!exam) return previous;

        const examQuestions = exam.questions
          .map(({ questionId }) =>
            questions.find((question) => question.id === questionId),
          )
          .filter(Boolean);

        const cls = classes.find(
          (item) => item.id === application.classId,
        );

        const studentNames = application.linkToRoster
          ? (cls?.students || []).map((student) => student.name)
          : null;

        const otherCodes = previous.flatMap((item) =>
          item.id === application.id
            ? []
            : (item.copies || []).map((copy) => copy.code),
        );

        const copies = buildApplicationCopies({
          examQuestions,
          quantity: application.quantity,
          shuffleQuestions: application.shuffleQuestions,
          shuffleAlternatives: application.shuffleAlternatives,
          studentNames,
          existingCodes: otherCodes,
        });

        return previous.map((item) =>
          item.id === application.id
            ? { ...item, copies, quantity: copies.length }
            : item,
        );
      });
    },
    [exams, questions, classes],
  );

  // Publica o gabarito de uma cópia ou de todas.
  const publishAnswerKey = useCallback((applicationId, code) => {
    const now = new Date().toISOString();

    setApplications((previous) =>
      previous.map((application) => {
        if (application.id !== Number(applicationId)) {
          return application;
        }

        const copies = (application.copies || []).map((copy) =>
          code === 'all' || copy.code === code
            ? {
                ...copy,
                answerKeyPublished: true,
                answerKeyPublishedAt: now,
              }
            : copy,
        );

        return { ...application, copies };
      }),
    );
  }, []);

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

  const addAdminUser = useCallback(async (user) => {
    setAdminUsersError('');

    try {
      const createdUser = await adminApiRequest('/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify(user),
      });

      setAdminUsers((previous) => [createdUser, ...previous]);

      return createdUser;
    } catch (error) {
      setAdminUsersError(error.message);
      throw error;
    }
  }, []);

  const updateAdminUser = useCallback(async (id, patch) => {
    setAdminUsersError('');

    try {
      const updatedUser = await adminApiRequest(
        `/admin/usuarios/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(patch),
        },
      );

      setAdminUsers((previous) =>
        previous.map((user) =>
          user.id === updatedUser.id ? updatedUser : user,
        ),
      );

      return updatedUser;
    } catch (error) {
      setAdminUsersError(error.message);
      throw error;
    }
  }, []);

  const removeAdminUser = useCallback(async (id) => {
    setAdminUsersError('');

    try {
      await adminApiRequest(`/admin/usuarios/${id}`, {
        method: 'DELETE',
      });

      setAdminUsers((previous) =>
        previous.filter((user) => user.id !== Number(id)),
      );
    } catch (error) {
      setAdminUsersError(error.message);
      throw error;
    }
  }, []);

  // Atualiza as configurações pela API.
  const updateSettings = useCallback(async (patch) => {
    setSettingsError('');

    try {
      const updatedSettings = await adminApiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          institutionName: patch.institutionName,
          defaultPeriod: patch.defaultPeriod,
        }),
      });

      setSettings(updatedSettings);

      return updatedSettings;
    } catch (error) {
      setSettingsError(error.message);
      throw error;
    }
  }, []);

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

  // Mantém o comportamento existente das aplicações de exemplo.
  useEffect(() => {
    applicationsSeed.forEach((seed) => {
      if (seed.status === 'Aplicada') {
        generateApplicationCopies(seed.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({
      questions,
      classes,
      classesLoading,
      classesError,
      exams,
      applications,
      adminUsers,
      adminUsersLoading,
      adminUsersError,
      settings,
      settingsLoading,
      settingsError,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      addClass,
      updateClass,
      archiveClass,
      addExam,
      createApplication,
      updateApplication,
      confirmApplicationDownload,
      generateApplicationCopies,
      publishAnswerKey,
      findCopyByCode,
      classStudents,
      addAdminUser,
      updateAdminUser,
      removeAdminUser,
      updateSettings,
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
      applications,
      adminUsers,
      adminUsersLoading,
      adminUsersError,
      settings,
      settingsLoading,
      settingsError,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      addClass,
      updateClass,
      archiveClass,
      addExam,
      createApplication,
      updateApplication,
      confirmApplicationDownload,
      generateApplicationCopies,
      publishAnswerKey,
      findCopyByCode,
      classStudents,
      addAdminUser,
      updateAdminUser,
      removeAdminUser,
      updateSettings,
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