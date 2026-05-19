import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

const baseURL = '/api';

export const api = axios.create({
	baseURL,
});

api.interceptors.request.use((config) => {
	if (typeof window === 'undefined') {
		return config;
	}

	const token = window.localStorage.getItem('apex_token');

	if (token) {
		config.headers = config.headers ?? {};
		config.headers.Authorization = `Bearer ${token}`;
	}

	return config;
});

api.interceptors.request.use((config) => {
	const skipTrailingSlashRoutes = ['/auth/google/url', '/auth/google/callback'];

	if (
		typeof config.url === 'string' &&
		!skipTrailingSlashRoutes.includes(config.url) &&
		!config.url.endsWith('/') &&
		!config.url.includes('?')
	) {
		config.url = `${config.url}/`;
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
