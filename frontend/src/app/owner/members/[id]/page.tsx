"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
	ArrowLeft,
	CreditCard,
	CalendarDays,
	Receipt,
	Clock3,
	Phone,
	Mail,
	User,
	Pencil,
	Plus,
	Wallet,
	Trash2,
	Lock,
	XCircle,
	DollarSign,
	CalendarCheck,
	ShieldCheck,
} from 'lucide-react';

import * as apiClient from '@/lib/api';
import { QRCode } from 'react-qrcode-logo';
import type { Member, Payment, Plan, Subscription, AttendanceLog } from '@/types';
import useUIStore from '@/store/uiStore';

type RouteParams = {
	id?: string | string[];
};

type MemberDetails = Member & {
	pin?: string;
};

type SubscriptionRecord = Subscription & {
	plan: Plan;
};

type PaymentRecord = Payment & {
	member?: Pick<Member, 'full_name'>;
	member_name?: string;
};

type AttendanceRecord = AttendanceLog;

type EditFormState = {
	full_name: string;
	phone: string;
};

type SubscriptionModalState = {
	plan_id: string;
	start_date: string;
};

type CashPaymentModalState = {
	amount: string;
	notes: string;
};

type TabKey = 'subscription' | 'payments' | 'attendance';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
	hour: '2-digit',
	minute: '2-digit',
});

const today = new Date().toISOString().slice(0, 10);

const C = {
	bg: '#030014',
	surface: 'rgba(16, 6, 35, 0.72)',
	surfaceDeep: 'rgba(16, 6, 35, 0.72)',
	glass: 'rgba(16, 6, 35, 0.72)',
	glassMid: 'rgba(255,255,255,0.06)',
	border: 'rgba(139,92,246,0.12)',
	borderMid: 'rgba(139,92,246,0.2)',
	primary: '#8B5CF6',
	primaryGlow: 'rgba(139,92,246,0.40)',
	accent: '#8B5CF6',
	green: '#22C55E',
	gold: '#FACC15',
	red: '#EF4444',
	blue: '#3b82f6',
	textPrimary: '#FFFFFF',
	textSecondary: '#D8CCFF',
	textMuted: '#8E7CC3',
};

function filterVisibleSubscriptions(subscriptions: SubscriptionRecord[] | null | undefined) {
	return (subscriptions ?? []).filter((subscription) => (subscription as { status: string }).status !== 'pending');
}

const tabLabels: Array<{ key: TabKey; label: string }> = [
	{ key: 'subscription', label: 'Subscription' },
	{ key: 'payments', label: 'Payments' },
	{ key: 'attendance', label: 'Attendance' },
];

function getDaysRemaining(endDate: string) {
	const end = new Date(endDate);
	const now = new Date();
	const endOfToday = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return Math.ceil((endOfToday.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
}

function getPercentageThrough(startDate: string, endDate: string) {
	const start = new Date(startDate).getTime();
	const end = new Date(endDate).getTime();
	const now = Date.now();
	const total = Math.max(end - start, 1);
	const elapsed = Math.min(Math.max(now - start, 0), total);
	return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
	return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${className}`}>{children}</span>;
}

function ModalShell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
			<div className="w-full max-w-2xl rounded-xl border border-accent bg-surface p-6 shadow-2xl">
				<div className="mb-6 flex items-center justify-between gap-4">
					<h3 className="text-xl font-semibold text-textPrimary">{title}</h3>
					<button type="button" onClick={onClose} className="rounded p-2 text-textSecondary hover:text-textPrimary" aria-label="Close modal">
						×
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}

export default function MemberDetailPage() {
	const params = useParams<RouteParams>();
	const router = useRouter();
	const showToast = useUIStore((state) => state.showToast);

	const memberId = Array.isArray(params.id) ? params.id[0] : params.id;

	const [member, setMember] = useState<MemberDetails | null>(null);
	const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
	const [payments, setPayments] = useState<PaymentRecord[]>([]);
	const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
	const [plans, setPlans] = useState<Plan[]>([]);
	const [loading, setLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<TabKey>('subscription');
	const [isEditing, setIsEditing] = useState(false);
	const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
	const [isCashModalOpen, setIsCashModalOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [modalSaving, setModalSaving] = useState(false);
	const [editForm, setEditForm] = useState<EditFormState>({ full_name: '', phone: '' });
	const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionModalState>({ plan_id: '', start_date: today });
	const [cashForm, setCashForm] = useState<CashPaymentModalState>({ amount: '', notes: '' });
	const [error, setError] = useState<string | null>(null);
	const [processingCancelId, setProcessingCancelId] = useState<string | null>(null);

// responsive state
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
	const check = () => setIsMobile(window.innerWidth < 768);
	check();
	window.addEventListener('resize', check);
	return () => window.removeEventListener('resize', check);
}, []);

	useEffect(() => {
		if (!memberId) return;

		let mounted = true;

		void (async () => {
			setLoading(true);
			setError(null);
				try {
					// Only completed payments shown
					// backend filters automatically so no frontend change needed
					const [memberResponse, subscriptionResponse, paymentResponse, attendanceResponse, planResponse] = await Promise.all([
						apiClient.get<MemberDetails>(`/members/${memberId}`),
						apiClient.get<SubscriptionRecord[]>(`/subscriptions/member/${memberId}`),
						apiClient.get<PaymentRecord[]>(`/payments/member/${memberId}`),
						apiClient.get<AttendanceRecord[]>(`/attendance/member/${memberId}`),
					apiClient.get<Plan[]>('/plans/'),
				]);
				if (!mounted) return;
				setMember(memberResponse);
				console.log("MEMBER DETAIL SET MEMBER:", memberResponse);
				setSubscriptions(filterVisibleSubscriptions(subscriptionResponse));
				setPayments(paymentResponse ?? []);
				setAttendance(attendanceResponse ?? []);
				setPlans(planResponse ?? []);
				setEditForm({
					full_name: memberResponse.full_name ?? '',
					phone: memberResponse.phone ?? '',
				});
				const currentPlan = subscriptionResponse?.find((sub) => sub.status === 'active') ?? subscriptionResponse?.[0];
				setSubscriptionForm((current) => ({
					...current,
					plan_id: current.plan_id || planResponse?.[0]?.id || currentPlan?.plan_id || '',
					start_date: current.start_date || today,
				}));
				setCashForm((current) => ({
					...current,
					amount: current.amount || String(currentPlan?.plan?.price ?? planResponse?.[0]?.price ?? 0),
				}));
			} catch {
				if (!mounted) return;
				setError('Failed to load member details');
			} finally {
				if (mounted) setLoading(false);
			}
		})();

		return () => {
			mounted = false;
		};
	}, [memberId]);

	const handleCancelSubscription = async (subscriptionId: string) => {
		if (!window.confirm('Cancel this subscription? The member will lose access.')) return;
		setProcessingCancelId(subscriptionId);
		try {
			await apiClient.put(`/subscriptions/${subscriptionId}/cancel`);
			showToast('Subscription cancelled', 'success');
			// refresh subscriptions
			const updated = await apiClient.get<SubscriptionRecord[]>(`/subscriptions/member/${memberId}`);
			setSubscriptions(filterVisibleSubscriptions(updated));
		} catch (err) {
			console.error('Failed to cancel subscription:', err);
			showToast('Failed to cancel subscription', 'error');
		} finally {
			setProcessingCancelId(null);
		}
	};

	const currentSubscription = useMemo(() => {
		return subscriptions.find((subscription) => subscription.status === 'active') ?? null;
	}, [subscriptions]);

	const currentPlanPrice = currentSubscription?.plan?.price ?? plans[0]?.price ?? 0;
	const currentSubscriptionDaysRemaining = currentSubscription ? getDaysRemaining(currentSubscription.end_date) : 0;
	const currentSubscriptionProgress = currentSubscription ? getPercentageThrough(currentSubscription.start_date, currentSubscription.end_date) : 0;
	const totalCheckinsThisMonth = useMemo(() => {
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

		return attendance.filter((entry) => {
			const time = new Date(entry.checked_in_at);
			return time >= startOfMonth && time <= endOfMonth;
		}).length;
	}, [attendance]);

	const lastSeenAt = useMemo(() => {
		if (attendance.length === 0) return null;
		return attendance
			.map((entry) => new Date(entry.checked_in_at))
			.sort((a, b) => b.getTime() - a.getTime())[0];
	}, [attendance]);

	const totalRevenue = useMemo(() => {
		return payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
	}, [payments]);

	const paymentsByMonth = useMemo(() => {
		const groups = new Map<string, PaymentRecord[]>();
		const sorted = [...payments].sort((a, b) => new Date(b.paid_at ?? b.created_at).getTime() - new Date(a.paid_at ?? a.created_at).getTime());
		for (const payment of sorted) {
			const key = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(payment.paid_at ?? payment.created_at));
			const list = groups.get(key) ?? [];
			list.push(payment);
			groups.set(key, list);
		}
		return Array.from(groups.entries());
	}, [payments]);

	const weeklyCounts = useMemo(() => {
		const now = new Date();
		const day = now.getDay();
		const mondayOffset = day === 0 ? -6 : 1 - day;
		const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
		const days = Array.from({ length: 7 }, (_, i) => {
			const d = new Date(weekStart);
			d.setDate(weekStart.getDate() + i);
			return d;
		});
		return days.map((d) => {
			const count = attendance.filter((entry) => {
				const at = new Date(entry.checked_in_at);
				return at.getFullYear() === d.getFullYear() && at.getMonth() === d.getMonth() && at.getDate() === d.getDate();
			}).length;
			return count;
		});
	}, [attendance]);

	const consistencyLabel = useMemo(() => {
		if (totalCheckinsThisMonth >= 12) return 'Regular';
		if (totalCheckinsThisMonth >= 4) return 'Irregular';
		return 'Inactive';
	}, [totalCheckinsThisMonth]);

	const streakDays = useMemo(() => {
		if (attendance.length === 0) return 0;
		const uniqueDays = Array.from(
			new Set(attendance.map((entry) => {
				const d = new Date(entry.checked_in_at);
				return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
			}))
		)
			.map((token) => {
				const [y, m, d] = token.split('-').map(Number);
				return new Date(y, m, d);
			})
			.sort((a, b) => b.getTime() - a.getTime());

		let streak = 0;
		let expected = new Date();
		expected = new Date(expected.getFullYear(), expected.getMonth(), expected.getDate());
		for (const day of uniqueDays) {
			const normalized = new Date(day.getFullYear(), day.getMonth(), day.getDate());
			if (normalized.getTime() === expected.getTime()) {
				streak += 1;
				expected.setDate(expected.getDate() - 1);
			} else if (normalized.getTime() < expected.getTime()) {
				break;
			}
		}
		return streak;
	}, [attendance]);

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="h-10 animate-pulse rounded-lg bg-surface" />
				<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
					<div className="rounded-xl border border-accent bg-surface p-6">
						<div className="h-48 animate-pulse rounded-lg bg-background/60" />
					</div>
					<div className="rounded-xl border border-accent bg-surface p-6">
						<div className="h-48 animate-pulse rounded-lg bg-background/60" />
					</div>
				</div>
			</div>
		);
	}
    
	console.log("MEMBER DETAIL RENDER STATE:", { loading, error, member });

	
	if (error || !member) {
		return <div className="rounded-xl border border-accent bg-surface p-6 text-textSecondary">{error ?? 'Member not found'}</div>;
	}

	const handleSaveMember = async () => {
		setSaving(true);
		try {
			const updated = await apiClient.put<MemberDetails>(`/members/${memberId}`, {
				full_name: editForm.full_name,
				phone: editForm.phone || null,
			});
			setMember(updated);
			setIsEditing(false);
			showToast('Member updated successfully', 'success');
		} catch {
			showToast('Failed to update member', 'error');
		} finally {
			setSaving(false);
		}
	};

	const handleSubscriptionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setModalSaving(true);
		try {
			await apiClient.post('/subscriptions/', {
				member_id: memberId,
				plan_id: subscriptionForm.plan_id,
				start_date: subscriptionForm.start_date,
				status: 'active',
			});
			showToast('Subscription added successfully', 'success');
			setIsSubscriptionModalOpen(false);
			const nextSubscriptions = await apiClient.get<SubscriptionRecord[]>(`/subscriptions/member/${memberId}`);
			setSubscriptions(filterVisibleSubscriptions(nextSubscriptions));
		} catch {
			showToast('Failed to add subscription', 'error');
		} finally {
			setModalSaving(false);
		}
	};

	const handleCashPaymentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setModalSaving(true);
		try {
			await apiClient.post('/payments/cash', {
				member_id: memberId,
				subscription_id: currentSubscription?.id ?? null,
				amount: Number(cashForm.amount),
				notes: cashForm.notes,
			});
			showToast('Cash payment logged successfully', 'success');
			setIsCashModalOpen(false);
			const nextPayments = await apiClient.get<PaymentRecord[]>(`/payments/member/${memberId}`);
			setPayments(nextPayments ?? []);
		} catch {
			showToast('Failed to log cash payment', 'error');
		} finally {
			setModalSaving(false);
		}
	};

	const handleDeletePayment = async (paymentId: string) => {
		const confirmed = window.confirm('Delete this payment log? This cannot be undone.');
		if (!confirmed) return;
		try {
			await apiClient.del(`/payments/${paymentId}`);
			showToast('Payment log deleted', 'success');
			setPayments((prev) => prev.filter((p) => p.id !== paymentId));
		} catch (err) {
			console.error('Failed to delete payment:', err);
			showToast('Failed to delete payment log', 'error');
		}
	};

	return (
		<div style={{ fontFamily: 'DM Sans, sans-serif', color: C.textPrimary, padding: isMobile ? '24px 16px 64px' : '32px 32px 80px', display: 'flex', flexDirection: 'column', gap: 28, background: C.bg }}>
			<style jsx global>{`
				@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

				@keyframes fadeInUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
				@keyframes qrPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.0); } 50% { box-shadow: 0 0 0 8px rgba(124,58,237,0.08); } }
				@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

				.tab-btn { transition: all 0.2s ease; }
				.table-row { transition: background 0.15s ease; }
				.table-row:hover { background: rgba(124,58,237,0.03) !important; }
			`}</style>

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
					onClick={() => router.push('/owner/members')}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 10,
						background: 'transparent',
						border: '1px solid rgba(139,92,246,0.25)',
						borderRadius: '20px',
						padding: '6px 16px',
						cursor: 'pointer',
						color: '#8B5CF6',
						fontSize: 14,
						transition: 'background 0.2s ease',
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = 'rgba(139,92,246,0.08)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = 'transparent';
					}}
				>
					<ArrowLeft className="h-4 w-4" style={{ color: '#D8CCFF' }} />
					<span>Back to Members</span>
				</button>
			</div>

			<div style={{ animation: 'fadeInUp 0.4s ease 60ms both' }}>
				<div className="flex items-start gap-5" style={{ flexDirection: isMobile ? 'column' : 'row' }}>
					<div
						style={{
							width: 92,
							height: 92,
							borderRadius: '50%',
							padding: 3,
							background: 'linear-gradient(135deg, rgba(139,92,246,0.95), rgba(139,92,246,0.2))',
							boxShadow: `0 0 35px ${C.primaryGlow}`,
							flexShrink: 0,
						}}
					>
						<div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(16, 6, 35, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
							{member.profile_photo_url ? (
								<img src={member.profile_photo_url} alt={member.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
							) : (
								<span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 42, color: C.primary }}>{member.full_name.slice(0, 1).toUpperCase()}</span>
							)}
						</div>
					</div>

					<div style={{ flex: 1, minWidth: 0 }}>
						<div className="flex items-start justify-between gap-3" style={{ flexWrap: 'wrap' }}>
							<div>
								<div style={{ fontSize: isMobile ? 28 : 36, lineHeight: 1, fontWeight: 700, color: C.textPrimary }}>{member.full_name}</div>
								<div style={{ marginTop: 6, fontSize: 13, color: C.textMuted }}>
									{currentSubscription?.plan?.name ? `Plan: ${currentSubscription.plan.name}` : 'No plan assigned'}
								</div>
							</div>
							<span
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									borderRadius: 999,
									padding: '5px 12px',
									fontSize: 11,
									fontWeight: 600,
									background: currentSubscriptionDaysRemaining < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
									color: currentSubscriptionDaysRemaining < 0 ? C.red : C.green,
									border: `1px solid ${currentSubscriptionDaysRemaining < 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
								}}
							>
								{currentSubscriptionDaysRemaining < 0 ? 'Expired' : 'Active'}
							</span>
						</div>

						<div className="mt-4 flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
							<div style={{ borderRadius: 999, padding: '7px 12px', background: 'rgba(16,6,35,0.65)', border: `1px solid ${C.border}`, fontSize: 12, color: C.textSecondary }}>
								Joined {dateFormatter.format(new Date(member.joined_at))}
							</div>
							<div style={{ borderRadius: 999, padding: '7px 12px', background: 'rgba(16,6,35,0.65)', border: `1px solid ${C.border}`, fontSize: 12, color: C.textSecondary }}>
								{attendance.length} total visits
							</div>
							<div style={{ borderRadius: 999, padding: '7px 12px', background: 'rgba(16,6,35,0.65)', border: `1px solid ${C.border}`, fontSize: 12, color: C.textSecondary }}>
								Last seen {lastSeenAt ? dateFormatter.format(lastSeenAt) : 'Never'}
							</div>
						</div>

						<div className="mt-4 grid gap-2 md:grid-cols-2">
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textSecondary }}><Mail className="h-4 w-4" /> <span style={{ fontSize: 13 }}>{member.email}</span></div>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textSecondary }}><Phone className="h-4 w-4" /> <span style={{ fontSize: 13 }}>{member.phone || 'No phone on record'}</span></div>
						</div>

						{isEditing ? (
							<div className="mt-4 grid gap-3 md:grid-cols-2" style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 16 }}>
								<div>
									<label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: C.textMuted }}>Name</label>
									<input value={editForm.full_name} onChange={(event) => setEditForm((current) => ({ ...current, full_name: event.target.value }))} style={{ width: '100%', borderRadius: 12, border: `1px solid ${C.border}`, background: 'rgba(3,0,20,0.4)', padding: '9px 12px', color: C.textPrimary }} />
								</div>
								<div>
									<label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: C.textMuted }}>Phone</label>
									<input value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} style={{ width: '100%', borderRadius: 12, border: `1px solid ${C.border}`, background: 'rgba(3,0,20,0.4)', padding: '9px 12px', color: C.textPrimary }} />
								</div>
								<div className="md:col-span-2 flex justify-end gap-2">
									<button type="button" onClick={() => setIsEditing(false)} style={{ borderRadius: 999, border: `1px solid ${C.border}`, padding: '7px 12px', color: C.textSecondary }}>Cancel</button>
									<button type="button" onClick={handleSaveMember} disabled={saving} style={{ borderRadius: 999, border: 'none', background: C.primary, padding: '7px 12px', color: C.textPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save'}</button>
								</div>
							</div>
						) : (
							<div className="mt-4">
								<button type="button" onClick={() => setIsEditing(true)} style={{ borderRadius: 999, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, padding: '7px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
									<Pencil className="h-4 w-4" /> Edit member
								</button>
							</div>
						)}
					</div>
				</div>

				<details style={{ marginTop: 20 }}>
					<summary style={{ listStyle: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${C.border}`, borderRadius: 999, padding: '8px 14px', color: C.textSecondary, background: 'rgba(16,6,35,0.45)' }}>
						<ShieldCheck className="h-4 w-4" /> Access & Security
					</summary>
					<div style={{ marginTop: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: isMobile ? 14 : 20 }}>
						<div className="grid gap-5 md:grid-cols-[220px_1fr]">
							<div style={{ display: 'flex', justifyContent: 'center' }}>
								<div style={{ padding: 4, borderRadius: 16, background: 'linear-gradient(135deg, rgba(139,92,246,0.5), rgba(139,92,246,0.15))' }}>
									<div style={{ background: '#ffffff', borderRadius: 13, padding: 14 }}>
										{member.qr_code ? (
											<QRCode value={member.qr_code} size={150} bgColor="#ffffff" fgColor="#0d0d14" qrStyle="dots" />
										) : (
											<div style={{ width: 150, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: C.textMuted }}>
												<Lock className="h-5 w-5" />
												<span style={{ fontSize: 11 }}>QR not assigned</span>
											</div>
										)}
									</div>
								</div>
							</div>
							<div>
								<div style={{ fontSize: 12, color: member.qr_code ? C.green : C.textMuted }}>{member.qr_code ? 'Ready for check-in' : 'QR not yet assigned'}</div>
								<div className="mt-3" style={{ fontSize: 12, color: C.textMuted }}>PIN</div>
								<div className="mt-2 flex gap-2">
									{member.pin ? (
										member.pin.split('').map((digit, i) => (
											<div key={i} style={{ width: 34, height: 40, borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(3,0,20,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', color: C.primary }}>
												{digit}
											</div>
										))
									) : (
										<div style={{ fontSize: 12, color: C.textMuted }}>No PIN assigned</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</details>
			</div>

			<div className="rounded-xl border border-accent bg-surface p-2">
				<div className="flex flex-wrap gap-2">
					{tabLabels.map((tab) => (
						<button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-primary/10 text-primary' : 'text-textSecondary hover:text-textPrimary'}`}>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{activeTab === 'subscription' ? (
				<div className="space-y-5" style={{ animation: 'fadeInUp 0.35s ease both' }}>
					{currentSubscription ? (
						<div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: isMobile ? 16 : 24 }}>
							<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
								<div>
									<div style={{ fontSize: 30, lineHeight: 1, color: C.textPrimary, fontWeight: 700 }}>{currentSubscription.plan?.name ?? 'No active subscription'}</div>
									<div className="mt-2" style={{ fontSize: 13, color: C.textSecondary }}>{currencyFormatter.format(currentPlanPrice)} • {currentSubscription.plan.billing_cycle}</div>
									<div className="mt-2" style={{ fontSize: 12, color: C.textMuted }}>
										{dateFormatter.format(new Date(currentSubscription.start_date))} → {dateFormatter.format(new Date(currentSubscription.end_date))}
									</div>
									<div className="mt-3">
										<span style={{ borderRadius: 999, padding: '4px 10px', fontSize: 11, background: currentSubscription.status === 'active' ? 'rgba(34,197,94,0.14)' : 'rgba(142,124,195,0.16)', color: currentSubscription.status === 'active' ? C.green : C.textMuted }}>
											{currentSubscription.status.toUpperCase()}
										</span>
									</div>
								</div>

								<div style={{ textAlign: isMobile ? 'left' : 'right' }}>
									<div style={{ fontSize: 48, lineHeight: 1, fontWeight: 700, color: currentSubscriptionDaysRemaining > 30 ? C.green : currentSubscriptionDaysRemaining >= 0 ? C.gold : C.red }}>
										{Math.max(currentSubscriptionDaysRemaining, 0)}
									</div>
									<div style={{ fontSize: 11, letterSpacing: '0.14em', color: C.textMuted }}>DAYS REMAINING</div>
								</div>
							</div>

							<div className="mt-4" style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}>
								<div style={{ width: `${currentSubscriptionProgress}%`, height: 4, borderRadius: 999, background: `linear-gradient(90deg, ${C.primary}, #c4b5fd)` }} />
							</div>

							<div className="mt-4 flex justify-end">
								<button
									type="button"
									onClick={() => handleCancelSubscription(currentSubscription.id)}
									disabled={processingCancelId === currentSubscription.id}
									style={{ borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: C.red, padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
								>
									<XCircle className="h-3.5 w-3.5" /> Cancel Subscription
								</button>
							</div>
						</div>
					) : (
						<div style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.35)', borderRadius: 24, padding: isMobile ? 16 : 24 }}>
							<div style={{ fontSize: 20, color: C.textPrimary, fontWeight: 600 }}>No Active Subscription</div>
							<div className="mt-2" style={{ fontSize: 13, color: C.textSecondary }}>This member does not have a current plan.</div>
							<button type="button" onClick={() => setIsSubscriptionModalOpen(true)} className="mt-4 inline-flex items-center gap-2" style={{ borderRadius: 12, border: '1px solid rgba(250,204,21,0.45)', background: 'rgba(250,204,21,0.12)', color: C.gold, padding: '9px 14px', fontSize: 13 }}>
								<Plus className="h-4 w-4" /> Assign a Plan
							</button>
						</div>
					)}

					<div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: isMobile ? 16 : 20 }}>
						<div style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 12, letterSpacing: '0.05em' }}>Membership Timeline</div>
						{subscriptions.length > 0 ? (
							<div className="space-y-3">
								{subscriptions.map((subscription) => (
									<div key={subscription.id} style={{ border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, background: 'rgba(3,0,20,0.35)' }}>
										<div className="flex items-center justify-between gap-3" style={{ flexWrap: 'wrap' }}>
											<div>
												<div style={{ color: C.textPrimary, fontWeight: 600 }}>{subscription.plan.name}</div>
												<div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
													{dateFormatter.format(new Date(subscription.start_date))} → {dateFormatter.format(new Date(subscription.end_date))}
												</div>
											</div>
											<div className="flex items-center gap-2">
												<span style={{ borderRadius: 999, padding: '4px 10px', fontSize: 11, background: subscription.status === 'active' ? 'rgba(34,197,94,0.14)' : subscription.status === 'cancelled' ? 'rgba(239,68,68,0.14)' : 'rgba(250,204,21,0.14)', color: subscription.status === 'active' ? C.green : subscription.status === 'cancelled' ? C.red : C.gold }}>{subscription.status}</span>
												{subscription.status === 'active' ? (
													<button
														type="button"
														onClick={() => handleCancelSubscription(subscription.id)}
														disabled={processingCancelId === subscription.id}
														style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
														title="Cancel subscription"
													>
														<XCircle className="h-3.5 w-3.5" />
													</button>
												) : null}
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div style={{ fontSize: 13, color: C.textMuted }}>No memberships found yet.</div>
						)}
					</div>
				</div>
			) : null}

			{activeTab === 'payments' ? (
				<div className="space-y-5" style={{ animation: 'fadeInUp 0.35s ease both' }}>
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: isMobile ? 16 : 20 }}>
						<div>
							<div style={{ fontSize: 12, color: C.textMuted }}>Total Revenue</div>
							<div style={{ fontSize: 40, lineHeight: 1, fontWeight: 700, color: C.textPrimary }}>{currencyFormatter.format(totalRevenue)}</div>
						</div>
						<button type="button" onClick={() => setIsCashModalOpen(true)} style={{ borderRadius: 999, border: `1px solid ${C.border}`, background: 'transparent', color: C.textSecondary, padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
							<DollarSign className="h-4 w-4" /> Log Payment
						</button>
					</div>

					<div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: isMobile ? 16 : 20 }}>
						{paymentsByMonth.length > 0 ? (
							<div className="space-y-5">
								{paymentsByMonth.map(([month, monthPayments]) => (
									<div key={month}>
										<div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>{month}</div>
										<div className="space-y-2">
											{monthPayments.map((payment) => (
												<div key={payment.id} className="flex items-center justify-between gap-3" style={{ border: `1px solid ${C.border}`, borderRadius: 16, padding: '12px 14px', background: 'rgba(3,0,20,0.38)', flexWrap: 'wrap' }}>
													<div>
														<div style={{ fontSize: 28, lineHeight: 1, fontWeight: 700, color: C.textPrimary }}>{currencyFormatter.format(Number(payment.amount))}</div>
														<div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{dateFormatter.format(new Date(payment.paid_at ?? payment.created_at))}</div>
													</div>
													<div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
														<span style={{ borderRadius: 999, padding: '4px 10px', fontSize: 11, background: payment.payment_method === 'cash' ? 'rgba(250,204,21,0.14)' : 'rgba(59,130,246,0.14)', color: payment.payment_method === 'cash' ? C.gold : C.blue }}>{payment.payment_method}</span>
														<span style={{ borderRadius: 999, padding: '4px 10px', fontSize: 11, background: payment.payment_status === 'completed' ? 'rgba(34,197,94,0.14)' : payment.payment_status === 'pending' ? 'rgba(250,204,21,0.14)' : 'rgba(239,68,68,0.14)', color: payment.payment_status === 'completed' ? C.green : payment.payment_status === 'pending' ? C.gold : C.red }}>{payment.payment_status}</span>
														<button onClick={() => handleDeletePayment(payment.id)} title="Delete payment log" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'transparent', color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
															<Trash2 className="h-4 w-4" />
														</button>
													</div>
													{payment.notes ? <div style={{ width: '100%', fontSize: 12, color: C.textMuted, fontStyle: 'italic' }}>{payment.notes.length > 30 ? `${payment.notes.slice(0, 30)}...` : payment.notes}</div> : null}
												</div>
											))}
										</div>
									</div>
								))}
							</div>
						) : (
							<div style={{ textAlign: 'center', padding: '32px 12px' }}>
								<div style={{ width: 52, height: 52, borderRadius: '50%', border: `1px solid ${C.border}`, background: 'rgba(139,92,246,0.08)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
									<Receipt className="h-5 w-5" style={{ color: C.textMuted }} />
								</div>
								<div style={{ color: C.textPrimary, fontWeight: 600 }}>No Payments Yet</div>
								<div style={{ color: C.textMuted, fontSize: 13, marginTop: 5 }}>Payments will appear here after transactions</div>
							</div>
						)}
					</div>
				</div>
			) : null}

			{activeTab === 'attendance' ? (
				<div className="space-y-5" style={{ animation: 'fadeInUp 0.35s ease both' }}>
					<div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: isMobile ? 16 : 20 }}>
						<div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
							<div>
								<div style={{ fontSize: 12, color: C.textMuted }}>Activity</div>
								<div style={{ fontSize: 42, lineHeight: 1, fontWeight: 700, color: C.textPrimary }}>{streakDays > 0 ? `${streakDays} day streak` : `${totalCheckinsThisMonth} visits this month`}</div>
							</div>
							<div style={{ fontSize: 13, color: C.textSecondary }}>Consistency: <span style={{ color: consistencyLabel === 'Regular' ? C.green : consistencyLabel === 'Irregular' ? C.gold : C.red }}>{consistencyLabel}</span></div>
						</div>

						<div className="mt-4 grid gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
							{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
								const count = weeklyCounts[idx] ?? 0;
								const barHeight = Math.max(8, Math.min(52, count * 14));
								return (
									<div key={day} className="flex flex-col items-center gap-1">
										<div style={{ width: '100%', height: 56, borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(3,0,20,0.35)', display: 'flex', alignItems: 'flex-end', padding: '4px' }}>
											<div style={{ width: '100%', height: barHeight, borderRadius: 8, background: C.primary, opacity: count > 0 ? 1 : 0.2 }} />
										</div>
										<div style={{ fontSize: 11, color: C.textMuted }}>{day}</div>
									</div>
								);
							})}
						</div>
					</div>

					<div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', padding: isMobile ? 16 : 20 }}>
						<div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 12, fontWeight: 600 }}>Recent Check-ins</div>
						{attendance.length > 0 ? (
							<div className="space-y-2">
								{attendance.slice(0, 10).map((entry) => (
									<div key={entry.id} className="flex items-center justify-between gap-3" style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: 'rgba(3,0,20,0.35)', padding: '10px 12px' }}>
										<div>
											<div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>{dateFormatter.format(new Date(entry.checked_in_at))}</div>
											<div style={{ fontSize: 12, color: C.textMuted }}>{timeFormatter.format(new Date(entry.checked_in_at))}</div>
										</div>
										<span style={{ borderRadius: 999, padding: '4px 9px', fontSize: 11, background: entry.method === 'qr' ? 'rgba(139,92,246,0.14)' : 'rgba(142,124,195,0.16)', color: entry.method === 'qr' ? C.primary : C.textSecondary }}>
											{entry.method === 'qr' ? 'QR Scan' : 'PIN'}
										</span>
									</div>
								))}
							</div>
						) : (
							<div style={{ textAlign: 'center', padding: '28px 8px' }}>
								<div style={{ width: 52, height: 52, borderRadius: '50%', border: `1px solid ${C.border}`, background: 'rgba(139,92,246,0.08)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
									<CalendarCheck className="h-5 w-5" style={{ color: C.textMuted }} />
								</div>
								<div style={{ color: C.textPrimary, fontWeight: 600 }}>No Check-ins Yet</div>
								<div style={{ color: C.textMuted, fontSize: 13, marginTop: 5 }}>Attendance will be recorded when member scans the QR</div>
							</div>
						)}
					</div>
				</div>
			) : null}

			{isSubscriptionModalOpen ? (
				<ModalShell title="Add New Subscription" onClose={() => setIsSubscriptionModalOpen(false)}>
					<form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubscriptionSubmit}>
						<div>
							<label className="mb-1 block text-sm text-textSecondary">Select Plan</label>
							<select required value={subscriptionForm.plan_id} onChange={(event) => setSubscriptionForm((current) => ({ ...current, plan_id: event.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary">
								<option value="">Select a plan</option>
								{plans.map((plan) => (
									<option key={plan.id} value={plan.id}>{plan.name}</option>
								))}
							</select>
						</div>

						<div>
							<label className="mb-1 block text-sm text-textSecondary">Start Date</label>
							<input type="date" value={subscriptionForm.start_date} onChange={(event) => setSubscriptionForm((current) => ({ ...current, start_date: event.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
						</div>

						<div className="md:col-span-2 flex justify-end gap-3">
							<button type="button" onClick={() => setIsSubscriptionModalOpen(false)} className="rounded-lg border border-accent px-4 py-2 text-textSecondary hover:text-textPrimary">Cancel</button>
							<button type="submit" disabled={modalSaving} className="rounded-lg bg-primary px-4 py-2 text-textPrimary hover:bg-primaryHover disabled:opacity-60">{modalSaving ? 'Saving...' : 'Create Subscription'}</button>
						</div>
					</form>
				</ModalShell>
			) : null}

			{isCashModalOpen ? (
				<ModalShell title="Log Cash Payment" onClose={() => setIsCashModalOpen(false)}>
					<form className="grid gap-4" onSubmit={handleCashPaymentSubmit}>
						<div>
							<label className="mb-1 block text-sm text-textSecondary">Amount</label>
							<input type="number" required value={cashForm.amount} onChange={(event) => setCashForm((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
						</div>
						<div>
							<label className="mb-1 block text-sm text-textSecondary">Notes</label>
							<textarea value={cashForm.notes} onChange={(event) => setCashForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" rows={4} />
						</div>
						<div className="flex justify-end gap-3">
							<button type="button" onClick={() => setIsCashModalOpen(false)} className="rounded-lg border border-accent px-4 py-2 text-textSecondary hover:text-textPrimary">Cancel</button>
							<button type="submit" disabled={modalSaving} className="rounded-lg bg-primary px-4 py-2 text-textPrimary hover:bg-primaryHover disabled:opacity-60">{modalSaving ? 'Saving...' : 'Record Payment'}</button>
						</div>
					</form>
				</ModalShell>
			) : null}
		</div>
	);
}

