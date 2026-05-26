import axios from 'axios';
import type {
  User,
  Voice,
  SynthesisLog,
  AppSetting,
  LogStats,
  TimeseriesResponse,
  ErrorDistributionResponse,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') ?? sessionStorage.getItem('token');
};

export const setToken = (token: string, remember: boolean) => {
  if (typeof window === 'undefined') return;
  // 切换存储位置时先清掉另一处，避免残留
  if (remember) {
    sessionStorage.removeItem('token');
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
    sessionStorage.setItem('token', token);
  }
};

export const clearToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  sessionStorage.removeItem('token');
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：添加 token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        clearToken();
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (username: string, password: string, rememberMe: boolean = true) => {
    const { data } = await api.post('/api/auth/login', { username, password, rememberMe });
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
  previewStyled: async (params: {
    baseVoiceLocalName: string;
    style: string;
    previewText: string;
    format?: string;
  }): Promise<Blob> => {
    const { data } = await api.post('/api/voices/styled/preview', params, {
      responseType: 'blob',
    });
    return data;
  },
  createStyled: async (params: {
    displayName: string;
    localName: string;
    baseVoiceLocalName: string;
    style: string;
    previewText: string;
    format?: string;
    sampleAudioBase64?: string;
  }): Promise<Voice & { sampleUrl?: string }> => {
    const { data } = await api.post('/api/voices/styled', params);
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
    endpoint?: string;
    errorCode?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: SynthesisLog[]; total: number }> => {
    const params: Record<string, any> = {};
    if (filters?.success !== undefined) params.success = String(filters.success);
    if (filters?.endpoint) params.endpoint = filters.endpoint;
    if (filters?.errorCode) params.errorCode = filters.errorCode;
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.limit !== undefined) params.limit = filters.limit;
    if (filters?.offset !== undefined) params.offset = filters.offset;
    const { data } = await api.get('/api/logs', { params });
    return data;
  },
  getStats: async (): Promise<LogStats> => {
    const { data } = await api.get('/api/logs/stats');
    return data;
  },
  getTimeseries: async (range: 'hour' | 'day' = 'hour'): Promise<TimeseriesResponse> => {
    const { data } = await api.get('/api/logs/timeseries', { params: { range } });
    return data;
  },
  getErrors: async (range: 'hour' | 'day' | 'all' = 'day'): Promise<ErrorDistributionResponse> => {
    const { data } = await api.get('/api/logs/errors', { params: { range } });
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
