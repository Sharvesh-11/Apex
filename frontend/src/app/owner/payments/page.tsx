"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, Trash2, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import PaymentForm, { CashPaymentData } from '@/components/owner/PaymentForm';
import useAuthStore from '@/store/authStore';

import * as apiClient from '@/lib/api';
import type { Member, Payment, Subscription } from '@/types';
import useUIStore from '@/store/uiStore';

type PaymentRecord = Payment & {
	member?: Pick<Member, 'full_name' | 'email'> & {
		name?: string;
	};
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

// Animated metric component for counting effect
function AnimatedMetric({ value, label, color, glowColor }: { value: number; label: string; color: string; glowColor: string }) {
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (value === 0) {
			setCount(0);
			return;
		}
		let animationFrame: number;
		const startTime = Date.now();
		const duration = 1000; // 1 second

		const animate = () => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			setCount(Math.floor(progress * value));

			if (progress < 1) {
				animationFrame = requestAnimationFrame(animate);
			} else {
				setCount(value);
			}
		};

		animationFrame = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(animationFrame);
	}, [value]);

	const formatCurrency = (num: number) =>
		new Intl.NumberFormat('en-IN', {
			style: 'currency',
			currency: 'INR',
			maximumFractionDigits: 0,
		}).format(num);

	return (
		<div
			style={{
				position: 'relative',
				overflow: 'hidden',
				borderRadius: '24px',
				background: 'rgba(16, 6, 35, 0.72)',
				backdropFilter: 'blur(24px)',
				border: '1px solid rgba(139,92,246,0.12)',
				padding: '28px 24px',
				flex: 1,
			}}
		>
			{/* Accent line at top */}
			<div
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					height: '3px',
					background: color,
					borderRadius: '24px 24px 0 0',
				}}
			/>

			{/* Atmospheric glow behind number */}
			<div
				style={{
					position: 'absolute',
					top: '50%',
					right: '-20%',
					width: '200px',
					height: '200px',
					transform: 'translateY(-50%)',
					background: glowColor,
					borderRadius: '50%',
					filter: 'blur(60px)',
					pointerEvents: 'none',
				}}
			/>

			<div style={{ position: 'relative', zIndex: 1 }}>
				<div style={{ fontSize: '14px', color: '#8E7CC3', marginBottom: '12px', fontWeight: '500' }}>{label}</div>
				<div style={{ fontSize: '42px', fontWeight: '300', color: '#FFFFFF', lineHeight: '1' }}>
					{label.includes('Pending') ? count : formatCurrency(count)}
				</div>
			</div>
		</div>
	);
}

// Helper to get monthly totals for revenue bar
function getMonthlyTotals(payments: PaymentRecord[]) {
	const months: Record<string, number> = {};
	const now = new Date();

	// Initialize last 6 months
	for (let i = 5; i >= 0; i--) {
		const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		months[key] = 0;
	}

	// Sum completed payments by month
	payments.forEach((payment) => {
		if (payment.payment_status === 'completed') {
			const date = new Date(payment.paid_at ?? payment.created_at);
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			if (key in months) {
				months[key] += Number(payment.amount || 0);
			}
		}
	});

	return Object.values(months);
}

// Helper to get month labels
function getMonthLabels() {
	const now = new Date();
	const labels = [];
	for (let i = 5; i >= 0; i--) {
		const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
		labels.push(date.toLocaleDateString('en-IN', { month: 'short' }));
	}
	return labels;
}

// Helper to get month group label for transaction feed
function getMonthGroupLabel(date: Date) {
	return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// Helper to group payments by month
function groupPaymentsByMonth(payments: PaymentRecord[]) {
	const grouped: Record<string, PaymentRecord[]> = {};
	const sorted = [...payments].sort((a, b) => {
		const dateA = new Date(a.paid_at ?? a.created_at);
		const dateB = new Date(b.paid_at ?? b.created_at);
		return dateB.getTime() - dateA.getTime();
	});

	sorted.forEach((payment) => {
		const date = new Date(payment.paid_at ?? payment.created_at);
		const key = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
		if (!grouped[key]) grouped[key] = [];
		grouped[key].push(payment);
	});

	return grouped;
}

export default function OwnerPaymentsPage() {
	const router = useRouter();
	const { isAuthenticated, user, isLoading: authLoading } = useAuthStore();
	const initAuth = useAuthStore((s) => s.initAuth);
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
	const [isMobile, setIsMobile] = useState(false);
	const [hoveredPaymentId, setHoveredPaymentId] = useState<string | null>(null);
	const [form, setForm] = useState<CashPaymentFormState>({
		member_id: '',
		subscription_id: '',
		amount: '',
		notes: '',
	});

	useEffect(() => {
		void initAuth().catch(() => {});
	}, [initAuth]);

	useEffect(() => {
		if (authLoading) return;
		if (!isAuthenticated || !user) {
			router.push('/login');
		}
	}, [authLoading, isAuthenticated, user, router]);

	if (authLoading || !isAuthenticated || !user) return null;

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, []);

	useEffect(() => {
		let mounted = true;

		void (async () => {
			setLoading(true);
			setError(null);
			try {
				const [paymentsResponse, membersResponse, subscriptionsResponse] = await Promise.all([
					apiClient.get<PaymentRecord[]>('/payments/'),
					apiClient.get<Member[]>('/members/'),
					apiClient.get<Subscription[]>('/subscriptions/active/'),
				]);

				if (!mounted) return;

				// Debug: Log first payment to see actual structure
				console.log('First payment object:', paymentsResponse?.[0]);

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
		const nextPayments = await apiClient.get<PaymentRecord[]>('/payments/');
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
		const confirmed = window.confirm("Delete this payment log? This cannot be undone.");
		if (!confirmed) return;
		try {
			await apiClient.del(`/payments/${paymentId}`);
			showToast("Payment log deleted", "success");
			setPayments((prev) => prev.filter((p) => p.id !== paymentId));
		} catch {
			showToast("Failed to delete payment log", "error");
		}
	};

	// Computed metrics for insights
	const monthlyTotals = useMemo(() => getMonthlyTotals(payments), [payments]);
	const monthLabels = getMonthLabels();
	const maxMonthlyTotal = Math.max(...monthlyTotals, 1);
	const successfulThisMonth = payments.filter(
		(p) => p.payment_status === 'completed' && new Date(p.paid_at ?? p.created_at) >= startOfMonth && new Date(p.paid_at ?? p.created_at) <= endOfMonth
	).length;
	const pendingTotal = payments
		.filter((p) => p.payment_status === 'pending')
		.reduce((sum, p) => sum + Number(p.amount || 0), 0);
	const lastPayment = payments
		.filter((p) => p.payment_status === 'completed')
		.sort((a, b) => {
			const dateA = new Date(a.paid_at ?? a.created_at);
			const dateB = new Date(b.paid_at ?? b.created_at);
			return dateB.getTime() - dateA.getTime();
		})[0];

	const groupedPayments = useMemo(() => groupPaymentsByMonth(filteredPayments), [filteredPayments]);

	return (
		<div style={{ padding: '24px', maxWidth: '100%' }}>
			{/* Header */}
			<div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
				<h1 style={{ fontSize: '32px', fontWeight: '300', color: '#FFFFFF', margin: 0, letterSpacing: '0.02em' }}>Payments</h1>
				<button
					type="button"
					onClick={openModal}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '8px',
						padding: '10px 20px',
						background: '#8B5CF6',
						border: 'none',
						borderRadius: '12px',
						color: '#FFFFFF',
						fontSize: '14px',
						fontWeight: '500',
						cursor: 'pointer',
						transition: 'background 0.2s',
					}}
					onMouseEnter={(e) => (e.currentTarget.style.background = '#A78BFA')}
					onMouseLeave={(e) => (e.currentTarget.style.background = '#8B5CF6')}
				>
					<Plus style={{ width: '16px', height: '16px' }} />
					Log Cash Payment
				</button>
			</div>

			{/* Metric Cards */}
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
				<AnimatedMetric value={summary.totalRevenue} label="Total Revenue" color="#22C55E" glowColor="rgba(34, 197, 94, 0.06)" />
				<AnimatedMetric value={summary.thisMonthRevenue} label="Monthly Revenue" color="#8B5CF6" glowColor="rgba(139, 92, 246, 0.08)" />
				<AnimatedMetric value={summary.pendingCount} label="Pending Payments" color="#FACC15" glowColor="rgba(250, 204, 21, 0.06)" />
			</div>

			{/* Filter Section */}
			<div
				style={{
					background: 'rgba(16, 6, 35, 0.72)',
					backdropFilter: 'blur(24px)',
					border: '1px solid rgba(139,92,246,0.12)',
					borderRadius: '24px',
					padding: '24px',
					marginBottom: '32px',
				}}
			>
				{/* Search Bar */}
				<div style={{ marginBottom: '20px' }}>
					<div
						style={{
							position: 'relative',
							display: isMobile ? 'block' : 'flex',
							maxWidth: isMobile ? '100%' : '40%',
						}}
					>
						<Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#D8CCFF' }} />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search by member name"
							style={{
								width: '100%',
								background: '#030014',
								border: '1px solid rgba(139,92,246,0.12)',
								borderRadius: '12px',
								padding: '10px 12px 10px 40px',
								color: '#FFFFFF',
								fontSize: '14px',
								outline: 'none',
								transition: 'all 0.2s',
							}}
							onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
							onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)')}
						/>
					</div>
				</div>

				{/* Filter Chips */}
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
					{/* Method Filter */}
					<div style={{ display: 'flex', gap: '8px' }}>
						{(['all', 'cash', 'razorpay'] as FilterMethod[]).map((method) => (
							<button
								key={method}
								onClick={() => setMethodFilter(method)}
								style={{
									padding: '8px 14px',
									background: methodFilter === method ? 'rgba(139,92,246,0.15)' : 'transparent',
									border: `1px solid ${methodFilter === method ? '#8B5CF6' : 'rgba(139,92,246,0.12)'}`,
									borderRadius: '20px',
									color: methodFilter === method ? '#D8CCFF' : '#8E7CC3',
									fontSize: '13px',
									fontWeight: '500',
									cursor: 'pointer',
									transition: 'all 0.2s',
									textTransform: 'capitalize',
								}}
								onMouseEnter={(e) => {
									if (methodFilter !== method) {
										e.currentTarget.style.borderColor = '#8B5CF6';
										e.currentTarget.style.color = '#D8CCFF';
									}
								}}
								onMouseLeave={(e) => {
									if (methodFilter !== method) {
										e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)';
										e.currentTarget.style.color = '#8E7CC3';
									}
								}}
							>
								{method === 'all' ? 'All Methods' : method}
							</button>
						))}
					</div>

					{/* Status Filter */}
					<div style={{ display: 'flex', gap: '8px' }}>
						{(['all', 'completed', 'pending', 'failed'] as FilterStatus[]).map((status) => (
							<button
								key={status}
								onClick={() => setStatusFilter(status)}
								style={{
									padding: '8px 14px',
									background: statusFilter === status ? 'rgba(139,92,246,0.15)' : 'transparent',
									border: `1px solid ${statusFilter === status ? '#8B5CF6' : 'rgba(139,92,246,0.12)'}`,
									borderRadius: '20px',
									color: statusFilter === status ? '#D8CCFF' : '#8E7CC3',
									fontSize: '13px',
									fontWeight: '500',
									cursor: 'pointer',
									transition: 'all 0.2s',
									textTransform: 'capitalize',
								}}
								onMouseEnter={(e) => {
									if (statusFilter !== status) {
										e.currentTarget.style.borderColor = '#8B5CF6';
										e.currentTarget.style.color = '#D8CCFF';
									}
								}}
								onMouseLeave={(e) => {
									if (statusFilter !== status) {
										e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)';
										e.currentTarget.style.color = '#8E7CC3';
									}
								}}
							>
								{status === 'all' ? 'All Statuses' : status}
							</button>
						))}
					</div>

					{/* Date Range */}
					<div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
						<input
							type="date"
							value={fromDate}
							onChange={(e) => setFromDate(e.target.value)}
							style={{
								padding: '8px 12px',
								background: '#030014',
								border: '1px solid rgba(139,92,246,0.12)',
								borderRadius: '12px',
								color: '#FFFFFF',
								fontSize: '13px',
								outline: 'none',
								cursor: 'pointer',
								transition: 'all 0.2s',
							}}
							onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
							onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)')}
						/>
						<input
							type="date"
							value={toDate}
							onChange={(e) => setToDate(e.target.value)}
							style={{
								padding: '8px 12px',
								background: '#030014',
								border: '1px solid rgba(139,92,246,0.12)',
								borderRadius: '12px',
								color: '#FFFFFF',
								fontSize: '13px',
								outline: 'none',
								cursor: 'pointer',
								transition: 'all 0.2s',
							}}
							onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
							onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)')}
						/>
					</div>
				</div>
			</div>

			{/* Error Message */}
			{error && (
				<div
					style={{
						background: 'rgba(16, 6, 35, 0.72)',
						backdropFilter: 'blur(24px)',
						border: '1px solid rgba(139,92,246,0.12)',
						borderRadius: '24px',
						padding: '16px',
						color: '#8E7CC3',
						marginBottom: '32px',
					}}
				>
					{error}
				</div>
			)}

			{/* Transaction Feed */}
			{loading ? (
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: '1fr',
						gap: '12px',
						marginBottom: '32px',
					}}
				>
					{skeletonRows.map((_, index) => (
						<div
							key={index}
							style={{
								background: 'rgba(16, 6, 35, 0.72)',
								backdropFilter: 'blur(24px)',
								border: '1px solid rgba(139,92,246,0.12)',
								borderRadius: '16px',
								padding: '16px',
								height: '80px',
								opacity: 0.5,
								animation: 'pulse 2s infinite',
							}}
						/>
					))}
				</div>
			) : filteredPayments.length === 0 ? (
				<div
					style={{
						background: 'rgba(16, 6, 35, 0.72)',
						backdropFilter: 'blur(24px)',
						border: '1px solid rgba(139,92,246,0.12)',
						borderRadius: '24px',
						padding: '60px 24px',
						textAlign: 'center',
						marginBottom: '32px',
					}}
				>
					<div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.4 }}>💳</div>
					<div style={{ fontSize: '16px', color: '#D8CCFF', marginBottom: '8px', fontWeight: '500' }}>No payments recorded yet</div>
					<div style={{ fontSize: '14px', color: '#8E7CC3' }}>Start by logging your first cash payment</div>
				</div>
			) : (
				<div style={{ marginBottom: '32px' }}>
					{Object.entries(groupedPayments).map(([monthLabel, monthPayments]) => (
						<div key={monthLabel}>
							{/* Month Divider */}
							<div
								style={{
									fontSize: '11px',
									color: '#8E7CC3',
									textTransform: 'uppercase',
									letterSpacing: '0.08em',
									fontWeight: '600',
									padding: '16px 0 12px 0',
									marginBottom: '12px',
									marginTop: '20px',
									opacity: 0.6,
								}}
							>
								{monthLabel}
							</div>

							{/* Payment Rows */}
							<div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
								{monthPayments.map((payment) => {

						const statusConfig =
							payment.payment_status === 'completed'
								? { bg: 'rgba(34, 197, 94, 0.1)', text: '#22C55E', border: 'rgba(34, 197, 94, 0.2)' }
							: payment.payment_status === 'pending'
								? { bg: 'rgba(250, 204, 21, 0.1)', text: '#FACC15', border: 'rgba(250, 204, 21, 0.2)' }
							: { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.2)' };

						// Resolve member name with multiple fallbacks
						let memberName =
							payment.member?.full_name ||
							payment.member?.name ||
							(payment as any).member_name ||
							(payment as any).full_name ||
							(payment as any).name ||
							null;

						// If still not found, try to look up from members array
						if (!memberName && (payment as any).member_id) {
							const foundMember = members.find((m) => m.id === (payment as any).member_id);
							memberName = foundMember?.full_name || null;
						}

						memberName = memberName || 'Unknown Member';

						// Get initial from member name
						const memberInitial = memberName[0].toUpperCase();
									const formattedAmount = new Intl.NumberFormat('en-IN', {
										style: 'currency',
										currency: 'INR',
										maximumFractionDigits: 0,
									}).format(Number(payment.amount || 0));
									const formattedDate = new Intl.DateTimeFormat('en-IN', {
										day: '2-digit',
										month: 'short',
										year: 'numeric',
									}).format(new Date(payment.paid_at ?? payment.created_at));

									return (
										<div
											key={payment.id}
											onMouseEnter={(e) => {
												setHoveredPaymentId(payment.id);
												e.currentTarget.style.background = 'rgba(139, 92, 246, 0.04)';
											}}
											onMouseLeave={(e) => {
												setHoveredPaymentId(null);
												e.currentTarget.style.background = 'rgba(16, 6, 35, 0.72)';
											}}
											style={{
												display: 'grid',
												gridTemplateColumns: '60px 1fr auto auto',
												gap: '16px',
												alignItems: 'center',
												padding: '16px',
												background: 'rgba(16, 6, 35, 0.72)',
												backdropFilter: 'blur(24px)',
												border: '1px solid rgba(139,92,246,0.06)',
												borderBottom: '1px solid rgba(139,92,246,0.06)',
												borderRadius: '16px',
												transition: 'all 0.2s',
												cursor: 'pointer',
											}}
										>
											{/* Avatar */}
											<div
												style={{
													width: '50px',
													height: '50px',
													borderRadius: '50%',
													background: 'rgba(139, 92, 246, 0.3)',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													color: '#D8CCFF',
													fontWeight: '600',
													fontSize: '18px',
													flexShrink: 0,
												}}
											>
												{memberInitial}
											</div>

											{/* Member Info & Amount */}
											<div>
												<div style={{ color: '#FFFFFF', fontWeight: '500', marginBottom: '4px' }}>
													{memberName}
												</div>
												<div style={{ color: '#8E7CC3', fontSize: '13px', marginBottom: '4px' }}>
													{payment.payment_method === 'cash' ? 'Cash' : 'Razorpay'} • {payment.payment_method === 'cash' && payment.notes ? payment.notes : formattedDate}
												</div>
												<div style={{ fontSize: '20px', fontWeight: '300', color: '#FFFFFF' }}>
													{formattedAmount}
												</div>
											</div>

											{/* Status & Date */}
											<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
												<div
													style={{
														padding: '6px 12px',
														background: statusConfig.bg,
														border: `1px solid ${statusConfig.border}`,
														borderRadius: '16px',
														color: statusConfig.text,
														fontSize: '12px',
														fontWeight: '600',
														textTransform: 'capitalize',
													}}
												>
													{payment.payment_status}
												</div>
												<div style={{ color: '#8E7CC3', fontSize: '13px' }}>{formattedDate}</div>
											</div>

											{/* Delete Button (hover) */}
												{hoveredPaymentId === payment.id && (
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleDeletePayment(payment.id);
													}}
													style={{
														position: 'absolute',
														right: 16,
														padding: '8px 12px',
														background: 'transparent',
														border: 'none',
														color: '#8E7CC3',
														cursor: 'pointer',
														transition: 'color 0.2s',
													}}
													onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
													onMouseLeave={(e) => (e.currentTarget.style.color = '#8E7CC3')}
													title="Delete payment log"
												>
													<Trash2 style={{ width: '18px', height: '18px' }} />
												</button>
											)}
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Insights Section */}
			{!loading && filteredPayments.length > 0 && (
				<div
					style={{
						background: 'rgba(16, 6, 35, 0.72)',
						backdropFilter: 'blur(24px)',
						border: '1px solid rgba(139,92,246,0.12)',
						borderRadius: '24px',
						padding: '28px',
					}}
				>
					{/* Metric Strips */}
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
							gap: '20px',
							marginBottom: '32px',
						}}
					>
						{/* Successful This Month */}
						<div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
								<CheckCircle2 style={{ width: '16px', height: '16px', color: '#22C55E' }} />
								<div style={{ fontSize: '13px', color: '#8E7CC3', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
									Successful This Month
								</div>
							</div>
							<div style={{ fontSize: '28px', fontWeight: '300', color: '#22C55E' }}>{successfulThisMonth}</div>
						</div>

						{/* Pending Collection */}
						<div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
								<Clock style={{ width: '16px', height: '16px', color: '#FACC15' }} />
								<div style={{ fontSize: '13px', color: '#8E7CC3', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
									Pending Collection
								</div>
							</div>
							<div style={{ fontSize: '20px', fontWeight: '300', color: '#FFFFFF' }}>
								{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(pendingTotal)}
							</div>
						</div>

						{/* Last Payment Received */}
						<div>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
								<TrendingUp style={{ width: '16px', height: '16px', color: '#D8CCFF' }} />
								<div style={{ fontSize: '13px', color: '#8E7CC3', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
									Last Payment Received
								</div>
							</div>
							<div style={{ fontSize: '18px', fontWeight: '300', color: '#D8CCFF' }}>
								{lastPayment
									? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(lastPayment.paid_at ?? lastPayment.created_at))
									: '—'}
							</div>
						</div>
					</div>

					{/* Revenue Bar Chart */}
					<div>
						<div style={{ fontSize: '13px', color: '#8E7CC3', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
							Last 6 Months Revenue
						</div>
						<div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', height: '100px', justifyContent: 'center' }}>
							{monthlyTotals.map((total, index) => (
								<div
									key={index}
									style={{
										flex: 1,
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										gap: '8px',
									}}
								>
									<div
										style={{
											width: '100%',
											height: Math.max((total / maxMonthlyTotal) * 80, 4),
											background: '#8B5CF6',
											borderRadius: '6px 6px 0 0',
											opacity: 0.6,
											transition: 'opacity 0.2s',
											cursor: 'pointer',
										}}
										onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
										onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
										title={`${monthLabels[index]}: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(total)}`}
									/>
									<div style={{ fontSize: '11px', color: '#8E7CC3', fontWeight: '500', textAlign: 'center' }}>
										{monthLabels[index]}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Modal */}
			{isModalOpen && (
				<div
					style={{
						position: 'fixed',
						inset: 0,
						zIndex: 50,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						background: 'rgba(0, 0, 0, 0.6)',
						padding: '16px',
					}}
				>
					<div style={{ width: '100%', maxWidth: '600px', borderRadius: '24px', padding: '24px' }}>
						<PaymentForm members={members} onSubmit={handleCashPayment} onClose={() => setIsModalOpen(false)} />
					</div>
				</div>
			)}

			<style>{`
				@keyframes pulse {
					0%, 100% { opacity: 0.5; }
					50% { opacity: 0.8; }
				}
			`}</style>
		</div>
	);
}
