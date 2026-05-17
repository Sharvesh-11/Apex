import type React from 'react';

import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
	message: string;
	type: ToastType;
};

type UIState = {
	isModalOpen: boolean;
	modalContent: React.ReactNode | null;
	isLoading: boolean;
	toast: ToastState | null;
	openModal: (content: React.ReactNode) => void;
	closeModal: () => void;
	setLoading: (val: boolean) => void;
	showToast: (message: string, type: ToastType) => void;
	clearToast: () => void;
};

const useUIStore = create<UIState>((set) => ({
	isModalOpen: false,
	modalContent: null,
	isLoading: false,
	toast: null,
	openModal: (content) =>
		set({
			isModalOpen: true,
			modalContent: content,
		}),
	closeModal: () =>
		set({
			isModalOpen: false,
			modalContent: null,
		}),
	setLoading: (val) => set({ isLoading: val }),
	showToast: (message, type) =>
		set({
			toast: {
				message,
				type,
			},
		}),
	clearToast: () => set({ toast: null }),
}));

export default useUIStore;
