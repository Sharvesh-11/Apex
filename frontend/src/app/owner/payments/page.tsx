"use client";

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X, Trash2 } from 'lucide-react';
import PaymentForm, { CashPaymentData } from '@/components/owner/PaymentForm';

import * as apiClient from '@/lib/api';
import type { Member, Payment, Subscription } from '@/types';
import useUIStore from '@/store/uiStore';

type PaymentRecord = Payment & {
	member?: Pick<Member, 'full_name' | 'email'>;
};

type CashPaymentFormState = {
	member_id: string;
	subscription_id: string;
	amount: string;
	notes: string;
};

type FilterMethod = 'all' | 'cash' | 'razorpay';
type FilterStatus = 'all' | 'completed' | 'pending' | 'failed';

const skeletonRows = Array.from({ length: 6 });

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

const today = new Date();

const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

export default function OwnerPaymentsPage() {
	const showToast = useUIStore((state) => state.showToast);
	const [payments, setPayments] = useState<PaymentRecord[]>([]);
	const [members, setMembers] = useState<Member[]>([]);
	const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState('');
	const [methodFilter, setMethodFilter] = useState<FilterMethod>('all');
	const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
	const [fromDate, setFromDate] = useState('');
	const [toDate, setToDate] = useState('');
	const [form, setForm] = useState<CashPaymentFormState>({
		member_id: '',
		subscription_id: '',
		amount: '',
		notes: '',
	});

	useEffect(() => {
		let mounted = true;

		void (async () => {
			setLoading(true);
			setError(null);
			try {
				const [paymentsResponse, membersResponse, subscriptionsResponse] = await Promise.all([
					apiClient.get<PaymentRecord[]>('/payments'),
					apiClient.get<Member[]>('/members'),
					apiClient.get<Subscription[]>('/subscriptions/active'),
				]);

				if (!mounted) return;

				setPayments(paymentsResponse ?? []);
				setMembers(membersResponse ?? []);
				setSubscriptions(subscriptionsResponse ?? []);
				setForm((current) => ({
					...current,
					member_id: current.member_id || membersResponse?.[0]?.id || '',
					subscription_id: current.subscription_id || subscriptionsResponse?.[0]?.id || '',
					amount: current.amount || String(subscriptionsResponse?.[0]?.plan?.price ?? ''),
				}));
			} catch {
				if (!mounted) return;
				setError('Failed to load payments');
			} finally {
				if (mounted) setLoading(false);
			}
		})();

		return () => {
			mounted = false;
		};
	}, []);

	const summary = useMemo(() => {
		const totalRevenue = payments.reduce((sum, payment) => {
			return payment.payment_status === 'completed' ? sum + Number(payment.amount || 0) : sum;
		}, 0);

		const thisMonthRevenue = payments.reduce((sum, payment) => {
			const paidAt = new Date(payment.paid_at ?? payment.created_at);
			const inMonth = paidAt >= startOfMonth && paidAt <= endOfMonth;
			return payment.payment_status === 'completed' && inMonth ? sum + Number(payment.amount || 0) : sum;
		}, 0);

		const pendingCount = payments.filter((payment) => payment.payment_status === 'pending').length;

		return { totalRevenue, thisMonthRevenue, pendingCount };
	}, [payments]);

	const filteredPayments = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();
		return payments.filter((payment) => {
			const memberName = payment.member?.full_name ?? '';
			const paymentDate = new Date(payment.paid_at ?? payment.created_at);
			const matchesSearch = !normalizedSearch || memberName.toLowerCase().includes(normalizedSearch);
			const matchesMethod = methodFilter === 'all' || payment.payment_method === methodFilter;
			const matchesStatus = statusFilter === 'all' || payment.payment_status === statusFilter;
			const matchesFrom = !fromDate || paymentDate >= new Date(fromDate);
			const matchesTo = !toDate || paymentDate <= new Date(`${toDate}T23:59:59.999`);

			return matchesSearch && matchesMethod && matchesStatus && matchesFrom && matchesTo;
		});
	}, [payments, search, methodFilter, statusFilter, fromDate, toDate]);

	const activeMembers = useMemo(() => members.filter((member) => member.is_active), [members]);
	const selectedMemberSubscriptions = useMemo(
		() => subscriptions.filter((subscription) => subscription.member_id === form.member_id),
		[subscriptions, form.member_id],
	);

	useEffect(() => {
		if (!form.member_id || selectedMemberSubscriptions.length === 0) return;
		const nextSubscription = selectedMemberSubscriptions[0];
		setForm((current) => ({
			...current,
			subscription_id: current.subscription_id || nextSubscription.id,
			amount: current.amount || String(nextSubscription.plan.price),
		}));
	}, [form.member_id, selectedMemberSubscriptions]);

	const refreshPayments = async () => {
		const nextPayments = await apiClient.get<PaymentRecord[]>('/payments');
		setPayments(nextPayments ?? []);
	};

	const openModal = () => {
		const firstMember = members[0];
		const firstSubscription = subscriptions.find((subscription) => subscription.member_id === firstMember?.id) ?? subscriptions[0];

		setForm({
			member_id: firstMember?.id ?? '',
			subscription_id: firstSubscription?.id ?? '',
			amount: String(firstSubscription?.plan?.price ?? ''),
			notes: '',
		});
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setForm({ member_id: '', subscription_id: '', amount: '', notes: '' });
	};

	const handleCashPayment = async (data: CashPaymentData) => {
		setSaving(true);
		try {
			await apiClient.post('/payments/cash/', data);
			showToast('Cash payment logged successfully', 'success');
			setIsModalOpen(false);
			await refreshPayments();
		} catch (err) {
			showToast('Failed to log cash payment', 'error');
			throw err;
		} finally {
			setSaving(false);
		}
	};

	const handleDeletePayment = async (paymentId: string) => {
		const confirmed = window.confirm(
			"Delete this payment log? This cannot be undone."
		);
		if (!confirmed) return;
		try {
			await apiClient.del(`/payments/${paymentId}`);
			showToast("Payment log deleted", "success");
			setPayments((prev) => prev.filter((p) => p.id !== paymentId));
		} catch {
			showToast("Failed to delete payment log", "error");
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<h1 className="text-3xl font-bold text-textPrimary">Payments</h1>
				<button type="button" onClick={openModal} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-textPrimary hover:bg-primaryHover">
					<Plus className="h-4 w-4" />
					Log Cash Payment
				</button>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<div className="rounded-xl border border-accent bg-surface p-6">
					<div className="text-sm text-textSecondary">Total Revenue</div>
					<div className="mt-2 text-3xl font-bold text-textPrimary">{currencyFormatter.format(summary.totalRevenue)}</div>
				</div>
				<div className="rounded-xl border border-accent bg-surface p-6">
					<div className="text-sm text-textSecondary">This Month Revenue</div>
					<div className="mt-2 text-3xl font-bold text-textPrimary">{currencyFormatter.format(summary.thisMonthRevenue)}</div>
				</div>
				<div className="rounded-xl border border-accent bg-surface p-6">
					<div className="text-sm text-textSecondary">Pending Payments</div>
					<div className="mt-2 text-3xl font-bold text-textPrimary">{summary.pendingCount}</div>
				</div>
			</div>

			<div className="rounded-xl border border-accent bg-surface p-6 space-y-4">
				<div className="grid gap-4 lg:grid-cols-4">
					<div className="relative lg:col-span-1">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
						<input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by member name" className="w-full rounded-lg border border-accent bg-background py-2 pl-10 pr-4 text-textPrimary outline-none placeholder:text-textSecondary focus:border-primary" />
					</div>

					<select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as FilterMethod)} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary">
						<option value="all">All Methods</option>
						<option value="cash">Cash</option>
						<option value="razorpay">Razorpay</option>
					</select>

					<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FilterStatus)} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary">
						<option value="all">All Statuses</option>
						<option value="completed">Completed</option>
						<option value="pending">Pending</option>
						<option value="failed">Failed</option>
					</select>

					<div className="grid grid-cols-2 gap-3">
						<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
						<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
					</div>
				</div>
			</div>

			{error ? <div className="rounded-xl border border-accent bg-surface p-4 text-textSecondary">{error}</div> : null}

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
						{loading ? (
							skeletonRows.map((_, index) => (
								<tr key={index} className="border-b border-accent/50 last:border-b-0">
									{Array.from({ length: 7 }).map((__, cellIndex) => (
										<td key={cellIndex} className="px-4 py-4">
											<div className="h-4 animate-pulse rounded bg-background/60" />
										</td>
									))}
								</tr>
							))
						) : filteredPayments.length > 0 ? (
							filteredPayments.map((payment) => {
								const methodClass = payment.payment_method === 'cash' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400';
								const statusClass = payment.payment_status === 'completed' ? 'bg-green-400/10 text-green-400' : payment.payment_status === 'pending' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-red-400/10 text-red-400';

								return (
									<tr key={payment.id} className="border-b border-accent/50 last:border-b-0">
										<td className="px-4 py-4 text-textPrimary">{payment.member_name ?? 'Unknown Member'}</td>
										<td className="px-4 py-4 text-textPrimary">{currencyFormatter.format(Number(payment.amount))}</td>
										<td className="px-4 py-4">
											<span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${methodClass}`}>{payment.payment_method}</span>
										</td>
										<td className="px-4 py-4">
											<span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}>{payment.payment_status}</span>
										</td>
										<td className="px-4 py-4 text-textSecondary">{dateFormatter.format(new Date(payment.paid_at ?? payment.created_at))}</td>
										<td className="px-4 py-4 text-textSecondary">{payment.notes || '—'}</td>
										<td className="px-4 py-4">
											<button
												onClick={() => handleDeletePayment(payment.id)}
												className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors"
												title="Delete payment log"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</td>
									</tr>
								);
							})
						) : (
							<tr>
								<td colSpan={7} className="px-4 py-10 text-center text-textSecondary">No payments found</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			{isModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
					<div className="w-full max-w-2xl rounded-xl p-6">
						<PaymentForm members={members} onSubmit={handleCashPayment} onClose={() => setIsModalOpen(false)} />
					</div>
				</div>
			) : null}
		</div>
	);
}
