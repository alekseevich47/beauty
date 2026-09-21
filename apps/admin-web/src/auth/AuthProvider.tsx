import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { api } from '@/lib/api';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';
import type { LoginChallenge, StaffUser } from '@/types/staff';
import type { PermissionCode } from '@beauty/contracts';

type AuthContextValue = {
  user: StaffUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginChallenge>;
  verifyTotp: (challengeId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (code: PermissionCode) => boolean;
  canAny: (codes: readonly PermissionCode[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ['staff-session'],
    queryFn: () => api.session(),
    staleTime: 60_000,
    retry: false,
  });

  const user = sessionQuery.data?.user ?? null;

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
  });

  const totpMutation = useMutation({
    mutationFn: ({ challengeId, code }: { challengeId: string; code: string }) =>
      api.verifyTotp(challengeId, code),
    onSuccess: (data) => {
      qc.setQueryData(['staff-session'], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.logout(),
    onSuccess: () => {
      qc.setQueryData(['staff-session'], null);
      qc.clear();
    },
  });

  const login = useCallback(
    (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    [loginMutation],
  );

  const verifyTotp = useCallback(
    async (challengeId: string, code: string) => {
      await totpMutation.mutateAsync({ challengeId, code });
    },
    [totpMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: sessionQuery.isLoading,
      isAuthenticated: Boolean(user),
      login,
      verifyTotp,
      logout,
      can: (code) => hasPermission(user, code),
      canAny: (codes) => hasAnyPermission(user, codes),
    }),
    [user, sessionQuery.isLoading, login, verifyTotp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
