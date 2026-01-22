import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store';

type Props = {
  children: JSX.Element;
  roles?: Array<'admin' | 'teacher' | 'student'>;
};

export default function ProtectedRoute({ children, roles }: Props) {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
