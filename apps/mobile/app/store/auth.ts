import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User, AuthTokens } from '@casa/shared';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  setAuth: (user: User, tokens: AuthTokens) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadPersistedAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  isLoading: true,

  setAuth: async (user, tokens) => {
    await SecureStore.setItemAsync('access_token', tokens.accessToken);
    await SecureStore.setItemAsync('refresh_token', tokens.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ user, tokens });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user');
    set({ user: null, tokens: null });
  },

  loadPersistedAuth: async () => {
    try {
      const [userJson, accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync('user'),
        SecureStore.getItemAsync('access_token'),
        SecureStore.getItemAsync('refresh_token'),
      ]);
      if (userJson && accessToken && refreshToken) {
        const user = JSON.parse(userJson) as User;
        set({ user, tokens: { accessToken, refreshToken, expiresIn: 900 } });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
