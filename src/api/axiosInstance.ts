// src/api/axiosInstance.ts
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

const LOGIN_ENDPOINTS = ['/admin/login', '/auth/login'];

// Send an expired session back to the login page that matches its role
function loginPathForStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    const role = raw ? JSON.parse(raw)?.role : null;
    return role === 'admin' ? '/admin/login' : '/login';
  } catch {
    return '/login';
  }
}

// If token is invalid/expired, clear it and bounce to login
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? '';
    const isLoginCall = LOGIN_ENDPOINTS.some((p) => url.includes(p));
    if (error.response?.status === 401 && !isLoginCall) {
      const target = loginPathForStoredUser();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = target;
    }
    return Promise.reject(error);
  }
);

export default api;