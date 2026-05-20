import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

// Direct backend API endpoint - bypass Next.js proxy to avoid redirects
const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
	baseURL,
});

api.interceptors.request.use((config) => {
	if (typeof window === 'undefined') {
		return config;
	}

	// Try localStorage first
	let token = window.localStorage.getItem('apex_token');

	// Fallback to cookie if localStorage is empty
	if (!token) {
		const match = document.cookie
			.split('; ')
			.find((row) => row.startsWith('apex_token='));

		if (match) {
			token = match.split('=')[1];

			// Sync back to localStorage so future requests work
			window.localStorage.setItem('apex_token', token);
		}
	}

	if (token) {
		config.headers = config.headers ?? {};
		config.headers.Authorization = `Bearer ${token}`;
	}

	return config;
});



api.interceptors.response.use(
	(response) => response,
	(error: AxiosError) => {
		if (error.response?.status === 401 && typeof window !== 'undefined') {
			window.localStorage.clear();
			window.location.href = '/login';
		}

		return Promise.reject(error);
	},
);

export async function get<T>(url: string, params?: AxiosRequestConfig['params']): Promise<T> {
	const response = await api.get<T>(url, { params });
	return response.data;
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
	const response = await api.post<T>(url, body);
	return response.data;
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
	const response = await api.put<T>(url, body);
	return response.data;
}

export async function del<T>(url: string): Promise<T> {
	const response = await api.delete<T>(url);
	return response.data;
}

export default api;
