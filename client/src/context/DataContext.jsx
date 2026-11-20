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

function formatApiDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : null;
}

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
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;

    async function loadQuestions() {
      try {
        const payload = await apiRequest('/questoes');
        const apiQuestions = Array.isArray(payload) ? payload : payload?.data || [];
        if (cancelled) return;

        setQuestions((current) => {
          const apiIds = new Set(apiQuestions.map((question) => String(question.id)));
          const localQuestions = current.filter((question) => !apiIds.has(String(question.id)));
          return [...apiQuestions, ...localQuestions];
        });
      } catch (error) {
        console.error('Erro ao carregar questões:', error);
      }
    }

    loadQuestions();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');

  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState('');

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
        const result = await apiRequest('/turmas');
        if (!Array.isArray(result)) {
          throw new Error('A API retornou uma lista de turmas inválida.');
        }
        if (!cancelled) setClasses(result.map(normalizeClass));
      } catch (error) {
        if (!cancelled) setClassesError(error.message);
      } finally {
        if (!cancelled) setClassesLoading(false);
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
            result.map((item) => normalizeApplication(
              item,
              copies.filter((copy) => copy.applicationId === Number(item.id)),
            )),
          );
        }
      } catch (error) {
        if (!cancelled) setApplicationsError(error.message);
      } finally {
        if (!cancelled) setApplicationsLoading(false);
      }
    }

    async function loadExams() {
      setExamsLoading(true);
      setExamsError('');
      try {
        const result = await apiRequest('/provas');
        if (!Array.isArray(result)) {
          throw new Error('A API retornou uma lista de provas inválida.');
        }
        if (!cancelled) setExams(result.map(normalizeExam));
      } catch (error) {
        if (!cancelled) setExamsError(error.message);
      } finally {
        if (!cancelled) setExamsLoading(false);
      }
    }

    loadClasses();
    loadExams();
    loadApplications();

    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  const addQuestion = useCallback(async (question) => {
    const saved = unwrapQuestion(await apiRequest('/questoes', {
      method: 'POST',
      body: JSON.stringify(buildQuestionPayload(question)),
    }));

    setQuestions((previous) => [
      saved,
      ...previous.filter((item) => String(item.id) !== String(saved.id)),
    ]);
    return saved;
  }, []);

  const updateQuestion = useCallback(async (id, question) => {
    const saved = unwrapQuestion(await apiRequest(`/questoes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(buildQuestionPayload(question)),
    }));

    setQuestions((previous) => previous.map((item) => (
      String(item.id) === String(id) ? saved : item
    )));
    return saved;
  }, []);

  const deleteQuestion = useCallback(async (id) => {
    await apiRequest(`/questoes/${id}`, { method: 'DELETE' });
    setQuestions((previous) => previous.filter((question) => String(question.id) !== String(id)));
  }, []);

  const addClass = useCallback(async (cls) => {
    setClassesError('');
    const name = cls.name?.trim();
    const subject = cls.subject?.trim();
    const period = cls.period?.trim();

    if (!name || !subject || !period) {
      throw new Error('Preencha o nome, a disciplina e o período.');
    }

    const duplicate = classes.some((item) => (
      item.name.trim().toLowerCase() === name.toLowerCase() &&
      item.subject.trim().toLowerCase() === subject.toLowerCase() &&
      item.period.trim().toLowerCase() === period.toLowerCase()
    ));

    if (duplicate) {
      throw new Error('Já existe uma turma com esse nome, disciplina e período.');
    }

    try {
      const createdClass = await apiRequest('/turmas', {
        method: 'POST',
        body: JSON.stringify({ nome: name, disciplina: subject, periodo: period }),
      });
      const normalized = normalizeClass(createdClass);
      setClasses((previous) => [normalized, ...previous]);
      return normalized;
    } catch (error) {
      setClassesError(error.message);
      throw error;
    }
  }, [classes]);

  const updateClass = useCallback(async (id, changes) => {
    setClassesError('');
    const classId = Number(id);
    const name = changes.name?.trim();
    const subject = changes.subject?.trim();
    const period = changes.period?.trim();

    if (!name || !subject || !period) {
      throw new Error('Preencha o nome, a disciplina e o período.');
    }

    const duplicate = classes.some((item) => (
      item.id !== classId &&
      item.name.trim().toLowerCase() === name.toLowerCase() &&
      item.subject.trim().toLowerCase() === subject.toLowerCase() &&
      item.period.trim().toLowerCase() === period.toLowerCase()
    ));

    if (duplicate) {
      throw new Error('Já existe outra turma com esse nome, disciplina e período.');
    }

    try {
      const response = await apiRequest(`/turmas/${classId}`, {
        method: 'PUT',
        body: JSON.stringify({ nome: name, disciplina: subject, periodo: period }),
      });
      const returnedClass = response?.data ?? response ?? {};

      setClasses((current) => current.map((item) => (
        item.id === classId ? {
          ...item,
          id: classId,
          name,
          subject,
          period,
          status: returnedClass.status
            ? normalizeClass({ ...item, ...returnedClass }).status
            : item.status,
          students: item.students ?? [],
          codigoConvite: returnedClass.codigoConvite ?? returnedClass.codigo_convite ?? item.codigoConvite ?? null,
        } : item
      )));

      return { ...classes.find((item) => item.id === classId), id: classId, name, subject, period };
    } catch (error) {
      setClassesError(error.message);
      throw error;
    }
  }, [classes]);

  const regenerateInviteCode = useCallback(async (id) => {
    setClassesError('');
    try {
      const updatedClass = await apiRequest(`/turmas/${id}/codigo-convite/regenerar`, {
        method: 'POST',
      });
      const normalized = normalizeClass(updatedClass);
      setClasses((previous) => previous.map((item) => (
        item.id === Number(id) ? normalized : item
      )));
      return normalized;
    } catch (error) {
      setClassesError(error.message);
      throw error;
    }
  }, []);

  const archiveClass = useCallback(async (id) => {
    setClassesError('');
    try {
      const archivedClass = await apiRequest(`/turmas/${id}/arquivar`, { method: 'PATCH' });
      const normalized = normalizeClass(archivedClass);
      setClasses((previous) => previous.map((item) => (
        item.id === Number(id) ? normalized : item
      )));
      return normalized;
    } catch (error) {
      setClassesError(error.message);
      throw error;
    }
  }, []);

  const enrollStudent = useCallback(async (classId, student) => {
    setClassesError('');
    const name = student?.name?.trim();
    const email = student?.email?.trim().toLowerCase();
    const registration = student?.registration?.trim() || null;

    if (!name) throw new Error('Informe o nome do aluno.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Informe um e-mail válido.');
    }

    const cls = classes.find((item) => item.id === Number(classId));
    if (!cls) throw new Error('Turma não encontrada.');
    if (cls.status === 'Arquivada') {
      throw new Error('Não é possível matricular alunos em uma turma arquivada.');
    }

    try {
      const createdStudent = await apiRequest(`/turmas/${classId}/matriculas`, {
        method: 'POST',
        body: JSON.stringify({ nome: name, email, numero_matricula: registration }),
      });

      setClasses((previous) => previous.map((item) => {
        if (item.id !== Number(classId)) return item;
        const alreadyAdded = item.students.some((existing) => Number(existing.id) === Number(createdStudent.id));
        if (alreadyAdded) return item;
        return {
          ...item,
          students: [...item.students, {
            id: Number(createdStudent.id),
            name: createdStudent.name ?? createdStudent.nome,
            email: createdStudent.email,
            registration: createdStudent.registration ?? createdStudent.numero_matricula ?? null,
          }],
        };
      }));
      return createdStudent;
    } catch (error) {
      setClassesError(error.message);
      throw error;
    }
  }, [classes]);

  const addExam = useCallback(async (exam) => {
    const created = await apiRequest('/provas', {
      method: 'POST',
      body: JSON.stringify({ title: exam.title, description: exam.description, questions: exam.questions }),
    });
    const saved = normalizeExam(created);
    setExams((previous) => [...previous.filter((item) => item.id !== saved.id), saved]);
    return saved;
  }, []);

  const updateExam = useCallback(async (id, exam) => {
    const updated = await apiRequest(`/provas/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: exam.title, description: exam.description, questions: exam.questions }),
    });
    const saved = normalizeExam(updated);
    setExams((previous) => previous.map((item) => item.id === saved.id ? saved : item));
    return saved;
  }, []);

  const syncExamStatus = useCallback((examId, status) => {
    if (!status) return;
    setExams((previous) => previous.map((exam) => (
      exam.id === Number(examId) ? { ...exam, status } : exam
    )));
  }, []);

  const createApplication = useCallback(async ({ examId, classId, quantity }) => {
    const created = await apiRequest('/aplicacoes', {
      method: 'POST',
      body: JSON.stringify({ examId, classId, quantity }),
    });
    const saved = normalizeApplication(created);
    setApplications((previous) => [...previous.filter((item) => item.id !== saved.id), saved]);
    syncExamStatus(saved.examId, created.examStatus);
    return saved.id;
  }, [syncExamStatus]);

  const updateApplication = useCallback(async (id, patch) => {
    const target = applications.find((item) => item.id === Number(id));
    if (!target) return;

    const previousValues = Object.fromEntries(Object.keys(patch).map((key) => [key, target[key]]));
    setApplicationsError('');
    setApplications((previous) => previous.map((item) => (
      item.id === target.id ? { ...item, ...patch } : item
    )));

    try {
      await apiRequest(`/aplicacoes/${target.id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    } catch (error) {
      setApplications((previous) => previous.map((item) => (
        item.id === target.id ? { ...item, ...previousValues } : item
      )));
      setApplicationsError(error.message);
      throw error;
    }
  }, [applications]);

  const confirmApplicationDownload = useCallback(async (id) => {
    const updated = await apiRequest(`/aplicacoes/${Number(id)}/aplicar`, { method: 'POST' });
    setApplications((previous) => previous.map((item) => (
      item.id === Number(id) ? normalizeApplication(updated, item.copies || []) : item
    )));
  }, []);

  const replaceApplicationCopies = useCallback((applicationId, copies) => {
    setApplications((previous) => previous.map((item) => (
      item.id === Number(applicationId)
        ? { ...item, copies, quantity: copies.length || item.quantity }
        : item
    )));
  }, []);

  const generateApplicationCopies = useCallback(async (applicationId) => {
    const copies = await apiRequest(`/aplicacoes/${Number(applicationId)}/copias`, { method: 'POST' });
    if (!Array.isArray(copies)) throw new Error('A API retornou uma lista de cópias inválida.');
    replaceApplicationCopies(applicationId, copies);
    return copies;
  }, [replaceApplicationCopies]);

  const publishAnswerKey = useCallback(async (applicationId, code) => {
    const copies = await apiRequest(`/aplicacoes/${Number(applicationId)}/copias/gabarito`, {
      method: 'POST',
      body: JSON.stringify(code === 'all' ? {} : { code }),
    });
    if (!Array.isArray(copies)) throw new Error('A API retornou uma lista de cópias inválida.');
    replaceApplicationCopies(applicationId, copies);
    return copies;
  }, [replaceApplicationCopies]);

  const findCopyByCode = useCallback((code) => {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return null;
    for (const application of applications) {
      const copy = (application.copies || []).find((item) => item.code === normalized);
      if (copy) return { application, copy };
    }
    return null;
  }, [applications]);

  const classStudents = useCallback(
    (classId) => classes.find((item) => item.id === Number(classId))?.students || [],
    [classes],
  );

  const getClassById = useCallback((id) => classes.find((item) => item.id === Number(id)), [classes]);
  const getExamById = useCallback((id) => exams.find((item) => item.id === Number(id)), [exams]);
  const getApplicationById = useCallback((id) => applications.find((item) => item.id === Number(id)), [applications]);
  const getQuestionById = useCallback((id) => questions.find((item) => item.id === Number(id)), [questions]);

  const examQuestionsDetailed = useCallback((examId) => {
    const exam = getExamById(examId);
    if (!exam) return [];
    return exam.questions
      .map(({ questionId, score }) => {
        const question = getQuestionById(questionId);
        return question ? { ...question, score } : null;
      })
      .filter(Boolean);
  }, [getExamById, getQuestionById]);

  const classApplications = useCallback(
    (classId) => applications.filter((application) => application.classId === Number(classId)),
    [applications],
  );

  const selectableClasses = useMemo(() => classes.filter((item) => item.status !== 'Arquivada'), [classes]);
  const selectableExams = useMemo(() => exams.filter((item) => item.status !== 'Arquivada'), [exams]);

  const value = useMemo(() => ({
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
    regenerateInviteCode,
    enrollStudent,
    addExam,
    updateExam,
    createApplication,
    updateApplication,
    confirmApplicationDownload,
    generateApplicationCopies,
    publishAnswerKey,
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
  }), [
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
    regenerateInviteCode,
    enrollStudent,
    addExam,
    updateExam,
    createApplication,
    updateApplication,
    confirmApplicationDownload,
    generateApplicationCopies,
    publishAnswerKey,
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
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}

export { DataProvider };
