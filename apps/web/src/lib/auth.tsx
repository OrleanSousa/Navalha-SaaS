import { createContext, useContext, useEffect, useState } from 'react';
import { api, setAccessToken } from './api';
import type { PermissionKey } from './permissions';
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  barbershop?: string;
  permissions: string[];
};
type AuthValue = {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  can(permission: PermissionKey): boolean;
};
const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .post('/auth/refresh')
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        setUser(data.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    const expired = () => setUser(null);
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }
  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }
  function can(permission: PermissionKey) {
    return Boolean(user?.permissions?.includes(permission));
  }
  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider ausente');
  return value;
}
