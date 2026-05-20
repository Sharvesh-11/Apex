"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import useAuthStore from '@/store/authStore';

import * as apiClient from '@/lib/api';
import useUIStore from '@/store/uiStore';

type UserRow = {
	id: string;
	email: string;
	role: string;
	is_active: boolean;
	created_at?: string;
	full_name?: string;
};

type AddOwnerFormState = {
	full_name: string;
	email: string;
	password: string;
};

const initialFormState: AddOwnerFormState = {
	full_name: '',
	email: '',
	password: '',
};

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
});

const skeletonRows = Array.from({ length: 6 });

function fallbackNameFromEmail(email: string) {
	const localPart = email.split('@')[0] ?? '';
	if (!localPart) return 'User';
	return localPart
		.split(/[._-]/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export default function AdminUsersPage() {
	const router = useRouter();
	const { isAuthenticated, user, isLoading, isInitialized } = useAuthStore();
	const initAuth = useAuthStore((s) => s.initAuth);
	const showToast = useUIStore((state) => state.showToast);
	const toast = useUIStore((state) => state.toast);
	const clearToast = useUIStore((state) => state.clearToast);

	const [users, setUsers] = useState<UserRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isTogglingId, setIsTogglingId] = useState<string | null>(null);
	const [form, setForm] = useState<AddOwnerFormState>(initialFormState);

	useEffect(() => {
		void initAuth().catch(() => {
			// handled by initAuth
		});
	}, [initAuth]);

	useEffect(() => {
		if (!toast) return;
		const timeout = window.setTimeout(() => clearToast(), 3000);
		return () => window.clearTimeout(timeout);
	}, [clearToast, toast]);

	useEffect(() => {
		if (isLoading) return;
		if (!isAuthenticated || !user) {
			router.push('/login');
		}
	}, [isLoading, isAuthenticated, user, router]);

	const fetchUsers = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await apiClient.get<UserRow[]>('/auth/users/');
			setUsers(response ?? []);
		} catch {
			setError('Failed to load users');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void fetchUsers();
	}, []);

	const sortedUsers = useMemo(() => {
		return users
			.slice()
			.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
	}, [users]);

	if (isLoading || !isAuthenticated || !user) return null;

	const handleToggleActive = async (user: UserRow) => {
		// admin cannot deactivate owners
		if (user.role === 'gym_owner') {
			showToast('Admins cannot deactivate gym owners', 'error');
			return;
		}
		setIsTogglingId(user.id);
		try {
			await apiClient.put(`/auth/users/${user.id}/toggle-active`);
			showToast('Status updated successfully', 'success');
			await fetchUsers();
		} catch {
			showToast('Failed to update status', 'error');
		} finally {
			setIsTogglingId(null);
		}
	};

	const handleAddOwner = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsSubmitting(true);
		try {
			await apiClient.post('/auth/register', {
				full_name: form.full_name,
				email: form.email,
				password: form.password,
				role: 'gym_owner',
			});
			showToast('Owner added successfully', 'success');
			setIsModalOpen(false);
			setForm(initialFormState);
			await fetchUsers();
		} catch {
			showToast('Failed to add owner', 'error');
		} finally {
			setIsSubmitting(false);
		}
	};

	const roleBadgeClass = (role: string) => {
		if (role === 'admin') return 'bg-red-400/10 text-red-400';
		if (role === 'gym_owner') return 'bg-primary/10 text-primary';
		return 'bg-blue-400/10 text-blue-400';
	};

	const roleLabel = (role: string) => {
		if (role === 'admin') return 'Admin';
		if (role === 'gym_owner') return 'Owner';
		return 'Member';
	};

	return (
		<div className="space-y-6">
			{toast ? (
				<div className={`fixed right-6 top-6 z-50 rounded-lg border px-4 py-3 shadow-lg ${
					toast.type === 'success'
						? 'border-primary/30 bg-primary/10 text-primary'
						: 'border-red-400/30 bg-red-400/10 text-red-400'
				}`}>
					{toast.message}
				</div>
			) : null}

			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-3xl font-bold text-textPrimary">All Users</h1>
				<button
					type="button"
					onClick={() => { setForm(initialFormState); setIsModalOpen(true); }}
					className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-textPrimary transition-colors hover:bg-primaryHover"
				>
					<Plus className="h-4 w-4" />
					Add Owner
				</button>
			</div>

			{error ? (
				<div className="rounded-lg border border-accent bg-surface p-4 text-textSecondary">{error}</div>
			) : null}

			<div className="overflow-hidden rounded-xl border border-accent bg-surface">
				<div className="overflow-x-auto">
					<table className="min-w-full text-left text-sm">
						<thead className="border-b border-accent text-textSecondary">
							<tr>
								<th className="px-4 py-3 font-medium">Name</th>
								<th className="px-4 py-3 font-medium">Email</th>
								<th className="px-4 py-3 font-medium">Role</th>
								<th className="px-4 py-3 font-medium">Joined</th>
								<th className="px-4 py-3 font-medium">Status</th>
								<th className="px-4 py-3 font-medium">Actions</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								skeletonRows.map((_, i) => (
									<tr key={i} className="border-b border-accent/50 last:border-b-0">
										{Array.from({ length: 6 }).map((__, j) => (
											<td key={j} className="px-4 py-4">
												<div className="h-4 animate-pulse rounded bg-background/70" />
											</td>
										))}
									</tr>
								))
							) : sortedUsers.length > 0 ? (
								sortedUsers.map((user) => {
									const name = user.full_name?.trim() || fallbackNameFromEmail(user.email);
									const isActive = user.is_active;
									const canToggle = user.role !== 'gym_owner' && user.role !== 'admin';

									return (
										<tr key={user.id} className="border-b border-accent/50 last:border-b-0">
											<td className="px-4 py-4 text-textPrimary">{name}</td>
											<td className="px-4 py-4 text-textSecondary">{user.email}</td>
											<td className="px-4 py-4">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeClass(user.role)}`}>
													{roleLabel(user.role)}
												</span>
											</td>
											<td className="px-4 py-4 text-textSecondary">
												{user.created_at ? dateFormatter.format(new Date(user.created_at)) : '—'}
											</td>
											<td className="px-4 py-4">
												<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${isActive ? 'bg-green-400/10 text-green-400' : 'bg-background text-textSecondary'}`}>
													{isActive ? 'Active' : 'Inactive'}
												</span>
											</td>
											<td className="px-4 py-4">
												{canToggle ? (
													<button
														type="button"
														onClick={() => handleToggleActive(user)}
														disabled={isTogglingId === user.id}
														className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-textPrimary transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
													>
														{isTogglingId === user.id ? 'Updating...' : isActive ? 'Deactivate' : 'Activate'}
													</button>
												) : (
													<span className="text-xs text-textSecondary">—</span>
												)}
											</td>
										</tr>
									);
								})
							) : (
								<tr>
									<td colSpan={6} className="px-4 py-12 text-center text-textSecondary">No users found.</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{isModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4">
					<div className="w-full max-w-lg rounded-xl border border-accent bg-surface p-6 shadow-xl">
						<div className="mb-6 flex items-center justify-between">
							<h2 className="text-xl font-semibold text-textPrimary">Add Owner</h2>
							<button type="button" onClick={() => setIsModalOpen(false)} className="rounded-md p-2 text-textSecondary hover:text-textPrimary">
								<X className="h-5 w-5" />
							</button>
						</div>
						<form className="space-y-4" onSubmit={handleAddOwner}>
							<div>
								<label className="mb-1 block text-sm text-textSecondary">Full Name</label>
								<input type="text" required value={form.full_name} onChange={(e) => setForm((c) => ({ ...c, full_name: e.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
							</div>
							<div>
								<label className="mb-1 block text-sm text-textSecondary">Email</label>
								<input type="email" required value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
							</div>
							<div>
								<label className="mb-1 block text-sm text-textSecondary">Password</label>
								<input type="password" required value={form.password} onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
							</div>
							<div className="flex items-center justify-end gap-3 pt-2">
								<button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-accent px-4 py-2 text-sm text-textPrimary hover:border-primary hover:text-primary">Cancel</button>
								<button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-textPrimary hover:bg-primaryHover disabled:opacity-60">
									{isSubmitting ? 'Adding...' : 'Add Owner'}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}
		</div>
	);
}