"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import { Eye, UserX, Search, Plus, X, ChevronDown, ShieldCheck, Users as UsersIcon } from 'lucide-react';

import * as apiClient from '@/lib/api';
import type { Member, Plan, Subscription } from '@/types';
import useUIStore from '@/store/uiStore';

type MemberRecord = Member & {
	status?: 'active' | 'inactive';
	subscription?: Subscription | null;
	role?: string;
};

type AddMemberFormState = {
	full_name: string;
	email: string;
	phone: string;
	password: string;
	plan_id: string;
	start_date: string;
};

const today = new Date().toISOString().slice(0, 10);

const initialFormState: AddMemberFormState = {
	full_name: '',
	email: '',
	phone: '',
	password: '',
	plan_id: '',
	start_date: today,
};

const memberSkeletons = Array.from({ length: 6 });

const C = {
	bg: '#050508',
	surface: '#0a0a12',
	surfaceDeep: '#07070e',
	glass: 'rgba(255,255,255,0.02)',
	glassMid: 'rgba(255,255,255,0.04)',
	border: 'rgba(255,255,255,0.05)',
	borderMid: 'rgba(255,255,255,0.08)',
	primary: '#7c3aed',
	primaryGlow: 'rgba(124,58,237,0.2)',
	accent: '#a78bfa',
	green: '#10b981',
	gold: '#f59e0b',
	red: '#ef4444',
	blue: '#3b82f6',
	textPrimary: '#f1f5f9',
	textSecondary: '#475569',
	textMuted: '#1e293b',
};

const joinedDateFormatter = new Intl.DateTimeFormat('en-IN', {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
});

function generateStrongPassword() {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
	return Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function getInitialFilter(member: MemberRecord) {
	return member.status ?? (member.is_active ? 'active' : 'inactive');
}

export default function OwnerMembersPage() {
	const { isAuthenticated, user, isLoading } = useAuthStore();
	const router = useRouter();
	const initAuth = useAuthStore((s) => s.initAuth);
	const showToast = useUIStore((state) => state.showToast);
	const toast = useUIStore((state) => state.toast);
	const clearToast = useUIStore((state) => state.clearToast);

	const [members, setMembers] = useState<MemberRecord[]>([]);
	const [roleModalMember, setRoleModalMember] = useState<MemberRecord | null>(null);
	const [roleSelection, setRoleSelection] = useState<string>('gym_member');
	const [isUpdatingRole, setIsUpdatingRole] = useState(false);
	const [plans, setPlans] = useState<Plan[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'inactive'>('all');
	const [search, setSearch] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [form, setForm] = useState<AddMemberFormState>(initialFormState);

	// responsive flags for grid layout
	const [isMobile, setIsMobile] = useState(false);
	const [isTablet, setIsTablet] = useState(false);

	useEffect(() => {
		void initAuth().catch(() => {});
	}, [initAuth]);

	useEffect(() => {
		if (isLoading) return;
		if (!isAuthenticated || !user) {
			router.push('/login');
		}
	}, [isLoading, isAuthenticated, user, router]);

	if (isLoading || !isAuthenticated || !user) return null;

	useEffect(() => {
		const check = () => {
			setIsMobile(window.innerWidth < 640);
			setIsTablet(window.innerWidth < 1024);
		};
		check();
		window.addEventListener('resize', check);
		return () => window.removeEventListener('resize', check);
	}, []);

	useEffect(() => {
		if (!toast) return;
		const timeout = window.setTimeout(() => clearToast(), 3000);
		return () => window.clearTimeout(timeout);
	}, [clearToast, toast]);

	useEffect(() => {
		let mounted = true;

		void (async () => {
			setLoading(true);
			setError(null);

			try {
				const [membersResponse, plansResponse] = await Promise.all([
					apiClient.get<MemberRecord[]>('/members/'),
					apiClient.get<Plan[]>('/plans/'),
				]);

				if (!mounted) return;
				const fetchedMembers = (membersResponse ?? []) as MemberRecord[];
				const fetchedPlans = plansResponse ?? [];

				// member objects already include a `role` field from the API; use it or default to 'gym_member'
				for (const m of fetchedMembers) {
					m.role = (m as any).role ?? 'gym_member';
				}
				setMembers(fetchedMembers);
				setPlans(fetchedPlans);
				setForm((current) => ({
					...current,
					password: current.password || generateStrongPassword(),
					plan_id: current.plan_id || fetchedPlans?.[0]?.id || '',
				}));
			} catch (err) {
				console.error('Failed to load members or plans', err);
				if (!mounted) return;
				setError('Failed to load members');
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		})();

		return () => {
			mounted = false;
		};
	}, []);

	const filteredMembers = useMemo(() => {
		const term = search.trim().toLowerCase();

		return members.filter((member) => {
			const matchesSearch =
				!term ||
				member.full_name.toLowerCase().includes(term) ||
				member.email.toLowerCase().includes(term);

			const status = getInitialFilter(member);
			const matchesFilter = selectedFilter === 'all' || status === selectedFilter;

			return matchesSearch && matchesFilter;
		});
	}, [members, search, selectedFilter]);

	const activePlanOptions = plans.filter((plan) => plan.is_active !== false);

	const refreshMembers = async () => {
		const nextMembers = await apiClient.get<MemberRecord[]>('/members/');

		const fetchedMembers = nextMembers ?? [];

		for (const m of fetchedMembers) {
			m.role = (m as any).role ?? 'gym_member';
		}
		setMembers(fetchedMembers);
	};

	const handleDeactivate = async (memberId: string) => {
		const confirmed = window.confirm('Are you sure you want to deactivate this member?');
		if (!confirmed) return;

		try {
			await apiClient.del(`/members/${memberId}`);
			showToast('Member deactivated successfully', 'success');
			await refreshMembers();
		} catch {
			showToast('Failed to deactivate member', 'error');
		}
	};

	const handleUpdateRole = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!roleModalMember) return;
		setIsUpdatingRole(true);
		try {
			const userId = roleModalMember.user_id;
			if (!userId) throw new Error('Missing user id');
			await apiClient.put(`/auth/users/${userId}/set-role`, { role: roleSelection });
			showToast('Role updated successfully', 'success');
			setRoleModalMember(null);
			await refreshMembers();
		} catch (err) {
			console.error('Failed to update role', err);
			showToast('Failed to update role', 'error');
		} finally {
			setIsUpdatingRole(false);
		}
	};

	const openAddMemberModal = () => {
		setForm({
			full_name: '',
			email: '',
			phone: '',
			password: generateStrongPassword(),
			plan_id: activePlanOptions[0]?.id ?? '',
			start_date: today,
		});
		setIsModalOpen(true);
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!form.plan_id) {
			showToast('Please select a plan', 'error');
			return;
		}

		setSaving(true);
		try {
			const createdMember = await apiClient.post<MemberRecord>('/members/', {
				full_name: form.full_name,
				email: form.email,
				phone: form.phone || undefined,
				password: form.password,
			});

			const selectedPlan = plans.find((plan) => plan.id === form.plan_id);

			await apiClient.post('/subscriptions', {
				member_id: createdMember.id,
				plan_id: form.plan_id,
				start_date: form.start_date,
				status: 'active',
				plan: selectedPlan,
			});

			showToast('Member created successfully', 'success');
			setIsModalOpen(false);
			setForm(initialFormState);
			await refreshMembers();
		} catch {
			showToast('Failed to create member', 'error');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div
			className="flex flex-col"
			style={{
				fontFamily: 'DM Sans, sans-serif',
				color: C.textPrimary,
				padding: '32px 32px 64px',
				display: 'flex',
				flexDirection: 'column',
				gap: '28px',
				background: C.bg,
			}}
		>
			<style jsx global>{`
				@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

				@keyframes fadeInUp {
					from { opacity: 0; transform: translateY(12px); }
					to { opacity: 1; transform: translateY(0); }
				}

				@keyframes shimmer {
					0% { background-position: 200% 0; }
					100% { background-position: -200% 0; }
				}

				.table-row {
					transition: background 0.15s ease;
					cursor: default;
				}

				.table-row:hover {
					background: rgba(124,58,237,0.04) !important;
				}

				.table-row:hover .row-actions {
					opacity: 1 !important;
				}

				.action-btn {
					transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
				}

				.action-btn:hover {
					transform: scale(1.08);
				}

				.filter-input:focus,
				.modal-input:focus {
					outline: none;
					border-color: rgba(124,58,237,0.35) !important;
					box-shadow: 0 0 0 3px rgba(124,58,237,0.07) !important;
				}

				.filter-input::placeholder,
				.modal-input::placeholder {
					color: #1e293b;
				}

				.add-member-btn:hover,
				.modal-primary-btn:hover {
					filter: brightness(1.1);
					box-shadow: 0 4px 24px rgba(124,58,237,0.35) !important;
				}

				.dropdown-menu {
					animation: fadeInUp 0.15s ease both;
				}
			`}</style>

			{toast ? (
				<div
					className="fixed right-6 top-6 z-50 rounded-lg px-4 py-3"
					style={{
						border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.25)' : toast.type === 'error' ? 'rgba(239,68,68,0.25)' : C.borderMid}`,
						background: toast.type === 'success' ? 'rgba(16,185,129,0.1)' : toast.type === 'error' ? 'rgba(239,68,68,0.1)' : C.surface,
						color: toast.type === 'success' ? C.green : toast.type === 'error' ? C.red : C.textPrimary,
						boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
					}}
				>
					{toast.message}
				</div>
			) : null}

			{roleModalMember ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
					<form
						onSubmit={handleUpdateRole}
						className="w-full max-w-xl"
						style={{
							background: '#0d0d18',
							border: '1px solid rgba(124,58,237,0.15)',
							borderRadius: '20px',
							padding: '32px',
							boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
						}}
					>
						<div className="mb-6 flex items-start justify-between">
							<div>
								<h3
									style={{
										fontFamily: 'Bebas Neue, sans-serif',
										fontSize: '28px',
										letterSpacing: '0.04em',
										color: C.textPrimary,
										marginBottom: '8px',
									}}
								>
									Update Member Role
								</h3>
								<div style={{ fontSize: '16px', color: C.accent, fontWeight: 600 }}>{roleModalMember.full_name}</div>
							</div>
							<button type="button" onClick={() => setRoleModalMember(null)} className="rounded p-2" style={{ color: C.textSecondary }}>
								<X className="h-5 w-5" />
							</button>
						</div>

						<div className="dropdown-menu flex gap-2.5">
							{[
								{ key: 'gym_member', name: 'Member', desc: 'Standard access' },
								{ key: 'gym_owner', name: 'Owner', desc: 'Full management' },
								{ key: 'admin', name: 'Admin', desc: 'Platform control' },
							].map((role) => {
								const selected = roleSelection === role.key;
								return (
									<button
										key={role.key}
										type="button"
										onClick={() => setRoleSelection(role.key)}
										className="flex-1"
										style={{
											padding: '14px 16px',
											borderRadius: '10px',
											border: selected ? '1px solid rgba(124,58,237,0.4)' : `1px solid ${C.border}`,
											cursor: 'pointer',
											textAlign: 'center',
											transition: 'all 0.2s',
											background: selected ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.02)',
										}}
									>
										<div style={{ fontSize: '13px', fontWeight: 600, color: C.textPrimary }}>{role.name}</div>
										<div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px' }}>{role.desc}</div>
									</button>
								);
							})}
						</div>

						<div className="mt-6 flex items-center justify-end gap-3">
							<button
								type="button"
								onClick={() => setRoleModalMember(null)}
								style={{
									background: 'transparent',
									border: `1px solid ${C.border}`,
									borderRadius: '10px',
									padding: '13px 20px',
									color: C.textSecondary,
									cursor: 'pointer',
								}}
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={isUpdatingRole}
								className="modal-primary-btn"
								style={{
									background: `linear-gradient(135deg, ${C.primary}, #5b21b6)`,
									border: 'none',
									borderRadius: '10px',
									padding: '13px 20px',
									fontSize: '13px',
									fontWeight: 600,
									color: '#ffffff',
									cursor: 'pointer',
									boxShadow: '0 4px 20px rgba(124,58,237,0.25)',
									transition: 'all 0.2s',
									opacity: isUpdatingRole ? 0.6 : 1,
								}}
							>
								{isUpdatingRole ? 'Updating...' : 'Update Role'}
							</button>
						</div>
					</form>
				</div>
			) : null}

			<div
				className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
				style={{
					animation: 'fadeInUp 0.4s ease both',
					background: 'rgba(3, 0, 20, 0.6)',
					backdropFilter: 'blur(20px)',
					WebkitBackdropFilter: 'blur(20px)',
					borderRadius: '18px',
					padding: isMobile ? '16px 14px' : '20px 20px',
				}}
			>
				<div>
					<div
						style={{
							fontSize: isMobile ? '15px' : '18px',
							fontWeight: 300,
							letterSpacing: '0.2em',
							color: '#ffffff',
							lineHeight: 1,
						}}
					>
						APEX
					</div>
					{!isMobile ? <div style={{ fontSize: '11px', color: '#8E7CC3', marginTop: '5px' }}>members</div> : null}
				</div>

				<button
					type="button"
					onClick={openAddMemberModal}
					className="inline-flex items-center"
					style={{
						background: 'transparent',
						border: '1px solid rgba(139,92,246,0.25)',
						borderRadius: '20px',
						padding: '6px 16px',
						fontSize: '14px',
						fontWeight: 500,
						color: '#8B5CF6',
						cursor: 'pointer',
						display: 'flex',
						alignItems: 'center',
						gap: '10px',
						transition: 'background 0.2s ease',
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = 'rgba(139,92,246,0.08)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = 'transparent';
					}}
				>
					<Plus className="h-[15px] w-[15px]" style={{ color: '#D8CCFF' }} />
					Add Member
				</button>
			</div>

			<div
				className="flex flex-wrap items-center gap-3"
				style={{
					animation: 'fadeInUp 0.4s ease 80ms both',
					background: 'rgba(0,0,0,0.2)',
					border: `1px solid ${C.border}`,
					borderRadius: '12px',
					padding: '16px 20px',
				}}
			>
				<div className="relative flex-1" style={{ minWidth: '200px' }}>
					<Search className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2" style={{ color: C.textMuted }} />
					<input
						type="text"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search members by name or email"
						className="filter-input"
						style={{
							width: '100%',
							background: 'rgba(255,255,255,0.03)',
							border: `1px solid ${C.border}`,
							borderRadius: '8px',
							padding: '9px 12px 9px 36px',
							fontSize: '13px',
							color: C.textPrimary,
							transition: 'border-color 0.2s, box-shadow 0.2s',
							fontFamily: 'DM Sans, sans-serif',
						}}
					/>
				</div>

				<select
					value={selectedFilter}
					onChange={(event) => setSelectedFilter(event.target.value as 'all' | 'active' | 'inactive')}
					className="filter-input"
					style={{
						minWidth: '130px',
						background: 'rgba(255,255,255,0.03)',
						border: `1px solid ${C.border}`,
						borderRadius: '8px',
						padding: '9px 12px',
						fontSize: '13px',
						color: C.textPrimary,
						fontFamily: 'DM Sans, sans-serif',
					}}
				>
					<option value="all">All Members</option>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
				</select>

				<div style={{ width: '1px', height: '20px', background: C.border, flexShrink: 0 }} />

				<div style={{ fontSize: '12px', color: C.textMuted, whiteSpace: 'nowrap' }}>{filteredMembers.length} members</div>
			</div>

			{error ? (
				<div style={{ border: `1px solid ${C.borderMid}`, borderRadius: '10px', background: C.glass, padding: '12px 16px', color: C.textSecondary }}>
					{error}
				</div>
			) : null}

			<div
				style={{
					animation: 'fadeInUp 0.4s ease 160ms both',
					background: C.glass,
					border: `1px solid ${C.border}`,
					borderRadius: '16px',
					overflow: 'hidden',
				}}
			>
				<div
					className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
					style={{
						gap: isMobile ? 12 : 20,
						padding: isMobile ? '12px' : '20px',
					}}
				>
					{loading
						? memberSkeletons.map((_, idx) => (
							<div
								key={idx}
								style={{
									borderRadius: 16,
									padding: '24px',
									background: '#07070e',
									border: '1px solid rgba(255,255,255,0.04)',
									display: 'flex',
									flexDirection: 'column',
									gap: '12px',
									transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
								}}
							>
								<div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', animation: 'shimmer 1.8s infinite' }} />
								<div style={{ width: '60%', height: 18, borderRadius: 6, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(124,58,237,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite', marginTop: 16 }} />
								<div style={{ width: '80%', height: 12, borderRadius: 6, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(124,58,237,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite', marginTop: 8 }} />
								<div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
									<div style={{ width: 80, height: 24, borderRadius: 999, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(124,58,237,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite' }} />
									<div style={{ width: 80, height: 24, borderRadius: 999, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(124,58,237,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite' }} />
									<div style={{ width: 80, height: 24, borderRadius: 999, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(124,58,237,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite' }} />
								</div>
								<div style={{ height: 1, marginTop: 20, background: 'rgba(255,255,255,0.04)' }} />
								<div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
									<div style={{ width: '100%', height: 34, borderRadius: 8, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(124,58,237,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite' }} />
									<div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(124,58,237,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite' }} />
									<div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(124,58,237,0.06) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite' }} />
								</div>
							</div>
						))
						: filteredMembers.length > 0
							? filteredMembers.map((member) => {
								const isActive = getInitialFilter(member) === 'active';
								const role = member.role ?? 'gym_member';
								const roleStyle =
									role === 'gym_member'
										? { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: C.blue, label: 'Member' }
										: role === 'gym_owner'
											? { background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: C.accent, label: 'Owner' }
											: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', color: C.gold, label: 'Admin' };

								return (
									<div
										key={member.id}
										style={{
											position: 'relative',
											overflow: 'hidden',
											borderRadius: 16,
											border: `1px solid ${C.border}`,
											background: 'linear-gradient(160deg, rgba(124,58,237,0.06) 0%, #07070e 100%)',
											padding: '24px',
											transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
											cursor: 'default',
											marginBottom: 0,
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.transform = 'translateY(-3px)';
											e.currentTarget.style.boxShadow = '0 12px 40px rgba(124,58,237,0.12)';
											e.currentTarget.style.borderColor = 'rgba(124,58,237,0.18)';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.transform = '';
											e.currentTarget.style.boxShadow = '';
											e.currentTarget.style.borderColor = `${C.border}`;
										}}
									>
										<div style={{ width: 80, height: 80, borderRadius: '50%', position: 'absolute', top: -20, right: -20, background: 'radial-gradient(circle, rgba(124,58,237,0.15), transparent)', opacity: 0.6, pointerEvents: 'none' }} />

										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
											<div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(124,58,237,0.12)', border: '2px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
												{member.profile_photo_url ? (
													<img src={member.profile_photo_url} alt={member.full_name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '50%' }} />
												) : (
													<span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, color: '#a78bfa' }}>{member.full_name.slice(0, 1).toUpperCase()}</span>
												)}
											</div>

											<div>
												<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 500, background: isActive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: isActive ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(239,68,68,0.15)', color: isActive ? C.green : C.red }}>
												<span style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? C.green : C.red }} />
												{isActive ? 'Active' : 'Inactive'}
											</span>
											</div>
										</div>

										<div style={{ marginBottom: 12 }}>
											<div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, letterSpacing: '0.03em', color: C.textPrimary, lineHeight: 1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.full_name}</div>
											<div style={{ fontSize: 12, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 12 }}>{member.email}</div>
										</div>

										<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
											<div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 999, padding: '4px 10px', fontSize: 11, color: C.textMuted }}>
												{/* Phone icon + text */}
												<span style={{ width: 14, height: 14 }} />
												{member.phone || 'No phone'}
											</div>

											<div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 999, padding: '4px 10px', fontSize: 11, color: C.textMuted }}>
												{/* Joined */}
												<span style={{ width: 14, height: 14 }} />
												{new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(member.joined_at))}
											</div>

											<div style={{ borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 500, background: roleStyle.background, border: roleStyle.border, color: roleStyle.color }}>
												{roleStyle.label}
											</div>
										</div>

										<div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)', marginBottom: 16 }} />

										<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
											<button
												type="button"
												onClick={() => router.push(`/owner/members/${member.id}`)}
												style={{
													flex: 1,
													background: 'rgba(124,58,237,0.1)',
													border: '1px solid rgba(124,58,237,0.2)',
													borderRadius: 8,
													padding: '8px 12px',
													fontSize: 12,
													color: '#a78bfa',
													fontWeight: 500,
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													gap: 6,
													transition: 'all 0.2s',
												}}
												onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.18)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.35)'; }}
												onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(124,58,237,0.1)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
											>
												<Eye className="h-[13px] w-[13px]" />
												<span>View</span>
											</button>

											<button
												type="button"
												title="Change role"
												onClick={() => { setRoleModalMember(member); setRoleSelection(member.role ?? 'gym_member'); }}
												style={{ width: 34, height: 34, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.textMuted, transition: 'all 0.2s' }}
												onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.2)'; }}
												onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
											>
												<ShieldCheck className="h-[14px] w-[14px]" />
											</button>

											{isActive ? (
												<button
													type="button"
													title="Deactivate member"
													onClick={() => handleDeactivate(member.id)}
													style={{ width: 34, height: 34, borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.textMuted, transition: 'all 0.2s' }}
													onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
													onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
												>
													<UserX className="h-[14px] w-[14px]" />
												</button>
											) : null}
										</div>
									</div>
								);
								})
							: (
								<div style={{ padding: '60px 24px', textAlign: 'center', gridColumn: '1 / -1' }}>
									<div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(255,255,255,0.05)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
										<UsersIcon className="h-5 w-5" style={{ color: C.textSecondary, opacity: 0.5 }} />
									</div>
									<div style={{ fontSize: 16, color: C.textPrimary, fontWeight: 600 }}>No members found</div>
									<div style={{ fontSize: 13, color: C.textSecondary, marginTop: 6 }}>Add your first member to get started</div>
								</div>
							)}
				</div>
			</div>

			{isModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
					<div
						className="w-full"
						style={{
							maxWidth: '520px',
							background: '#0d0d18',
							border: '1px solid rgba(124,58,237,0.15)',
							borderRadius: '20px',
							padding: '32px',
							boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
						}}
					>
						<div className="mb-6 flex items-center justify-between">
							<h2
								style={{
									fontFamily: 'Bebas Neue, sans-serif',
									fontSize: '28px',
									letterSpacing: '0.04em',
									color: C.textPrimary,
									marginBottom: 0,
								}}
							>
								Add Member
							</h2>
							<button
								type="button"
								onClick={() => setIsModalOpen(false)}
								className="rounded p-2"
								style={{ color: C.textSecondary }}
								aria-label="Close modal"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						<form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
							<div className="md:col-span-2">
								<label style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, marginBottom: '6px', fontWeight: 500, display: 'block' }}>
									Full Name
								</label>
								<input
									required
									value={form.full_name}
									onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))}
									className="modal-input"
									style={{
										background: 'rgba(255,255,255,0.03)',
										border: `1px solid ${C.border}`,
										borderRadius: '10px',
										padding: '11px 14px',
										fontSize: '13px',
										color: C.textPrimary,
										fontFamily: 'DM Sans, sans-serif',
										width: '100%',
										transition: 'border-color 0.2s, box-shadow 0.2s',
									}}
								/>
							</div>

							<div className="md:col-span-2">
								<label style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, marginBottom: '6px', fontWeight: 500, display: 'block' }}>
									Email
								</label>
								<input
									required
									type="email"
									value={form.email}
									onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
									className="modal-input"
									style={{
										background: 'rgba(255,255,255,0.03)',
										border: `1px solid ${C.border}`,
										borderRadius: '10px',
										padding: '11px 14px',
										fontSize: '13px',
										color: C.textPrimary,
										fontFamily: 'DM Sans, sans-serif',
										width: '100%',
										transition: 'border-color 0.2s, box-shadow 0.2s',
									}}
								/>
							</div>

							<div>
								<label style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, marginBottom: '6px', fontWeight: 500, display: 'block' }}>
									Phone
								</label>
								<input
									value={form.phone}
									onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
									className="modal-input"
									style={{
										background: 'rgba(255,255,255,0.03)',
										border: `1px solid ${C.border}`,
										borderRadius: '10px',
										padding: '11px 14px',
										fontSize: '13px',
										color: C.textPrimary,
										fontFamily: 'DM Sans, sans-serif',
										width: '100%',
										transition: 'border-color 0.2s, box-shadow 0.2s',
									}}
								/>
							</div>

							<div>
								<label style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, marginBottom: '6px', fontWeight: 500, display: 'block' }}>
									Password
								</label>
								<div className="flex gap-2">
									<input
										required
										value={form.password}
										onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
										className="modal-input"
										style={{
											background: 'rgba(255,255,255,0.03)',
											border: `1px solid ${C.border}`,
											borderRadius: '10px',
											padding: '11px 14px',
											fontSize: '13px',
											color: C.textPrimary,
											fontFamily: 'DM Sans, sans-serif',
											width: '100%',
											transition: 'border-color 0.2s, box-shadow 0.2s',
										}}
									/>
									<button
										type="button"
										onClick={() => setForm((current) => ({ ...current, password: generateStrongPassword() }))}
										style={{
											background: 'transparent',
											border: `1px solid ${C.border}`,
											borderRadius: '10px',
											padding: '11px 12px',
											color: C.textSecondary,
											cursor: 'pointer',
										}}
									>
										<ChevronDown className="h-4 w-4 rotate-180" />
									</button>
								</div>
							</div>

							<div>
								<label style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, marginBottom: '6px', fontWeight: 500, display: 'block' }}>
									Select Plan
								</label>
								<select
									required
									value={form.plan_id}
									onChange={(e) => setForm((current) => ({ ...current, plan_id: e.target.value }))}
									className="modal-input"
									style={{
										background: 'rgba(255,255,255,0.03)',
										border: `1px solid ${C.border}`,
										borderRadius: '10px',
										padding: '11px 14px',
										fontSize: '13px',
										color: C.textPrimary,
										fontFamily: 'DM Sans, sans-serif',
										width: '100%',
										transition: 'border-color 0.2s, box-shadow 0.2s',
									}}
								>
									{activePlanOptions.length === 0 ? <option value="">No plans available</option> : null}
									{activePlanOptions.map((plan) => (
										<option key={plan.id} value={plan.id}>
											{plan.name}
										</option>
									))}
								</select>
							</div>

							<div>
								<label style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, marginBottom: '6px', fontWeight: 500, display: 'block' }}>
									Start Date
								</label>
								<input
									required
									type="date"
									value={form.start_date}
									onChange={(e) => setForm((current) => ({ ...current, start_date: e.target.value }))}
									className="modal-input"
									style={{
										background: 'rgba(255,255,255,0.03)',
										border: `1px solid ${C.border}`,
										borderRadius: '10px',
										padding: '11px 14px',
										fontSize: '13px',
										color: C.textPrimary,
										fontFamily: 'DM Sans, sans-serif',
										width: '100%',
										transition: 'border-color 0.2s, box-shadow 0.2s',
									}}
								/>
							</div>

							<div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => setIsModalOpen(false)}
									onMouseEnter={(e) => {
										e.currentTarget.style.borderColor = C.borderMid;
										e.currentTarget.style.color = C.textPrimary;
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.borderColor = C.border;
										e.currentTarget.style.color = C.textSecondary;
									}}
									style={{
										background: 'transparent',
										border: `1px solid ${C.border}`,
										borderRadius: '10px',
										padding: '13px 18px',
										color: C.textSecondary,
										cursor: 'pointer',
										transition: 'all 0.2s',
									}}
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={saving}
									className="modal-primary-btn"
									style={{
										background: `linear-gradient(135deg, ${C.primary}, #5b21b6)`,
										border: 'none',
										borderRadius: '10px',
										padding: '13px',
										fontSize: '13px',
										fontWeight: 600,
										color: '#ffffff',
										cursor: 'pointer',
										boxShadow: '0 4px 20px rgba(124,58,237,0.25)',
										transition: 'all 0.2s',
										opacity: saving ? 0.6 : 1,
										width: '100%',
									}}
								>
									{saving ? 'Saving...' : 'Create Member'}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}
		</div>
	);
}
