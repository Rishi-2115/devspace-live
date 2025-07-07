import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

class ApiService {
  private instance: AxiosInstance;
  private baseURL: string;
  public defaults: { baseURL: string }; // Add this for dockerApi.ts compatibility

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
    this.defaults = { baseURL: this.baseURL }; // Initialize defaults
    
    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Add auth token if available
        const token = localStorage.getItem('authToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request timestamp (as custom property)
        (config as any).startTime = new Date();
        
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log response time
        const endTime = new Date();
        const startTime = (response.config as any).startTime;
        if (startTime) {
          const duration = endTime.getTime() - startTime.getTime();
          console.log(`API Request to ${response.config.url} took ${duration}ms`);
        }
        
        return response;
      },
      (error: any) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          localStorage.removeItem('authToken');
          // Only redirect to login if not on a code execution request
          if (!error.config?.url?.includes('/execute')) {
            window.location.href = '/login';
          }
        }

        if (error.response?.status === 429) {
          // Handle rate limiting
          console.warn('Rate limit exceeded');
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic request methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post(url, data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.put(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.patch(url, data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.delete(url, config);
  }

  // Virtual Lab specific methods
  async createVirtualLab(config: any) {
    return this.post('/virtual-lab/create', config);
  }

  async getVirtualLab(labId: string) {
    return this.get(`/virtual-lab/${labId}`);
  }

  async startVirtualLab(labId: string) {
    return this.post(`/virtual-lab/${labId}/start`);
  }

  async stopVirtualLab(labId: string) {
    return this.post(`/virtual-lab/${labId}/stop`);
  }

  async getFileTree(labId: string) {
    return this.get(`/virtual-lab/${labId}/files`);
  }

  async createFile(labId: string, path: string, content: string) {
    return this.post(`/virtual-lab/${labId}/files`, { path, content });
  }

  async updateFile(labId: string, path: string, content: string) {
    return this.put(`/virtual-lab/${labId}/files`, { path, content });
  }

  async deleteFile(labId: string, path: string) {
    return this.delete(`/virtual-lab/${labId}/files`, { data: { path } });
  }

  async executeCode(labId: string, code: string, language: string) {
    return this.post(`/virtual-lab/${labId}/execute`, { code, language });
  }

  // Authentication methods
  async login(credentials: { email: string; password: string }) {
    return this.post('/auth/login', credentials);
  }

  async register(userData: { name: string; email: string; password: string }) {
    return this.post('/auth/register', userData);
  }

  async logout() {
    return this.post('/auth/logout');
  }

  async refreshToken() {
    return this.post('/auth/refresh');
  }

  // File upload with progress
  async uploadFile(labId: string, file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append('file', file);

    return this.post(`/virtual-lab/${labId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent: any) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      }
    });
  }

  // Download file
  async downloadFile(labId: string, path: string) {
    return this.get(`/virtual-lab/${labId}/download`, {
      params: { path },
      responseType: 'blob'
    });
  }

  // Health check
  async healthCheck() {
    return this.get('/health');
  }

  // Set auth token
  setAuthToken(token: string) {
    localStorage.setItem('authToken', token);
    this.instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Remove auth token
  removeAuthToken() {
    localStorage.removeItem('authToken');
    delete this.instance.defaults.headers.common['Authorization'];
  }
}

export const api = new ApiService();
export default api;
