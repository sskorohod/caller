'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User { id: string; email: string; }
interface Workspace { id: string; name: string; plan?: string; role?: string; }

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User, workspace?: Workspace, redirectTo?: string) => void;
  logout: () => void;
  setWorkspace: (w: Workspace) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspaceState] = useState<Workspace | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem('caller_token');
    const u = localStorage.getItem('caller_user');
    const w = localStorage.getItem('caller_workspace');
    if (t && u) {
      setToken(t);
      setUser(JSON.parse(u));
      if (w) setWorkspaceState(JSON.parse(w));
      // Sync cookie if token exists in localStorage but not in cookie
      if (!document.cookie.includes('caller_token=')) {
        document.cookie = `caller_token=${encodeURIComponent(t)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((t: string, u: User, w?: Workspace, redirectTo?: string) => {
    localStorage.setItem('caller_token', t);
    localStorage.setItem('caller_user', JSON.stringify(u));
    if (w) localStorage.setItem('caller_workspace', JSON.stringify(w));
    // Set cookie so Next.js middleware can read the token server-side
    document.cookie = `caller_token=${encodeURIComponent(t)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    setToken(t);
    setUser(u);
    if (w) setWorkspaceState(w);
    router.push(redirectTo ?? '/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('caller_token');
    localStorage.removeItem('caller_user');
    localStorage.removeItem('caller_workspace');
    // Clear the auth cookie
    document.cookie = 'caller_token=; path=/; max-age=0';
    setToken(null);
    setUser(null);
    setWorkspaceState(null);
    router.push('/login');
  }, [router]);

  const setWorkspace = useCallback((w: Workspace) => {
    localStorage.setItem('caller_workspace', JSON.stringify(w));
    setWorkspaceState(w);
  }, []);

  return (
    <AuthContext.Provider value={{ user, workspace, token, isLoading, login, logout, setWorkspace }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
