import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import Shell from './components/Shell';
import ProtectedRoute from './components/ProtectedRoute';
import { hydrateAuth, useAuthStore } from './store';
import Home from './pages/Home';
import Login from './pages/Login';
import JoinExam from './pages/JoinExam';
import AdminUsers from './pages/AdminUsers';
import AdminStats from './pages/AdminStats';
import AdminConfig from './pages/AdminConfig';
import TeacherQuestions from './pages/TeacherQuestions';
import TeacherExams from './pages/TeacherExams';
import TeacherGrading from './pages/TeacherGrading';
import TeacherResults from './pages/TeacherResults';
import Reports from './pages/Reports';
import Announcements from './pages/Announcements';
import Notifications from './pages/Notifications';
import StudentExams from './pages/StudentExams';
import TakeExam from './pages/TakeExam';
import Results from './pages/Results';

export default function App() {
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const existing = hydrateAuth();
    if (existing) setAuth(existing.user, existing.token);
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/school-profile`)
        .then((res) => res.json())
        .then((data) => {
          const theme = data?.theme_color || 'sekolah';
          document.documentElement.setAttribute('data-theme', theme);
          localStorage.setItem('theme', theme);
        })
        .catch(() => {
          document.documentElement.setAttribute('data-theme', 'sekolah');
        });
    }
  }, [setAuth]);

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/join" element={<JoinExam />} />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/config"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/stats"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminStats />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/questions"
          element={
            <ProtectedRoute roles={['teacher', 'admin']}>
              <TeacherQuestions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/exams"
          element={
            <ProtectedRoute roles={['teacher', 'admin']}>
              <TeacherExams />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/grading"
          element={
            <ProtectedRoute roles={['teacher', 'admin']}>
              <TeacherGrading />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/results"
          element={
            <ProtectedRoute roles={['teacher', 'admin']}>
              <TeacherResults />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute roles={['teacher', 'admin']}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/announcements"
          element={
            <ProtectedRoute roles={['admin', 'teacher', 'student']}>
              <Announcements />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute roles={['admin', 'teacher', 'student']}>
              <Notifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/exams"
          element={
            <ProtectedRoute roles={['student', 'admin']}>
              <StudentExams />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/sessions/:sessionId"
          element={
            <ProtectedRoute roles={['student', 'admin']}>
              <TakeExam />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/sessions/:sessionId/results"
          element={
            <ProtectedRoute roles={['student', 'admin']}>
              <Results />
            </ProtectedRoute>
          }
        />
        <Route path="/public/sessions/:sessionId" element={<TakeExam />} />
        <Route path="/public/sessions/:sessionId/results" element={<Results />} />
      </Routes>
    </Shell>
  );
}
