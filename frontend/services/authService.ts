import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { clearCache } from './apiClient';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  preferences?: {
    language: string;
    notifications: boolean;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
}

class AuthService {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/register', { name, email, password });
    await this.saveToken(response.data.token);
    return response.data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/login', { email, password });
    await this.saveToken(response.data.token);
    return response.data;
  }

  async logout(): Promise<void> {
    await AsyncStorage.removeItem('authToken');
    clearCache();
  }

  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('authToken');
  }

  async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem('authToken', token);
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const token = await this.getToken();
      if (!token) return null;

      const response = await apiClient.get('/auth/me');
      return response.data.user;
    } catch (error) {
      return null;
    }
  }

  async updateProfile(name: string, preferences: any): Promise<User> {
    const response = await apiClient.put('/auth/profile', { name, preferences });
    return response.data.user;
  }


}

export default new AuthService();
