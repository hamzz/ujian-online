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
  const themeColor = useSchoolStore((state) => state.profile?.themeColor);

  useEffect(() => {
    function hexToRgb(value: string) {
      const normalized = value.replace("#", "").trim();
      if (![3, 6].includes(normalized.length)) return null;
      const hex = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
      const int = Number.parseInt(hex, 16);
      if (Number.isNaN(int)) return null;
      return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255
      };
    }

    function mix(color: { r: number; g: number; b: number }, target: { r: number; g: number; b: number }, amount: number) {
      return {
        r: Math.round(color.r + (target.r - color.r) * amount),
        g: Math.round(color.g + (target.g - color.g) * amount),
        b: Math.round(color.b + (target.b - color.b) * amount)
      };
    }

    const base = hexToRgb(themeColor || "#2563eb");
    if (!base) return;
    const root = document.documentElement;
    const toVar = (color: { r: number; g: number; b: number }) => `${color.r} ${color.g} ${color.b}`;
    root.style.setProperty("--brand-500", toVar(base));
    root.style.setProperty("--brand-600", toVar(mix(base, { r: 0, g: 0, b: 0 }, 0.18)));
    root.style.setProperty("--brand-700", toVar(mix(base, { r: 0, g: 0, b: 0 }, 0.28)));
    root.style.setProperty("--brand-100", toVar(mix(base, { r: 255, g: 255, b: 255 }, 0.78)));
    root.style.setProperty("--brand-50", toVar(mix(base, { r: 255, g: 255, b: 255 }, 0.9)));
  }, [themeColor]);

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
