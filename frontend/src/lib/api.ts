import axios from 'axios';
import type { User, Voice, SynthesisLog, AppSetting } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加 token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { username, password });
    return data;
  },
  me: async (): Promise<User> => {
    const { data } = await api.get('/api/auth/me');
    return data;
  },
  logout: async () => {
    await api.post('/api/auth/logout');
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const { data } = await api.put('/api/auth/password', { currentPassword, newPassword });
    return data;
  },
};

// Voice API
export const voiceApi = {
  getAll: async (filters?: { type?: string; isActive?: boolean }): Promise<Voice[]> => {
    const { data } = await api.get('/api/voices', { params: filters });
    return data;
  },
  getById: async (id: string): Promise<Voice> => {
    const { data } = await api.get(`/api/voices/${id}`);
    return data;
  },
  create: async (voice: Partial<Voice>): Promise<Voice> => {
    const { data } = await api.post('/api/voices', voice);
    return data;
  },
  update: async (id: string, voice: Partial<Voice>): Promise<Voice> => {
    const { data } = await api.put(`/api/voices/${id}`, voice);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/api/voices/${id}`);
  },
  getBuiltin: async (): Promise<Voice[]> => {
    const { data } = await api.get('/api/voices/builtin');
    return data;
  },
  previewCustom: async (params: {
    description: string;
    previewText: string;
    style?: string;
    format?: string;
    optimizeTextPreview?: boolean;
  }): Promise<Blob> => {
    const { data } = await api.post('/api/voices/custom/preview', params, {
      responseType: 'blob',
    });
    return data;
  },
  createCustom: async (params: {
    displayName: string;
    localName: string;
    description: string;
    previewText: string;
    style?: string;
    format?: string;
    optimizeTextPreview?: boolean;
    sampleAudioBase64?: string;
  }): Promise<Voice & { sampleUrl?: string }> => {
    const { data } = await api.post('/api/voices/custom', params);
    return data;
  },
};

// Synthesis API
export const synthesisApi = {
  synthesize: async (params: {
    text: string;
    voice: string;
    model?: string;
    format?: string;
    style?: string;
    speed?: number;
  }): Promise<Blob> => {
    const { data } = await api.post('/api/synthesize', params, {
      responseType: 'blob',
    });
    return data;
  },
  getLogs: async (filters?: {
    success?: boolean;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: SynthesisLog[]; total: number }> => {
    const { data } = await api.get('/api/logs', { params: filters });
    return data;
  },
  getStats: async (): Promise<{
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  }> => {
    const { data } = await api.get('/api/logs/stats');
    return data;
  },
};

// Settings API
export const settingsApi = {
  getAll: async (): Promise<AppSetting[]> => {
    const { data } = await api.get('/api/settings');
    return data;
  },
  update: async (settings: Record<string, string>) => {
    const { data } = await api.put('/api/settings', settings);
    return data;
  },
  regenerateToken: async (): Promise<{ token: string }> => {
    const { data } = await api.post('/api/settings/regenerate-token');
    return data;
  },
  getProxyToken: async (): Promise<{ token: string; configured: boolean }> => {
    const { data } = await api.get('/api/settings/proxy-token');
    return data;
  },
  clearToken: async (): Promise<{ message: string }> => {
    const { data } = await api.post('/api/settings/clear-token');
    return data;
  },
};

export default api;
