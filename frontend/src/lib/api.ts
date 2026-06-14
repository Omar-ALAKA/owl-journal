// lib/api.ts - API Client
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 500) {
      console.error('[API] Server error:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;

export const get = <T>(url: string, params?: object): Promise<T> =>
  api.get<T>(url, { params }).then((r) => r.data);

export const post = <T>(url: string, data?: object): Promise<T> =>
  api.post<T>(url, data).then((r) => r.data);

export const put = <T>(url: string, data?: object): Promise<T> =>
  api.put<T>(url, data).then((r) => r.data);

export const del = <T>(url: string): Promise<T> =>
  api.delete<T>(url).then((r) => r.data);
