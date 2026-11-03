import axios, { InternalAxiosRequestConfig } from 'axios';
import { handleMockApiRequest } from '../mock/mock-api-handler';

export const API_BASE_URL = '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
  adapter: async (config) => {
    return handleMockApiRequest(config as InternalAxiosRequestConfig);
  },
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
  sessionStorage.removeItem('aoa_access_token');
  sessionStorage.removeItem('aoa_refresh_token');
  sessionStorage.removeItem('aoa_user');
};

// Request interceptor: Attach access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('aoa_access_token') || sessionStorage.getItem('aoa_access_token') || 'portfolio-demo-jwt-token-active';
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);
