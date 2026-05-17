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
} from 'lucide-react';

import * as apiClient from '@/lib/api';
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
						apiClient.get<Plan[]>('/plans'),
					]);

				if (!mounted) return;

				setMember(memberResponse);
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
			await apiClient.post('/subscriptions', {
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
		<div className="space-y-6">
			<div className="flex items-center gap-3">
				<Link href="/owner/members" className="inline-flex items-center gap-2 rounded-lg border border-accent px-3 py-2 text-sm text-textSecondary hover:text-textPrimary">
					<ArrowLeft className="h-4 w-4" />
					Back
				</Link>
			</div>

			<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
				<div className="rounded-xl border border-accent bg-surface p-6 space-y-6">
					<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
						<div>
							<div className="flex items-center gap-3">
								<h1 className="text-3xl font-bold text-textPrimary">{member.full_name}</h1>
								<Badge className={member.is_active ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}>
									{member.is_active ? 'Active' : 'Inactive'}
								</Badge>
							</div>
							<div className="mt-3 space-y-2 text-textSecondary">
								<div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {member.email}</div>
								<div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {member.phone || '—'}</div>
								<div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Joined {dateFormatter.format(new Date(member.joined_at))}</div>
							</div>
						</div>

						<button
							type="button"
							onClick={() => setIsEditing((state) => !state)}
							className="inline-flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-sm text-textSecondary hover:text-textPrimary"
						>
							<Pencil className="h-4 w-4" />
							Edit member
						</button>
					</div>

					{isEditing ? (
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<label className="mb-1 block text-sm text-textSecondary">Name</label>
								<input value={editForm.full_name} onChange={(event) => setEditForm((current) => ({ ...current, full_name: event.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
							</div>
							<div>
								<label className="mb-1 block text-sm text-textSecondary">Phone</label>
								<input value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
							</div>
							<div className="md:col-span-2 flex justify-end gap-3">
								<button type="button" onClick={() => setIsEditing(false)} className="rounded-lg border border-accent px-4 py-2 text-textSecondary hover:text-textPrimary">Cancel</button>
								<button type="button" onClick={handleSaveMember} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-textPrimary hover:bg-primaryHover disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
							</div>
						</div>
					) : null}
				</div>

				<div className="rounded-xl border border-accent bg-surface p-6">
					<div style={{ background: '#1a1430' }} className="rounded-lg p-4 text-center text-sm">
						<span style={{ color: '#a78bfa' }}>Scan the QR at the gym entrance to check in</span>
					</div>
				</div>
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
				<div className="space-y-6">
					{currentSubscription ? (
						<div className="rounded-xl border border-accent bg-surface p-6">
							<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
								<div>
									<div className="text-sm text-textSecondary">Current Active Subscription</div>
									<div className="mt-1 text-2xl font-semibold text-textPrimary">{currentSubscription.plan?.name ?? 'No active subscription'}</div>
									<div className="mt-2 text-textSecondary">
										{`${currentSubscription.plan.billing_cycle} • ${dateFormatter.format(new Date(currentSubscription.start_date))} - ${dateFormatter.format(new Date(currentSubscription.end_date))}`}
									</div>
									<div className={`mt-3 text-sm font-medium ${currentSubscriptionDaysRemaining <= 3 ? 'text-red-400' : 'text-textSecondary'}`}>{currentSubscriptionDaysRemaining} day{currentSubscriptionDaysRemaining === 1 ? '' : 's'} remaining</div>
								</div>

								<button type="button" onClick={() => setIsSubscriptionModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-textPrimary hover:bg-primaryHover">
									<Plus className="h-4 w-4" /> Add New Subscription
								</button>
							</div>

							<div className="mt-6">
								<div className="mb-2 flex items-center justify-between text-sm text-textSecondary">
									<span>Subscription progress</span>
									<span>{currentSubscriptionProgress}%</span>
								</div>
								<div className="h-3 rounded-full bg-background">
									<div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${currentSubscriptionProgress}%` }} />
								</div>
							</div>
						</div>
					) : (
						<div
							style={{
								background: 'rgba(255,255,255,0.03)',
								border: '1px solid rgba(255,255,255,0.08)',
								borderRadius: '16px',
								padding: '24px',
							}}
						>
							<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
								<div>
									<div className="text-sm text-textSecondary">Current Active Subscription</div>
									<div className="mt-1 text-2xl font-semibold text-textPrimary">No active subscription</div>
									<div className="mt-2 text-textSecondary">Use Add New Subscription to assign a plan</div>
								</div>

								<button type="button" onClick={() => setIsSubscriptionModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-textPrimary hover:bg-primaryHover">
									<Plus className="h-4 w-4" /> Add New Subscription
								</button>
							</div>
						</div>
					)}

					<div className="overflow-hidden rounded-xl border border-accent bg-surface">
						<table className="min-w-full text-left text-sm">
							<thead className="border-b border-accent text-textSecondary">
								<tr>
									<th className="px-4 py-3 font-medium">Plan</th>
									<th className="px-4 py-3 font-medium">Billing Cycle</th>
									<th className="px-4 py-3 font-medium">Start Date</th>
									<th className="px-4 py-3 font-medium">End Date</th>
									<th className="px-4 py-3 font-medium">Status</th>
									<th className="px-4 py-3 font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
								{subscriptions.length > 0 ? subscriptions.map((subscription) => (
									<tr key={subscription.id} className="border-b border-accent/50 last:border-b-0">
										<td className="px-4 py-3 text-textPrimary">{subscription.plan.name}</td>
										<td className="px-4 py-3 text-textSecondary">{subscription.plan.billing_cycle}</td>
										<td className="px-4 py-3 text-textSecondary">{dateFormatter.format(new Date(subscription.start_date))}</td>
										<td className="px-4 py-3 text-textSecondary">{dateFormatter.format(new Date(subscription.end_date))}</td>
										<td className="px-4 py-3">
											<Badge className={subscription.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-textSecondary/10 text-textSecondary'}>{subscription.status}</Badge>
										</td>
										<td className="px-4 py-3">
											{subscription.status === 'active' ? (
												<button
													type="button"
													onClick={() => handleCancelSubscription(subscription.id)}
													disabled={processingCancelId === subscription.id}
													className="text-red-400 border border-red-400 hover:bg-red-400/10 rounded-lg px-3 py-1 text-sm"
												>
													Cancel
												</button>
											) : null}
										</td>
									</tr>
								)) : (
									<tr>
										<td colSpan={5} className="px-4 py-10 text-center text-textSecondary">No subscription history found</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			) : null}

			{activeTab === 'payments' ? (
				<div className="space-y-6">
					<div className="flex items-center justify-between rounded-xl border border-accent bg-surface p-6">
						<h2 className="text-xl font-semibold text-textPrimary">Payments</h2>
						<button type="button" onClick={() => setIsCashModalOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-textPrimary hover:bg-primaryHover">
							<Wallet className="h-4 w-4" /> Log Cash Payment
						</button>
					</div>

					<div className="overflow-hidden rounded-xl border border-accent bg-surface">
						<table className="min-w-full text-left text-sm">
							<thead className="border-b border-accent text-textSecondary">
								<tr>
									<th className="px-4 py-3 font-medium">Member</th>
									<th className="px-4 py-3 font-medium">Amount</th>
									<th className="px-4 py-3 font-medium">Method</th>
									<th className="px-4 py-3 font-medium">Status</th>
									<th className="px-4 py-3 font-medium">Date</th>
									<th className="px-4 py-3 font-medium">Notes</th>
									<th className="px-4 py-3 font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
									{payments.length > 0 ? payments.map((payment) => (
										<tr key={payment.id} className="border-b border-accent/50 last:border-b-0">
											<td className="px-4 py-3 text-textPrimary">{payment.member_name ?? payment.member?.full_name ?? 'Unknown Member'}</td>
											<td className="px-4 py-3 text-textPrimary">{currencyFormatter.format(Number(payment.amount))}</td>
											<td className="px-4 py-3">
												<Badge className={payment.payment_method === 'cash' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400'}>{payment.payment_method}</Badge>
											</td>
											<td className="px-4 py-3">
												<Badge className={payment.payment_status === 'completed' ? 'bg-green-400/10 text-green-400' : payment.payment_status === 'failed' ? 'bg-red-400/10 text-red-400' : 'bg-textSecondary/10 text-textSecondary'}>{payment.payment_status}</Badge>
											</td>
											<td className="px-4 py-3 text-textSecondary">{dateFormatter.format(new Date(payment.paid_at ?? payment.created_at))}</td>
											<td className="px-4 py-3 text-textSecondary">{payment.notes || '—'}</td>
											<td className="px-4 py-3">
												<button
													onClick={() => handleDeletePayment(payment.id)}
													className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
													title="Delete payment log"
												>
													<Trash2 className="h-4 w-4" />
												</button>
											</td>
										</tr>
									)) : (
										<tr>
											<td colSpan={7} className="px-4 py-10 text-center text-textSecondary">No payments recorded</td>
										</tr>
									)}
							</tbody>
						</table>
					</div>
				</div>
			) : null}

			{activeTab === 'attendance' ? (
				<div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
					<div className="rounded-xl border border-accent bg-surface p-6">
						<h2 className="text-xl font-semibold text-textPrimary">Last 10 Check-Ins</h2>
						<div className="mt-5 space-y-3">
							{attendance.length > 0 ? attendance.slice(0, 10).map((entry) => (
								<div key={entry.id} className="flex items-center justify-between rounded-lg border border-accent px-4 py-3">
									<div>
										<div className="text-textPrimary">{dateFormatter.format(new Date(entry.checked_in_at))}</div>
										<div className="text-sm text-textSecondary">{timeFormatter.format(new Date(entry.checked_in_at))}</div>
									</div>
									<Badge className={entry.method === 'qr' ? 'bg-primary/10 text-primary' : 'bg-yellow-400/10 text-yellow-400'}>{entry.method}</Badge>
								</div>
							)) : (
								<div className="text-textSecondary">No attendance records found</div>
							)}
						</div>
					</div>

					<div className="rounded-xl border border-accent bg-surface p-6">
						<div className="text-sm text-textSecondary">Check-ins this month</div>
						<div className="mt-2 text-4xl font-bold text-textPrimary">{totalCheckinsThisMonth}</div>
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

