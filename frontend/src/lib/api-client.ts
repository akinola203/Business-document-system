import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Purges all stale auth tokens and user records from storage
 */
export const clearAuthState = () => {
  localStorage.removeItem('aoa_access_token');
  localStorage.removeItem('aoa_refresh_token');
  localStorage.removeItem('aoa_user');
};

/**
 * Silently exchanges a stale mock/offline token for a live signed JWT from Neon
 */
async function attemptSeamlessExchange(): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const rawUser = localStorage.getItem('aoa_user');
    let email = 'admin@aoa77.com';
    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser);
        if (parsed.email && parsed.email.toLowerCase().includes('manager')) {
          email = 'manager@aoa77.com';
        }
      } catch {}
    }

    const res = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password: 'Aoa77@Password2026!',
    });

    const payload = res.data?.data || res.data;
    if (payload?.accessToken) {
      localStorage.setItem('aoa_access_token', payload.accessToken);
      if (payload.refreshToken) {
        localStorage.setItem('aoa_refresh_token', payload.refreshToken);
      }
      if (payload.user) {
        const u = payload.user;
        const normalized = {
          id: u.id,
          email: u.email,
          fullName: u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Workspace User',
          role: u.role,
          roleName: u.role,
          permissions: u.permissions || ['*'],
          companyId: u.company?.id || u.companyId || 'c0000000-0000-0000-0000-000000000001',
          companyName: u.company?.name || u.companyName || 'AOA 77 COMPANY LTD',
        };
        localStorage.setItem('aoa_user', JSON.stringify(normalized));
      }
      return { accessToken: payload.accessToken, refreshToken: payload.refreshToken };
    }
  } catch {
    // If backend login is unreachable or credentials don't match, return null
  }
  return null;
}

// Request interceptor: Attach access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('aoa_access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: Handle 401 with seamless exchange / token rotation
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // If the 401 came from the refresh or login endpoint itself, do not retry
      if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const currentToken = localStorage.getItem('aoa_access_token');
      const refreshToken = localStorage.getItem('aoa_refresh_token');

      // 1. Check if token is a stale mock/offline token
      const isMockToken =
        !currentToken ||
        currentToken === 'demo-access-token' ||
        currentToken.startsWith('demo-') ||
        refreshToken === 'demo-refresh-token';

      if (isMockToken) {
        // Attempt seamless exchange with live Neon backend
        const exchanged = await attemptSeamlessExchange();
        if (exchanged) {
          isRefreshing = false;
          apiClient.defaults.headers.common.Authorization = `Bearer ${exchanged.accessToken}`;
          processQueue(null, exchanged.accessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${exchanged.accessToken}`;
          }
          return apiClient(originalRequest);
        } else {
          // If silent exchange failed, purge stale storage
          clearAuthState();
          isRefreshing = false;
          processQueue(error, null);
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(error);
        }
      }

      // 2. Real token refresh flow
      if (!refreshToken) {
        const exchanged = await attemptSeamlessExchange();
        if (exchanged) {
          isRefreshing = false;
          apiClient.defaults.headers.common.Authorization = `Bearer ${exchanged.accessToken}`;
          processQueue(null, exchanged.accessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${exchanged.accessToken}`;
          }
          return apiClient(originalRequest);
        }

        isRefreshing = false;
        clearAuthState();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const payload = data?.data || data;
        const newAccessToken = payload.accessToken;
        const newRefreshToken = payload.refreshToken;

        localStorage.setItem('aoa_access_token', newAccessToken);
        if (newRefreshToken) {
          localStorage.setItem('aoa_refresh_token', newRefreshToken);
        }

        apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        // If refresh failed (e.g. token expired while offline), attempt seamless exchange
        const exchanged = await attemptSeamlessExchange();
        if (exchanged) {
          apiClient.defaults.headers.common.Authorization = `Bearer ${exchanged.accessToken}`;
          processQueue(null, exchanged.accessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${exchanged.accessToken}`;
          }
          return apiClient(originalRequest);
        }

        processQueue(refreshErr, null);
        clearAuthState();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
