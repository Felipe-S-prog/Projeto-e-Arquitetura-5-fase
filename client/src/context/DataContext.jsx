
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import questionsSeed from '../data/questions.json';
import classesSeed from '../data/classes.json';
import examsSeed from '../data/exams.json';
import applicationsSeed from '../data/applications.json';
import { todayBR } from '../utils/status';
import { buildApplicationCopies } from '../utils/answerKey';

const DataContext = createContext(null);

const API_BASE_URL = 'http://localhost:3333/api';

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
      errorData.message || `Erro na API (${response.status}).`,
    );
  }

  if (response.status === 204) return null;

  return response.json();
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export function DataProvider({ children }) {
  const [questions, setQuestions] = useState(() =>
    questionsSeed.map((q) => ({ ...q })),
  );

  const [classes, setClasses] = useState(() =>
    classesSeed.map((c) => ({ ...c })),
  );

  const [exams, setExams] = useState(() =>
    examsSeed.map((e) => ({ ...e })),
  );

  const [applications, setApplications] = useState(() =>
    applicationsSeed.map((a) => ({ ...a, copies: a.copies || [] })),
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

  // Carrega usuários e configurações da API.
  useEffect(() => {
    let cancelled = false;

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

    loadAdminUsers();
    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const addQuestion = useCallback((question) => {
    setQuestions((prev) => {
      const id = nextId(prev);
      return [...prev, { id, ...question }];
    });
  }, []);

  const deleteQuestion = useCallback((id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const addClass = useCallback((cls) => {
    setClasses((prev) => [
      ...prev,
      { id: nextId(prev), status: 'Ativa', students: [], ...cls },
    ]);
  }, []);

  const archiveClass = useCallback((id) => {
    setClasses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'Arquivada' } : c,
      ),
    );
  }, []);

  const addExam = useCallback((exam) => {
    setExams((prev) => {
      const id = nextId(prev);
      return [...prev, { id, status: 'Rascunho', ...exam }];
    });
  }, []);

  const createApplication = useCallback(({ examId, classId, quantity }) => {
    let newId;

    setApplications((prev) => {
      newId = nextId(prev);

      return [
        ...prev,
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
  }, []);

  const updateApplication = useCallback((id, patch) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }, []);

  const confirmApplicationDownload = useCallback((id) => {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'Aplicada', date: a.date || todayBR() }
          : a,
      ),
    );
  }, []);

  // Gera as cópias da prova para uma aplicação.
  const generateApplicationCopies = useCallback(
    (applicationId) => {
      setApplications((prev) => {
        const app = prev.find((a) => a.id === Number(applicationId));
        if (!app) return prev;

        const exam = exams.find((e) => e.id === app.examId);
        if (!exam) return prev;

        const examQuestions = exam.questions
          .map(({ questionId }) =>
            questions.find((q) => q.id === questionId),
          )
          .filter(Boolean);

        const cls = classes.find((c) => c.id === app.classId);
        const studentNames = app.linkToRoster
          ? (cls?.students || []).map((s) => s.name)
          : null;

        const otherCodes = prev.flatMap((a) =>
          a.id === app.id ? [] : (a.copies || []).map((c) => c.code),
        );

        const copies = buildApplicationCopies({
          examQuestions,
          quantity: app.quantity,
          shuffleQuestions: app.shuffleQuestions,
          shuffleAlternatives: app.shuffleAlternatives,
          studentNames,
          existingCodes: otherCodes,
        });

        return prev.map((a) =>
          a.id === app.id
            ? { ...a, copies, quantity: copies.length }
            : a,
        );
      });
    },
    [exams, questions, classes],
  );

  // Publica o gabarito de uma cópia ou de todas.
  const publishAnswerKey = useCallback((applicationId, code) => {
    const now = new Date().toISOString();

    setApplications((prev) =>
      prev.map((a) => {
        if (a.id !== Number(applicationId)) return a;

        const copies = (a.copies || []).map((c) =>
          code === 'all' || c.code === code
            ? {
                ...c,
                answerKeyPublished: true,
                answerKeyPublishedAt: now,
              }
            : c,
        );

        return { ...a, copies };
      }),
    );
  }, []);

  const findCopyByCode = useCallback(
    (code) => {
      const normalized = (code || '').trim().toUpperCase();
      if (!normalized) return null;

      for (const app of applications) {
        const copy = (app.copies || []).find(
          (c) => c.code === normalized,
        );

        if (copy) return { application: app, copy };
      }

      return null;
    },
    [applications],
  );

  const classStudents = useCallback(
    (classId) =>
      classes.find((c) => c.id === Number(classId))?.students || [],
    [classes],
  );

  const addAdminUser = useCallback(async (user) => {
    setAdminUsersError('');

    try {
      const createdUser = await adminApiRequest('/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify(user),
      });

      setAdminUsers((prev) => [createdUser, ...prev]);

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

      setAdminUsers((prev) =>
        prev.map((user) =>
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

      setAdminUsers((prev) =>
        prev.filter((user) => user.id !== Number(id)),
      );
    } catch (error) {
      setAdminUsersError(error.message);
      throw error;
    }
  }, []);

  // Atualiza as configurações no MySQL pela API.
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
    (id) => classes.find((c) => c.id === Number(id)),
    [classes],
  );

  const getExamById = useCallback(
    (id) => exams.find((e) => e.id === Number(id)),
    [exams],
  );

  const getApplicationById = useCallback(
    (id) => applications.find((a) => a.id === Number(id)),
    [applications],
  );

  const getQuestionById = useCallback(
    (id) => questions.find((q) => q.id === Number(id)),
    [questions],
  );

  const examQuestionsDetailed = useCallback(
    (examId) => {
      const exam = getExamById(examId);
      if (!exam) return [];

      return exam.questions
        .map(({ questionId, score }) => {
          const q = getQuestionById(questionId);
          if (!q) return null;
          return { ...q, score };
        })
        .filter(Boolean);
    },
    [getExamById, getQuestionById],
  );

  const classApplications = useCallback(
    (classId) =>
      applications.filter((a) => a.classId === Number(classId)),
    [applications],
  );

  const selectableClasses = useMemo(
    () => classes.filter((c) => c.status !== 'Arquivada'),
    [classes],
  );

  const selectableExams = useMemo(
    () => exams.filter((e) => e.status !== 'Arquivada'),
    [exams],
  );

  // Gera cópias para aplicações que já nasceram como "Aplicada" no seed.
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
      exams,
      applications,
      adminUsers,
      adminUsersLoading,
      adminUsersError,
      settings,
      settingsLoading,
      settingsError,
      addQuestion,
      deleteQuestion,
      addClass,
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
      exams,
      applications,
      adminUsers,
      adminUsersLoading,
      adminUsersError,
      settings,
      settingsLoading,
      settingsError,
      addQuestion,
      deleteQuestion,
      addClass,
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
}

export function useData() {
  const ctx = useContext(DataContext);

  if (!ctx) {
    throw new Error('useData must be used within DataProvider');
  }

  return ctx;
}
