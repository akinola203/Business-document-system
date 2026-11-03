import { create } from 'zustand';
import { AuthUser } from '../types';

export const DEMO_PORTFOLIO_USER: AuthUser = {
  id: 'usr-portfolio-admin',
  email: 'executive@aoa77.com',
  fullName: 'Akinola Akinlade',
  role: 'ADMIN',
  roleName: 'Executive Director / Admin',
  permissions: ['*:*'],
  companyId: 'c0000000-0000-0000-0000-000000000001',
  companyName: 'AOA 77 COMPANY LTD',
};

export function checkIsAdmin(_user: AuthUser | null): boolean {
  return true;
}

export function checkIsManager(_user: AuthUser | null): boolean {
  return true;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  login: (tokens: { accessToken: string; refreshToken?: string }, user: AuthUser, rememberMe?: boolean) => void;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (roleName: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const savedUser = localStorage.getItem('aoa_user') || sessionStorage.getItem('aoa_user');
  let initialUser: AuthUser = DEMO_PORTFOLIO_USER;

  if (savedUser) {
    try {
      initialUser = JSON.parse(savedUser);
    } catch {
      initialUser = DEMO_PORTFOLIO_USER;
    }
  }

  return {
    user: initialUser,
    accessToken: 'portfolio-demo-jwt-token-active',
    refreshToken: null,
    isAuthenticated: true,
    isLoading: false,
    isAdmin: true,
    isManager: true,

    login: (_tokens, user) => {
      localStorage.setItem('aoa_user', JSON.stringify(user));
      set({
        user,
        accessToken: 'portfolio-demo-jwt-token-active',
        refreshToken: null,
        isAuthenticated: true,
        isAdmin: true,
        isManager: true,
      });
    },

    logout: () => {
      set({
        user: DEMO_PORTFOLIO_USER,
        accessToken: 'portfolio-demo-jwt-token-active',
        refreshToken: null,
        isAuthenticated: true,
        isAdmin: true,
        isManager: true,
      });
    },

    updateUser: (partial) => {
      const current = get().user || DEMO_PORTFOLIO_USER;
      const updated = { ...current, ...partial };
      localStorage.setItem('aoa_user', JSON.stringify(updated));
      set({
        user: updated,
        isAdmin: true,
        isManager: true,
      });
    },

    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasRole: () => true,
  };
});
