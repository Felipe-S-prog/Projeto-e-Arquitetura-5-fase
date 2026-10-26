import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import QuestionsList from './pages/QuestionsList';
import QuestionNew from './pages/QuestionNew';
import ClassesList from './pages/ClassesList';
import ClassNew from './pages/ClassNew';
import ClassDetail from './pages/ClassDetail';
import ExamsList from './pages/ExamsList';
import ExamNew from './pages/ExamNew';
import ExamDetail from './pages/ExamDetail';
import ApplicationsList from './pages/ApplicationsList';
import ApplicationNew from './pages/ApplicationNew';
import ApplicationDetail from './pages/ApplicationDetail';
import PdfConfig from './pages/PdfConfig';
import PdfPreview from './pages/PdfPreview';
import PdfTest from './pages/PdfTest';
import AnswerKey from './pages/AnswerKey';
import PublicAnswerKey from './pages/PublicAnswerKey';
import QrReaderTest from './pages/QrReaderTest';
import Admin from './pages/Admin';
import Grading from './pages/Grading';
import GradeReports from './pages/GradeReports';
import StudentHistory from './pages/StudentHistory';
import ClassEdit from './pages/ClassEdit';

function LoadingScreen() {
  return <div style={{ padding: 32, color: 'var(--muted)' }}>Verificando sessão...</div>;
}

function RequireRole({ role, children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) {
    return <Navigate to={user?.role === 'ADMINISTRADOR' ? '/admin' : '/questoes'} replace />;
  }
  return children;
}

function AppRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const homePath = user?.role === 'ADMINISTRADOR' ? '/admin' : '/questoes';

  return (
    <Routes>
      <Route path="/login" element={isLoading ? <LoadingScreen /> : isAuthenticated ? <Navigate to={homePath} replace /> : <Login />} />
      <Route path="/gabarito" element={<PublicAnswerKey />} />
      <Route path="/admin" element={<RequireRole role="ADMINISTRADOR"><AppLayout /></RequireRole>}>
        <Route index element={<Admin />} />
      </Route>
      <Route path="/" element={<RequireRole role="PROFESSOR"><AppLayout /></RequireRole>}>
        <Route index element={<Navigate to="/questoes" replace />} />
        <Route path="questoes" element={<QuestionsList />} />
        <Route path="questoes/nova" element={<QuestionNew />} />
        <Route path="turmas" element={<ClassesList />} />
        <Route path="turmas/nova" element={<ClassNew />} />
        <Route path="turmas/:id/editar" element={<ClassEdit />} />
        <Route path="turmas/:id" element={<ClassDetail />} />
        <Route path="provas" element={<ExamsList />} />
        <Route path="provas/nova" element={<ExamNew />} />
        <Route path="provas/:id" element={<ExamDetail />} />
        <Route path="aplicacoes" element={<ApplicationsList />} />
        <Route path="aplicacoes/nova" element={<ApplicationNew />} />
        <Route path="aplicacoes/:id" element={<ApplicationDetail />} />
        <Route path="aplicacoes/:id/pdf" element={<PdfConfig />} />
        <Route path="aplicacoes/:id/pdf/preview" element={<PdfPreview />} />
        <Route path="aplicacoes/:id/pdf/teste" element={<PdfTest />} />
        <Route path="aplicacoes/:id/gabarito" element={<AnswerKey />} />
        <Route path="leitor-qr" element={<QrReaderTest />} />
        <Route path="correcao" element={<Grading />} />
        <Route path="relatorios" element={<GradeReports />} />
        <Route path="relatorios/alunos/:id" element={<StudentHistory />} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? homePath : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppRoutes />
      </DataProvider>
    </AuthProvider>
  );
}
