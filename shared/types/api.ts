export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptimeSeconds: number;
  environment: 'development' | 'production' | 'test';
  timestamp: string;
  services: {
    gemini: 'operational' | 'mock_mode' | 'unreachable';
    sheets: 'operational' | 'mock_mode' | 'unreachable';
    gmail: 'operational' | 'mock_mode' | 'unreachable';
    calendar: 'operational' | 'mock_mode' | 'unreachable';
    maps: 'operational' | 'mock_mode' | 'unreachable';
    firebase: 'operational' | 'in_memory_mock' | 'unreachable';
  };
  mode: 'DEMO' | 'LIVE';
}

export interface SSEEvent<T = any> {
  event: string;
  data: T;
  id?: string;
  retry?: number;
}
