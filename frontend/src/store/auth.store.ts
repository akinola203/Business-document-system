import { create } from 'zustand';
import { AuthUser } from '../types';

export function checkIsAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  const role = (user.role || user.roleName || '').toUpperCase();
  if (role === 'ADMIN' || role === 'ADMINISTRATOR' || role === 'OWNER') return true;
  const perms = user.permissions || [];
  return (
    perms.includes('*:*') ||
    perms.includes('admin:*') ||
    perms.includes('users:manage')
  );
}

export function checkIsManager(user: AuthUser | null): boolean {
  if (!user) return false;
  if (checkIsAdmin(user)) return true;
  const role = (user.role || user.roleName || '').toUpperCase();
  if (role === 'MANAGER') return true;
  const perms = user.permissions || [];
  return (
    perms.includes('invoice:approve') ||
    perms.includes('waybill:approve') ||
    perms.includes('letter:approve')
  );
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  login: (tokens: { accessToken: string; refreshToken: string }, user: AuthUser) => void;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasRole: (roleName: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Initialize state from localStorage
  const savedUser = localStorage.getItem('aoa_user');
  const savedAccess = localStorage.getItem('aoa_access_token');
  const savedRefresh = localStorage.getItem('aoa_refresh_token');

  let initialUser: AuthUser | null = null;
  if (savedUser) {
    try {
      initialUser = JSON.parse(savedUser);
    } catch {
      localStorage.removeItem('aoa_user');
    }
  }

  return {
    user: initialUser,
    accessToken: savedAccess,
    refreshToken: savedRefresh,
    isAuthenticated: !!savedAccess && !!initialUser,
    isLoading: false,
    isAdmin: checkIsAdmin(initialUser),
    isManager: checkIsManager(initialUser),

    login: (tokens, user) => {
      localStorage.setItem('aoa_access_token', tokens.accessToken);
      localStorage.setItem('aoa_refresh_token', tokens.refreshToken);
      localStorage.setItem('aoa_user', JSON.stringify(user));

      set({
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isAuthenticated: true,
        isAdmin: checkIsAdmin(user),
        isManager: checkIsManager(user),
      });
    },

    logout: () => {
      localStorage.removeItem('aoa_access_token');
      localStorage.removeItem('aoa_refresh_token');
      localStorage.removeItem('aoa_user');

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isAdmin: false,
        isManager: false,
      });
    },

    updateUser: (partial) => {
      const current = get().user;
      if (!current) return;
      const updated = { ...current, ...partial };
      localStorage.setItem('aoa_user', JSON.stringify(updated));
      set({
        user: updated,
        isAdmin: checkIsAdmin(updated),
        isManager: checkIsManager(updated),
      });
    },

    hasPermission: (permission: string) => {
      const user = get().user;
      if (!user) return false;

      // Admin role has unrestricted global privileges
      if (checkIsAdmin(user)) return true;

      const perms = user.permissions || [];
      if (perms.includes('*:*')) return true;
      if (perms.includes(permission)) return true;

      // Handle domain wildcards e.g. "invoice:*"
      const [domain] = permission.split(':');
      if (domain && perms.includes(`${domain}:*`)) return true;

      return false;
    },

    hasAnyPermission: (permissions: string[]) => {
      const user = get().user;
      if (!user) return false;
      if (checkIsAdmin(user)) return true;
      return permissions.some((p) => get().hasPermission(p));
    },

    hasRole: (roleName: string) => {
      const user = get().user;
      if (!user) return false;
      const target = roleName.toUpperCase();
      const currentRole = (user.role || '').toUpperCase();
      const currentRoleName = (user.roleName || '').toUpperCase();
      return currentRole === target || currentRoleName === target;
    },
  };
});
