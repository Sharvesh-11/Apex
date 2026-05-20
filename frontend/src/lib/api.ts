import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

// Environment-aware API base URL
// Production: uses `/api` (proxied through Nginx → Backend)
// Development: can override with NEXT_PUBLIC_API_URL env variable
const baseURL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const api = axios.create({
	baseURL,
});

api.interceptors.request.use((config) => {
	if (typeof window === 'undefined') {
		return config;
	}

	const getCookie = (name: string) => {
		if (typeof document === 'undefined') return null;

		const value = document.cookie
			.split('; ')
			.find((row) => row.startsWith(`${name}=`));

		return value ? decodeURIComponent(value.split('=')[1]) : null;
	};

	let token = window.localStorage.getItem('apex_token');

	if (!token) {
		token = getCookie('apex_token');

		if (token) {
			window.localStorage.setItem('apex_token', token);
		}
	}

	if (token) {
		config.headers = config.headers ?? {};
		config.headers.Authorization = `Bearer ${token}`;
	}

	console.log("API REQUEST:", {
		url: config.url,
		hasToken: Boolean(token),
		authHeader: Boolean(config.headers?.Authorization),
	});

	return config;
});



api.interceptors.response.use(
	(response) => response,
	(error: AxiosError) => {
		if (error.response?.status === 401 && typeof window !== 'undefined') {
			console.error("API 401:", error.config?.url, error.response?.data);
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
