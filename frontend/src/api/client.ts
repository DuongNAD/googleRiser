/**
 * HTTP Client for SME AutoPilot Backend API
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    mode?: 'demo' | 'live';
  };
}

class ApiClient {
  private baseUrl: string = '/api';

  public setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : endpoint.startsWith('/healthz')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        if (!response.ok) {
          return {
            success: false,
            error: {
              code: `HTTP_${response.status}`,
              message: text || `HTTP error ${response.status}`
            }
          };
        }
        try {
          const parsed = JSON.parse(text);
          return { success: true, data: parsed };
        } catch {
          return { success: true, data: text as any };
        }
      }

      const data = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: data.error || {
            code: `HTTP_${response.status}`,
            message: data.message || `HTTP error ${response.status}`
          },
          meta: data.meta
        };
      }

      return data;
    } catch (err: any) {
      console.warn(`[ApiClient] Request to ${url} failed, falling back to client handler:`, err.message);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err.message || 'Không thể kết nối đến máy chủ backend'
        }
      };
    }
  }

  async get<T = any>(endpoint: string, headers?: HeadersInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  async post<T = any>(endpoint: string, body?: any, headers?: HeadersInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers
    });
  }
}

export const apiClient = new ApiClient();
