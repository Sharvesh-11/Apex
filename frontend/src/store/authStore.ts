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
const authPersistKey = 'apex-auth';

const getCookieToken = () => {
	if (typeof document === 'undefined') return null;

	const match = document.cookie
		.split('; ')
		.find((row) => row.startsWith('apex_token='));

	return match ? decodeURIComponent(match.split('=')[1]) : null;
};

const clearPersistedAuth = () => {
	if (typeof window === 'undefined') {
		return;
	}

	window.localStorage.removeItem(authStorageKey);
	window.localStorage.removeItem(authPersistKey);
	document.cookie = `${authStorageKey}=; path=/; max-age=0`;
};

const clearAuthStorage = () => {
	if (typeof window === 'undefined') {
		return;
	}

	clearPersistedAuth();
};

const setAuthStorage = (token: string | null) => {
	if (typeof window === 'undefined') {
		return;
	}

	if (token) {
		window.localStorage.setItem("apex_token", token);
		document.cookie = `apex_token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
		return;
	}

	clearPersistedAuth();
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
					const response = await apiClient.post<TokenResponse>('/auth/login', {
						email,
						password,
					});

					const token = response.access_token;
					const role = response.role as AuthRole;

					setAuthStorage(token);
					console.log("LOGIN TOKEN SAVED:", token);

					const meResponse = await apiClient.get<User>('/auth/me');

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
				let storedToken: string | null = null;

				if (typeof window !== 'undefined') {
					storedToken = window.localStorage.getItem(authStorageKey);

					if (!storedToken) {
						storedToken = getCookieToken();

						if (storedToken) {
							window.localStorage.setItem(authStorageKey, storedToken);
						}
					}

					if (!storedToken) {
						const persistedAuth = window.localStorage.getItem(authPersistKey);

						if (persistedAuth) {
							try {
								const parsed = JSON.parse(persistedAuth) as { state?: Partial<AuthPersistedState> } | null;
								storedToken = parsed?.state?.token ?? null;

								if (storedToken) {
									setAuthStorage(storedToken);
								}
							} catch {
								storedToken = null;
							}
						}
					}
				}

				console.log("INIT AUTH TOKEN:", storedToken);

				if (!storedToken) {
					set({
						...initialState,
					});
					return;
				}

				set({ isLoading: true, token: storedToken });

				try {
					const meResponse = await apiClient.get<User>('/auth/me');

					set({
						user: meResponse,
						token: storedToken,
						role: meResponse.role,
						isAuthenticated: true,
						isLoading: false,
					});
				} catch (error) {
					clearPersistedAuth();
					set({
						...initialState,
						isLoading: false,
					});
					throw error;
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
