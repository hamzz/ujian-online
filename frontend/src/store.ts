import { create } from 'zustand';

type User = {
  id: string;
  username: string;
  email?: string | null;
  role: 'admin' | 'teacher' | 'student';
};

type AuthState = {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
};

const getInitialAuth = (): { user: User | null; token: string | null } => {
  try {
    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    if (!token || !userRaw) return { user: null, token: null };
    return { token, user: JSON.parse(userRaw) as User };
  } catch {
    return { user: null, token: null };
  }
};

export const useAuthStore = create<AuthState>((set) => {
  const initial = getInitialAuth();
  return {
    user: initial.user,
    token: initial.token,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  }
  };
});

export const hydrateAuth = () => {
  const token = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');
  if (!token || !userRaw) return null;
  return { token, user: JSON.parse(userRaw) as User };
};
