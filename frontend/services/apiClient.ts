import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.193:3000/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Generate deterministic cache key for API requests
 * Sorts object keys to ensure consistent cache hits regardless of key order
 */
const getCacheKey = (config: AxiosRequestConfig): string => {
  const method = config.method || 'get';
  const url = config.url || '';
  
  const sortedParams = config.params 
    ? JSON.stringify(config.params, Object.keys(config.params).sort())
    : '';
  
  const sortedData = config.data
    ? JSON.stringify(config.data, Object.keys(config.data).sort())
    : '';
  
  return `${method}:${url}:${sortedParams}:${sortedData}`;
};

const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Check cache for GET requests (skip if X-Use-Cache: false header)
    if (config.method === 'get' && config.headers?.['X-Use-Cache'] !== 'false') {
      const cacheKey = getCacheKey(config);
      const cached = requestCache.get(cacheKey);
      
      if (cached && isCacheValid(cached.timestamp)) {
        console.log('📦 Using cached response for:', config.url);
        // Return cached data by rejecting with custom error (caught in response interceptor)
        return Promise.reject({
          config,
          response: { data: cached.data, status: 200, cached: true },
          isCache: true,
        });
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => {
    if (response.config.method === 'get') {
      const cacheKey = getCacheKey(response.config);
      requestCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    }
    return response;
  },
  async (error) => {
    if (error.isCache) {
      return Promise.resolve(error.response);
    }

    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
    }

    if (!error.response) {
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        originalError: error,
      });
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        message: 'Request timeout. Please try again.',
        originalError: error,
      });
    }

    return Promise.reject(error);
  }
);

export const clearCache = () => {
  requestCache.clear();
  console.log('🗑️ API cache cleared');
};

export const clearCacheEntry = (url: string) => {
  for (const [key] of requestCache) {
    if (key.includes(url)) {
      requestCache.delete(key);
    }
  }
};

export default apiClient;
