import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const rawEnvUrl = import.meta.env.VITE_API_URL?.trim();
const API_BASE_URL = rawEnvUrl
  ? (rawEnvUrl.endsWith('/api/v1') ? rawEnvUrl : `${rawEnvUrl.replace(/\/+$/, '')}/api/v1`)
  : '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Purges all stale auth tokens and user records from storage
 */
export const clearAuthState = () => {
  localStorage.removeItem('aoa_access_token');
  localStorage.removeItem('aoa_refresh_token');
  localStorage.removeItem('aoa_user');
};

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

// Shared single-flight refresh promise to prevent concurrent refreshes
let refreshPromise: Promise<string> | null = null;

// Response interceptor: Handle 401 with single-flight token rotation via httpOnly cookie
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      const url = originalRequest.url || '';
      // Skip refresh for login and refresh endpoints to prevent infinite loops
      if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = axios
          .post(
            `${API_BASE_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          )
          .then((res) => {
            const payload = res.data?.data || res.data;
            const newAccessToken = payload?.accessToken;
            if (!newAccessToken) {
              throw new Error('No access token returned from refresh endpoint');
            }
            localStorage.setItem('aoa_access_token', newAccessToken);
            apiClient.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
            return newAccessToken;
          })
          .catch((refreshErr) => {
            clearAuthState();
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            throw refreshErr;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const token = await refreshPromise;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return apiClient(originalRequest);
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  },
);
