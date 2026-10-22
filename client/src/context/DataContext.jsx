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
import adminUsersSeed from '../data/adminUsers.json';
import settingsSeed from '../data/settings.json';
import { todayBR } from '../utils/status';
import { buildApplicationCopies } from '../utils/answerKey';

const DataContext = createContext(null);

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3333/api';

const PROFESSOR_ID = Number(import.meta.env.VITE_PROFESSOR_ID || 1);

// Chaves usadas no localStorage.
const ADMIN_USERS_STORAGE_KEY = 'sgp:adminUsers';
const SETTINGS_STORAGE_KEY = 'sgp:settings';

function loadPersisted(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) return fallback;

    const parsed = JSON.parse(raw);

    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A sessão continua funcionando mesmo se o armazenamento falhar.
  }
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export function DataProvider({ children }) {
  const [questions, setQuestions] = useState(() =>
    questionsSeed.map((q) => ({ ...q }))
  );

  // Carrega as questões da API.
  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/questoes?professor_id=${PROFESSOR_ID}`
        );

        if (!response.ok) {
          throw new Error('Não foi possível carregar as questões da API.');
        }

        const payload = await response.json();

        const apiQuestions = Array.isArray(payload)
          ? payload
          : payload?.data || [];

        if (cancelled) return;

        setQuestions((current) => {
          const apiIds = new Set(
            apiQuestions.map((question) => String(question.id))
          );

          const localQuestions = current.filter(
            (question) => !apiIds.has(String(question.id))
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

  const [classes, setClasses] = useState(() =>
    classesSeed.map((c) => ({ ...c }))
  );

  const [exams, setExams] = useState(() =>
    examsSeed.map((e) => ({ ...e }))
  );

  const [applications, setApplications] = useState(() =>
    applicationsSeed.map((a) => ({
      ...a,
      copies: a.copies || [],
    }))
  );

  const [adminUsers, setAdminUsers] = useState(() =>
    loadPersisted(
      ADMIN_USERS_STORAGE_KEY,
      adminUsersSeed.map((u) => ({ ...u }))
    )
  );

  const [settings, setSettings] = useState(() =>
    loadPersisted(SETTINGS_STORAGE_KEY, { ...settingsSeed })
  );

  useEffect(() => {
    persist(ADMIN_USERS_STORAGE_KEY, adminUsers);
  }, [adminUsers]);

  useEffect(() => {
    persist(SETTINGS_STORAGE_KEY, settings);
  }, [settings]);

  // Cria uma questão na API.
  const addQuestion = useCallback(async (question) => {
    const response = await fetch(`${API_BASE_URL}/questoes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        professor_id: PROFESSOR_ID,
        tipo: 'OBJETIVA',
        enunciado: question.excerpt,
        imagem_url: question.imageUrl || null,
        tags: question.tags || [],
        alternativas: (question.alternatives || []).map((a) => ({
          texto: a.text,
          correta: Boolean(a.correct),
        })),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload?.message ||
          payload?.error ||
          'Não foi possível criar a questão.'
      );
    }

    const saved = payload?.question || payload?.data || payload;

    setQuestions((prev) => [
      saved,
      ...prev.filter((q) => String(q.id) !== String(saved.id)),
    ]);

    return saved;
  }, []);

  // Atualiza uma questão existente na API.
  const updateQuestion = useCallback(async (id, question) => {
    const response = await fetch(`${API_BASE_URL}/questoes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        professor_id: PROFESSOR_ID,
        tipo: 'OBJETIVA',
        enunciado: question.excerpt,
        imagem_url: question.imageUrl || null,
        tags: question.tags || [],
        alternativas: (question.alternatives || []).map((a) => ({
          texto: a.text,
          correta: Boolean(a.correct),
        })),
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload?.message ||
          payload?.error ||
          'Não foi possível atualizar a questão.'
      );
    }

    const saved = payload?.question || payload?.data || payload;

    setQuestions((prev) =>
      prev.map((q) =>
        String(q.id) === String(id) ? saved : q
      )
    );

    return saved;
  }, []);

  // Exclui uma questão pela API.
  const deleteQuestion = useCallback(async (id) => {
    const response = await fetch(
      `${API_BASE_URL}/questoes/${id}?professor_id=${PROFESSOR_ID}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);

      throw new Error(
        payload?.message ||
          payload?.error ||
          'Não foi possível excluir a questão.'
      );
    }

    setQuestions((prev) =>
      prev.filter((q) => String(q.id) !== String(id))
    );
  }, []);

  const addClass = useCallback((cls) => {
    let duplicateFound = false;

    setClasses((prev) => {
      const normalize = (value) => (value || '').trim().toLowerCase();

      duplicateFound = prev.some(
        (c) =>
          normalize(c.name) === normalize(cls.name) &&
          normalize(c.subject) === normalize(cls.subject) &&
          normalize(c.period) === normalize(cls.period)
      );

      if (duplicateFound) {
        return prev;
      }

      return [
        ...prev,
        {
          id: nextId(prev),
          status: 'Ativa',
          students: [],
          ...cls,
        },
      ];
    });

    return !duplicateFound;
  }, []);

  const archiveClass = useCallback((id) => {
    setClasses((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'Arquivada' } : c
      )
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
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
  }, []);

  const confirmApplicationDownload = useCallback((id) => {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: 'Aplicada', date: a.date || todayBR() }
          : a
      )
    );
  }, []);

  // Gera as cópias da prova de uma aplicação.
  const generateApplicationCopies = useCallback(
    (applicationId) => {
      setApplications((prev) => {
        const app = prev.find(
          (a) => a.id === Number(applicationId)
        );

        if (!app) return prev;

        const exam = exams.find((e) => e.id === app.examId);

        if (!exam) return prev;

        const examQuestions = exam.questions
          .map(({ questionId }) =>
            questions.find((q) => q.id === questionId)
          )
          .filter(Boolean);

        const cls = classes.find((c) => c.id === app.classId);

        const studentNames = app.linkToRoster
          ? (cls?.students || []).map((s) => s.name)
          : null;

        const otherCodes = prev.flatMap((a) =>
          a.id === app.id
            ? []
            : (a.copies || []).map((c) => c.code)
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
            : a
        );
      });
    },
    [exams, questions, classes]
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
            : c
        );

        return { ...a, copies };
      })
    );
  }, []);

  // Busca uma cópia pelo código.
  const findCopyByCode = useCallback(
    (code) => {
      const normalized = (code || '').trim().toUpperCase();

      if (!normalized) return null;

      for (const app of applications) {
        const copy = (app.copies || []).find(
          (c) => c.code === normalized
        );

        if (copy) return { application: app, copy };
      }

      return null;
    },
    [applications]
  );

  const classStudents = useCallback(
    (classId) =>
      classes.find((c) => c.id === Number(classId))?.students || [],
    [classes]
  );

  const addAdminUser = useCallback((user) => {
    setAdminUsers((prev) => {
      const id = nextId(prev);

      return [...prev, { id, status: 'Convidado', ...user }];
    });
  }, []);

  const updateAdminUser = useCallback((id, patch) => {
    setAdminUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
    );
  }, []);

  const removeAdminUser = useCallback((id) => {
    setAdminUsers((prev) =>
      prev.filter((u) => u.id !== id)
    );
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const getClassById = useCallback(
    (id) => classes.find((c) => c.id === Number(id)),
    [classes]
  );

  const getExamById = useCallback(
    (id) => exams.find((e) => e.id === Number(id)),
    [exams]
  );

  const getApplicationById = useCallback(
    (id) => applications.find((a) => a.id === Number(id)),
    [applications]
  );

  const getQuestionById = useCallback(
    (id) => questions.find((q) => q.id === Number(id)),
    [questions]
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
    [getExamById, getQuestionById]
  );

  const classApplications = useCallback(
    (classId) =>
      applications.filter((a) => a.classId === Number(classId)),
    [applications]
  );

  const selectableClasses = useMemo(
    () => classes.filter((c) => c.status !== 'Arquivada'),
    [classes]
  );

  const selectableExams = useMemo(
    () => exams.filter((e) => e.status !== 'Arquivada'),
    [exams]
  );

  // Gera as cópias para aplicações que já vieram aplicadas no mock.
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
      settings,

      addQuestion,
      updateQuestion,
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
      settings,

      addQuestion,
      updateQuestion,
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
    ]
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