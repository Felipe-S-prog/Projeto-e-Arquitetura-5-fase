import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import questionsSeed from '../data/questions.json';
import classesSeed from '../data/classes.json';
import examsSeed from '../data/exams.json';
import applicationsSeed from '../data/applications.json';
import adminUsersSeed from '../data/adminUsers.json';
import settingsSeed from '../data/settings.json';
import { todayBR } from '../utils/status';

const DataContext = createContext(null);

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export function DataProvider({ children }) {
  const [questions, setQuestions] = useState(() => questionsSeed.map((q) => ({ ...q })));
  const [classes, setClasses] = useState(() => classesSeed.map((c) => ({ ...c })));
  const [exams, setExams] = useState(() => examsSeed.map((e) => ({ ...e })));
  const [applications, setApplications] = useState(() => applicationsSeed.map((a) => ({ ...a })));
  const [adminUsers, setAdminUsers] = useState(() => adminUsersSeed.map((u) => ({ ...u })));
  const [settings, setSettings] = useState(() => ({ ...settingsSeed }));

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
    setClasses((prev) => [...prev, { id: nextId(prev), status: 'Ativa', ...cls }]);
  }, []);

  const archiveClass = useCallback((id) => {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'Arquivada' } : c)));
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
        },
      ];
    });
    return newId;
  }, []);

  const updateApplication = useCallback((id, patch) => {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const confirmApplicationDownload = useCallback((id) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Aplicada', date: a.date || todayBR() } : a))
    );
  }, []);

  const addAdminUser = useCallback((user) => {
    setAdminUsers((prev) => {
      const id = nextId(prev);
      return [...prev, { id, status: 'Convidado', ...user }];
    });
  }, []);

  const removeAdminUser = useCallback((id) => {
    setAdminUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const getClassById = useCallback((id) => classes.find((c) => c.id === Number(id)), [classes]);
  const getExamById = useCallback((id) => exams.find((e) => e.id === Number(id)), [exams]);
  const getApplicationById = useCallback(
    (id) => applications.find((a) => a.id === Number(id)),
    [applications]
  );
  const getQuestionById = useCallback((id) => questions.find((q) => q.id === Number(id)), [questions]);

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
    (classId) => applications.filter((a) => a.classId === Number(classId)),
    [applications]
  );

  const selectableClasses = useMemo(() => classes.filter((c) => c.status !== 'Arquivada'), [classes]);
  const selectableExams = useMemo(() => exams.filter((e) => e.status !== 'Arquivada'), [exams]);

  const value = useMemo(
    () => ({
      questions,
      classes,
      exams,
      applications,
      adminUsers,
      settings,
      addQuestion,
      deleteQuestion,
      addClass,
      archiveClass,
      addExam,
      createApplication,
      updateApplication,
      confirmApplicationDownload,
      addAdminUser,
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
      deleteQuestion,
      addClass,
      archiveClass,
      addExam,
      createApplication,
      updateApplication,
      confirmApplicationDownload,
      addAdminUser,
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

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
