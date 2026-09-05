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
import Admin from './pages/Admin';

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/questoes" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/questoes" replace />} />
        <Route path="questoes" element={<QuestionsList />} />
        <Route path="questoes/nova" element={<QuestionNew />} />
        <Route path="turmas" element={<ClassesList />} />
        <Route path="turmas/nova" element={<ClassNew />} />
        <Route path="turmas/:id" element={<ClassDetail />} />
        <Route path="provas" element={<ExamsList />} />
        <Route path="provas/nova" element={<ExamNew />} />
        <Route path="provas/:id" element={<ExamDetail />} />
        <Route path="aplicacoes" element={<ApplicationsList />} />
        <Route path="aplicacoes/nova" element={<ApplicationNew />} />
        <Route path="aplicacoes/:id" element={<ApplicationDetail />} />
        <Route path="aplicacoes/:id/pdf" element={<PdfConfig />} />
        <Route path="aplicacoes/:id/pdf/preview" element={<PdfPreview />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
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
