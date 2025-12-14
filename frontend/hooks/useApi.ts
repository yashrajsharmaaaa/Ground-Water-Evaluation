import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';
import { AxiosRequestConfig } from 'axios';

interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: any;
  execute: (config?: AxiosRequestConfig) => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for API calls with loading and error states
 */
export function useApi<T = any>(
  config: AxiosRequestConfig,
  options: UseApiOptions = {}
): UseApiReturn<T> {
  const { immediate = false, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const execute = useCallback(async (overrideConfig?: AxiosRequestConfig) => {
    try {
      setLoading(true);
      setError(null);
      
      const finalConfig = { ...config, ...overrideConfig };
      const response = await apiClient.request<T>(finalConfig);
      
      setData(response.data);
      onSuccess?.(response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'An error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [config, onSuccess, onError]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate]);

  return { data, loading, error, execute, reset };
}
