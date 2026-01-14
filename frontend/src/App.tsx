import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import { useSchoolStore } from "./store/school";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import ExamStartPage from "./pages/ExamStart";
import ExamSessionPage from "./pages/ExamSession";
import ResultPage from "./pages/Result";
import TeacherPage from "./pages/Teacher";
import AdminUsersPage from "./pages/AdminUsers";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({
  children,
  roles
}: {
  children: JSX.Element;
  roles: Array<"admin" | "teacher" | "student">;
}) {
  const user = useAuthStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const loadSchool = useSchoolStore((state) => state.load);

  useEffect(() => {
    loadSchool().catch(() => undefined);
  }, [loadSchool]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam/start"
        element={
          <ProtectedRoute>
            <ExamStartPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam/session/:sessionId"
        element={
          <ProtectedRoute>
            <ExamSessionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam/result/:sessionId"
        element={
          <ProtectedRoute>
            <ResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <RoleRoute roles={["teacher", "admin"]}>
            <TeacherPage />
          </RoleRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RoleRoute roles={["admin"]}>
            <AdminUsersPage />
          </RoleRoute>
        }
      />
    </Routes>
  );
}
