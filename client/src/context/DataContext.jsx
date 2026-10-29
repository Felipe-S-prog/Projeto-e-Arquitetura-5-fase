
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import questionsSeed from '../data/questions.json';
import { useAuth } from './AuthContext';
import { apiRequest } from '../services/api';

const DataContext = createContext(null);

async function adminApiRequest(path, options = {}) {
  return apiRequest(path, options);
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

// Monta o corpo enviado para a API de quest├Áes.
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

// Normaliza uma aplicação vinda da API. As cópias (copies) vêm de /copias (T23).
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
    copies,
  };
}

function unwrapQuestion(payload) {
  return payload?.question || payload?.data || payload;
}

const DataProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [questions, setQuestions] = useState(() =>
    questionsSeed.map((question) => ({ ...question })),
  );

  // Carrega as quest├Áes da API.
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'PROFESSOR') return undefined;
    let cancelled = false;

    async function loadQuestions() {
      try {
        const payload = await adminApiRequest(
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
        console.error('Erro ao carregar quest├Áes:', error);
      }
    }

    loadQuestions();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, user?.role]);

  // Turmas passam a vir da API, n├úo mais do classes.json.
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');

  // Provas passam a vir da API, n├úo mais do exams.json.
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState('');

  // Aplica├º├Áes passam a vir da API, n├úo mais do applications.json.
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState('');

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(true);
  const [adminUsersError, setAdminUsersError] = useState('');

  const [settings, setSettings] = useState({
    institutionName: '',
    defaultPeriod: '',
  });

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    setQuestions(questionsSeed.map((question) => ({ ...question })));
    setClasses([]);
    setExams([]);
    setApplications([]);
    setAdminUsers([]);
    setSettings({ institutionName: '', defaultPeriod: '' });
    setClassesError('');
    setExamsError('');
    setApplicationsError('');
    setAdminUsersError('');
    setSettingsError('');
  }, [user?.id]);

  // Carrega turmas, usu├írios administrativos e configura├º├Áes.
  useEffect(() => {
    if (!isAuthenticated) {
      setClassesLoading(false);
      setExamsLoading(false);
      setApplicationsLoading(false);
      setAdminUsersLoading(false);
      setSettingsLoading(false);
      return undefined;
    }
    let cancelled = false;

    async function loadClasses() {
      setClassesLoading(true);
      setClassesError('');

      try {
        const result = await adminApiRequest(
          '/turmas',
        );

        if (!Array.isArray(result)) {
          throw new Error('A API retornou uma lista de turmas inv├ílida.');
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
          adminApiRequest('/aplicacoes'),
          adminApiRequest('/copias'),
        ]);

        if (!Array.isArray(result) || !Array.isArray(copies)) {
          throw new Error('A API retornou uma lista de aplicações inválida.');
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

    async function loadExams() {
      setExamsLoading(true);
      setExamsError('');

      try {
        const result = await adminApiRequest(
          '/provas',
        );

        if (!Array.isArray(result)) {
          throw new Error('A API retornou uma lista de provas inv├ílida.');
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

    if (user?.role === 'PROFESSOR') {
      loadClasses();
      loadExams();
      loadApplications();
    } else {
      setExamsLoading(false);
      setApplicationsLoading(false);
    }
    if (user?.role === 'ADMINISTRADOR') {
      loadAdminUsers();
      loadSettings();
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, user?.role]);

  // Cria uma quest├úo na API.
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

  // Atualiza uma quest├úo existente na API.
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

  // Exclui uma quest├úo pela API.
  const deleteQuestion = useCallback(async (id) => {
    await adminApiRequest(
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
      throw new Error('Preencha o nome, a disciplina e o per├¡odo.');
    }

    const duplicate = classes.some(
      (item) =>
        item.name.trim().toLowerCase() === name.toLowerCase() &&
        item.subject.trim().toLowerCase() === subject.toLowerCase() &&
        item.period.trim().toLowerCase() === period.toLowerCase(),
    );

    if (duplicate) {
      throw new Error(
        'J├í existe uma turma com esse nome, disciplina e per├¡odo.',
      );
    }

    try {
      const createdClass = await adminApiRequest('/turmas', {
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
  }, [classes]);

  // Atualiza uma turma existente no MySQL.
  const updateClass = useCallback(async (id, changes) => {
    setClassesError('');

    const name = changes.name?.trim();
    const subject = changes.subject?.trim();
    const period = changes.period?.trim();

    if (!name || !subject || !period) {
      throw new Error('Preencha o nome, a disciplina e o per├¡odo.');
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
        'J├í existe outra turma com esse nome, disciplina e per├¡odo.',
      );
    }

    try {
      const updatedClass = await adminApiRequest(`/turmas/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
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
      const archivedClass = await adminApiRequest(`/turmas/${id}/arquivar`, {
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
      throw new Error('Informe um e-mail vÃ¡lido.');
    }

    const cls = classes.find((item) => item.id === Number(classId));

    if (!cls) {
      throw new Error('Turma nÃ£o encontrada.');
    }

    if (cls.status === 'Arquivada') {
      throw new Error('NÃ£o Ã© possÃ­vel matricular alunos em uma turma arquivada.');
    }

    try {
      const createdStudent = await adminApiRequest(
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
    const created = await adminApiRequest('/provas', {
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

  // Atualiza o status da prova na lista (a API muda Rascunho -> Pronta na 1┬¬ aplica├º├úo).
  const syncExamStatus = useCallback((examId, status) => {
    if (!status) return;
    setExams((previous) =>
      previous.map((exam) =>
        exam.id === Number(examId) ? { ...exam, status } : exam,
      ),
    );
  }, []);

  // Cria a aplica├º├úo na API (nasce Pendente) e devolve o id salvo.
  const createApplication = useCallback(
    async ({ examId, classId, quantity }) => {
      const created = await adminApiRequest('/aplicacoes', {
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

  // Atualiza a configura├º├úo na tela na hora e grava na API; se a API recusar, desfaz.
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
        await adminApiRequest(`/aplicacoes/${target.id}`, {
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

  // Marca a aplica├º├úo como Aplicada na API (PDF baixado) e usa a data que o servidor gravou.
  const confirmApplicationDownload = useCallback(async (id) => {
    const updated = await adminApiRequest(`/aplicacoes/${Number(id)}/aplicar`, {
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

  // Troca as cópias de uma aplicação na lista pelas que a API devolveu.
  const replaceApplicationCopies = useCallback((applicationId, copies) => {
    setApplications((previous) =>
      previous.map((item) =>
        item.id === Number(applicationId)
          ? { ...item, copies, quantity: copies.length || item.quantity }
          : item,
      ),
    );
  }, []);

  // Gera (ou regera) as cópias da prova no servidor, que grava em copia_prova (T23).
  // Só funciona com a aplicação Pendente; depois do download as cópias ficam fixas.
  const generateApplicationCopies = useCallback(
    async (applicationId) => {
      const copies = await adminApiRequest(
        `/aplicacoes/${Number(applicationId)}/copias`,
        { method: 'POST' },
      );

      replaceApplicationCopies(applicationId, copies);

      return copies;
    },
    [replaceApplicationCopies],
  );

  // Publica o gabarito de uma cópia (pelo código) ou de todas ('all').
  const publishAnswerKey = useCallback(
    async (applicationId, code) => {
      const copies = await adminApiRequest(
        `/aplicacoes/${Number(applicationId)}/copias/gabarito`,
        {
          method: 'POST',
          body: JSON.stringify(code === 'all' ? {} : { code }),
        },
      );

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

  // Atualiza as configura├º├Áes pela API.
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
      examsLoading,
      examsError,
      applications,
      applicationsLoading,
      applicationsError,
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

