import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import * as apiClient from '@/lib/api';
import type { TokenResponse, User } from '@/types';

type AuthRole = User['role'];

type AuthState = {
    user: User | null;
    token: string | null;
    role: AuthRole | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    initAuth: () => Promise<void>;
};

type AuthPersistedState = Pick<AuthState, 'token' | 'role'>;

const authStorageKey = 'apex_token';

const clearAuthStorage = () => {
    if (typeof window === 'undefined') {
        return;
    }

    // Clear from localStorage
    window.localStorage.removeItem(authStorageKey);

    // Clear from cookies
    document.cookie = `${authStorageKey}=; path=/; max-age=0`;
};

const setAuthStorage = (token: string | null) => {
    if (typeof window === 'undefined') {
        return;
    }

    if (token) {
        // Save to localStorage
        window.localStorage.setItem(authStorageKey, token);

        // Save to cookie (24 hour expiry)
        document.cookie = `${authStorageKey}=${token}; path=/; max-age=${60 * 60 * 24}`;
        return;
    }

    // Clear both when token is null
    window.localStorage.removeItem(authStorageKey);
    document.cookie = `${authStorageKey}=; path=/; max-age=0`;
};

const initialState = {
    user: null,
    token: null,
    role: null,
    isAuthenticated: false,
    isLoading: false,
};

const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            ...initialState,
            login: async (email: string, password: string) => {
                set({ isLoading: true });

                try {
                    const response = await apiClient.post<TokenResponse>('/auth/login/', {
                        email,
                        password,
                    });

                    const token = response.access_token;
                    const role = response.role as AuthRole;

                    setAuthStorage(token);

                    const meResponse = await apiClient.get<User>('/auth/me/');

                    set({
                        user: meResponse,
                        token,
                        role: meResponse.role,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error) {
                    clearAuthStorage();
                    set({
                        ...initialState,
                        isLoading: false,
                    });
                    throw error;
                }
            },
            logout: () => {
                clearAuthStorage();
                set({
                    ...initialState,
                });
            },
            initAuth: async () => {
                if (typeof window === 'undefined') return;

                const storedToken = window.localStorage.getItem('apex_token');

                if (!storedToken) {
                    set({ ...initialState });
                    return;
                }

                // Don't set isLoading to true here — it causes layout flicker
                set({ token: storedToken });

                try {
                    const meResponse = await apiClient.get<User>('/auth/me/');
                    set({
                        user: meResponse,
                        token: storedToken,
                        role: meResponse.role as AuthRole,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch {
                    // Token invalid or expired — clear silently, do not throw
                    window.localStorage.removeItem('apex_token');
                    document.cookie = 'apex_token=; path=/; max-age=0';
                    set({ ...initialState });
                    // Do NOT throw — throwing causes redirect loops
                }
            },
        }),
        {
            name: 'apex-auth',
            partialize: (state) => ({
                token: state.token,
                role: state.role,
            }),
        },
    ),
);

export default useAuthStore;