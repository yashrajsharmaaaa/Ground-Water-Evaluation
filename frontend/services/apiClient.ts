import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.193:3000/api';

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request cache
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Generate cache key
const getCacheKey = (config: AxiosRequestConfig): string => {
  return `${config.method}:${config.url}:${JSON.stringify(config.params || {})}:${JSON.stringify(config.data || {})}`;
};

// Check if cache is valid
const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  async (config) => {
    // Add auth token if available
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Check cache for GET requests
    if (config.method === 'get' && config.headers?.['X-Use-Cache'] !== 'false') {
      const cacheKey = getCacheKey(config);
      const cached = requestCache.get(cacheKey);
      
      if (cached && isCacheValid(cached.timestamp)) {
        console.log('📦 Using cached response for:', config.url);
        // Return cached data by throwing a custom error that we'll catch
        return Promise.reject({
          config,
          response: { data: cached.data, status: 200, cached: true },
          isCache: true,
        });
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors and cache
apiClient.interceptors.response.use(
  (response) => {
    // Cache successful GET requests
    if (response.config.method === 'get') {
      const cacheKey = getCacheKey(response.config);
      requestCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });
    }

    return response;
  },
  async (error) => {
    // Handle cached responses
    if (error.isCache) {
      return Promise.resolve(error.response);
    }

    // Handle 401 errors - token expired
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
      // You might want to redirect to login here
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        originalError: error,
      });
    }

    // Handle timeout
    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        message: 'Request timeout. Please try again.',
        originalError: error,
      });
    }

    return Promise.reject(error);
  }
);

// Clear cache
export const clearCache = () => {
  requestCache.clear();
  console.log('🗑️ API cache cleared');
};

// Clear specific cache entry
export const clearCacheEntry = (url: string) => {
  for (const [key] of requestCache) {
    if (key.includes(url)) {
      requestCache.delete(key);
    }
  }
};

export default apiClient;
