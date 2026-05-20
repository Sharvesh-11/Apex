"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
	Users,
	CreditCard,
	TrendingUp,
	AlertCircle,
} from 'lucide-react';

import { get } from '@/lib/api';
import type { Member, Payment, Subscription } from '@/types';

type MemberWithSubscription = Member & {
	subscription?: Subscription;
};

type PaymentWithMember = Payment & {
	member_name?: string;
	member?: Pick<Member, 'id' | 'full_name'>;
};


type DashboardStats = {
	totalMembers: number;
	activeSubscriptions: number;
	revenueThisMonth: number;
	expiringSoon: number;
};

const initialStats: DashboardStats = {
	totalMembers: 0,
	activeSubscriptions: 0,
	revenueThisMonth: 0,
	expiringSoon: 0,
};

const skeletonCards = Array.from({ length: 4 });
const skeletonRows = Array.from({ length: 5 });

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
	primarySoft: 'rgba(124,58,237,0.06)',
	accent: '#a78bfa',
	green: '#10b981',
	gold: '#f59e0b',
	red: '#ef4444',
	blue: '#3b82f6',
	textPrimary: '#f1f5f9',
	textSecondary: '#475569',
	textMuted: '#1e293b',
};

function getDaysRemaining(endDate: string) {
	const end = new Date(endDate);
	const now = new Date();
	const startOfDayNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfDayEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	return Math.ceil((startOfDayEnd.getTime() - startOfDayNow.getTime()) / (1000 * 60 * 60 * 24));
}

function StatCard({
	title,
	value,
	Icon,
	iconColor,
	index,
	cardBackground,
	cardBorder,
	glow,
	accentLine,
	metricColor,
	isRevenue,
}: {
	title: string;
	value: string | number;
	Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
	iconColor: string;
	index: number;
	cardBackground: string;
	cardBorder?: string;
	glow: string;
	accentLine: string;
	metricColor?: string;
	isRevenue?: boolean;
}) {
	return (
		<div
			className="stat-card"
			style={{
				position: 'relative',
				overflow: 'hidden',
				borderRadius: '16px',
				padding: '28px 28px 24px',
				border: `1px solid ${cardBorder ?? C.border}`,
				background: cardBackground,
				animation: 'fadeInUp 0.4s ease both',
				animationDelay: `${index * 60}ms`,
			}}
		>
			<div
				style={{
					width: '80px',
					height: '80px',
					borderRadius: '50%',
					position: 'absolute',
					top: '-20px',
					right: '-20px',
					opacity: 0.6,
					background: glow,
					pointerEvents: 'none',
				}}
			/>
			<Icon className="absolute right-7 top-7 h-5 w-5" style={{ opacity: 0.5, color: iconColor }} />
			<div
				style={{
					fontFamily: 'Bebas Neue, sans-serif',
					fontSize: isRevenue ? '48px' : '52px',
					lineHeight: 1,
					color: metricColor ?? C.textPrimary,
					letterSpacing: '0.02em',
					marginTop: '8px',
				}}
			>
				{value}
			</div>
			<div
				style={{
					fontSize: '11px',
					letterSpacing: '0.15em',
					textTransform: 'uppercase',
					color: C.textMuted,
					marginTop: '8px',
					fontWeight: 400,
				}}
			>
				{title}
			</div>
			<div
				style={{
					position: 'absolute',
					bottom: 0,
					left: 0,
					right: 0,
					height: '2px',
					opacity: 0.4,
					background: accentLine,
				}}
			/>
		</div>
	);
}

export default function OwnerDashboardPage() {
	const [stats, setStats] = useState<DashboardStats>(initialStats);
	const [recentPayments, setRecentPayments] = useState<PaymentWithMember[]>([]);
	const [expiringSubscriptions, setExpiringSubscriptions] = useState<MemberWithSubscription[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;

		void (async () => {
			setLoading(true);
			setError(null);

			try {
				const [members, activeSubscriptions, payments] = await Promise.all([
				get<MemberWithSubscription[]>('/members/'),
				get<Subscription[]>('/subscriptions/active'),
				get<PaymentWithMember[]>('/payments/'),
			]);
				if (!mounted) return;

				const now = new Date();
				const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
				const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

				const revenueThisMonth = payments.reduce((sum, payment) => {
					const paidDate = payment.paid_at ?? payment.created_at;
					const date = new Date(paidDate);
					const isInCurrentMonth = date >= startOfMonth && date <= endOfMonth;
					const isCompleted = payment.payment_status === 'completed';
					return isInCurrentMonth && isCompleted ? sum + Number(payment.amount ?? 0) : sum;
				}, 0);

				const expiringSoonMembers = members
					.filter((member) => member.subscription?.end_date)
					.map((member) => ({
						...member,
						_daysRemaining: getDaysRemaining(member.subscription!.end_date),
					}))
					.filter((member) => member._daysRemaining <= 7)
					.sort((a, b) => a._daysRemaining - b._daysRemaining);

				setStats({
					totalMembers: members.length,
					activeSubscriptions: activeSubscriptions.length,
					revenueThisMonth,
					expiringSoon: expiringSoonMembers.length,
				});
				setRecentPayments(
					payments
						.slice()
						.sort((a, b) => new Date(b.paid_at ?? b.created_at).getTime() - new Date(a.paid_at ?? a.created_at).getTime())
						.slice(0, 5),
				);
				setExpiringSubscriptions(expiringSoonMembers as MemberWithSubscription[]);
			} catch (fetchError) {
				console.error("OWNER DASHBOARD FETCH FAILED", fetchError);
				if (!mounted) return;
				setError('Failed to load dashboard data');
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

	const statCards = useMemo(
		() => [
			{
				title: 'Total Members',
				value: stats.totalMembers,
				Icon: Users,
				iconColor: C.blue,
				cardBackground: `linear-gradient(135deg, rgba(59,130,246,0.08) 0%, ${C.surfaceDeep} 60%)`,
				glow: 'radial-gradient(circle, rgba(59,130,246,0.3), transparent)',
				accentLine: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.6), transparent)',
			},
			{
				title: 'Active Subscriptions',
				value: stats.activeSubscriptions,
				Icon: CreditCard,
				iconColor: C.green,
				cardBackground: `linear-gradient(135deg, rgba(16,185,129,0.08) 0%, ${C.surfaceDeep} 60%)`,
				glow: 'radial-gradient(circle, rgba(16,185,129,0.3), transparent)',
				accentLine: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)',
			},
			{
				title: 'Revenue This Month',
				value: currencyFormatter.format(stats.revenueThisMonth),
				Icon: TrendingUp,
				iconColor: C.accent,
				cardBackground: `linear-gradient(135deg, rgba(124,58,237,0.12) 0%, ${C.surfaceDeep} 60%)`,
				cardBorder: 'rgba(124,58,237,0.12)',
				glow: 'radial-gradient(circle, rgba(124,58,237,0.4), transparent)',
				accentLine: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.8), transparent)',
				metricColor: C.accent,
				isRevenue: true,
			},
			{
				title: 'Expiring Soon',
				value: stats.expiringSoon,
				Icon: AlertCircle,
				iconColor: C.gold,
				cardBackground: `linear-gradient(135deg, rgba(245,158,11,0.08) 0%, ${C.surfaceDeep} 60%)`,
				glow: 'radial-gradient(circle, rgba(245,158,11,0.3), transparent)',
				accentLine: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.6), transparent)',
			},
		],
		[stats],
	);

	return (
		<div className="space-y-8 p-8 pb-16" style={{ background: C.bg }}>
			<style jsx global>{`
				@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

				@keyframes fadeInUp {
					from { opacity: 0; transform: translateY(12px); }
					to { opacity: 1; transform: translateY(0); }
				}

				.stat-card {
					transition: transform 0.2s ease, box-shadow 0.2s ease;
				}

				.stat-card:hover {
					transform: translateY(-2px);
				}

				.table-row {
					transition: background 0.15s ease;
				}

				.table-row:hover {
					background: rgba(124,58,237,0.04) !important;
				}

				.nav-link {
					transition: background 0.15s ease, color 0.15s ease;
				}

				.expiring-row {
					transition: background 0.15s ease;
				}

				.expiring-row:hover {
					background: rgba(124,58,237,0.03);
				}
			`}</style>
			{error ? (
				<div
					className="rounded-xl p-4"
					style={{ border: `1px solid ${C.borderMid}`, background: C.glass, color: C.textSecondary }}
				>
					{error}
				</div>
			) : null}

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{loading
					? skeletonCards.map((_, index) => (
						<div
							key={index}
							className="h-36 animate-pulse rounded-2xl"
							style={{ border: `1px solid ${C.border}`, background: C.glassMid }}
						/>
					))
					: statCards.map((card, index) => <StatCard key={card.title} index={index} {...card} />)}
			</div>

			<div className="grid gap-6 xl:grid-cols-2" style={{ animation: 'fadeInUp 0.4s ease both', animationDelay: '300ms' }}>
				<div
					className="overflow-hidden rounded-2xl"
					style={{
						background: C.glass,
						border: `1px solid ${C.border}`,
					}}
				>
					<div
						className="flex items-center justify-between gap-3"
						style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}
					>
						<h2
							style={{
								fontFamily: 'DM Sans, sans-serif',
								fontWeight: 600,
								fontSize: '14px',
								color: C.textPrimary,
								letterSpacing: '0.02em',
							}}
						>
							Recent Payments
						</h2>
						<Link
							href="/owner/payments"
							className="nav-link text-sm"
							style={{ fontSize: '12px', color: C.accent, opacity: 0.7, transition: 'opacity 0.2s' }}
						>
							View All
						</Link>
					</div>

					{loading ? (
						<div className="space-y-3 p-6">
							{skeletonRows.map((_, index) => (
								<div key={index} className="h-12 animate-pulse rounded-lg" style={{ background: C.glassMid }} />
							))}
						</div>
					) : recentPayments.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="min-w-full text-left" style={{ fontSize: '13px' }}>
								<thead style={{ background: 'rgba(0,0,0,0.2)', borderBottom: `1px solid ${C.border}` }}>
									<tr>
										<th style={{ padding: '14px 24px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textMuted }}>Member</th>
										<th style={{ padding: '14px 24px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textMuted }}>Amount</th>
										<th style={{ padding: '14px 24px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textMuted }}>Method</th>
										<th style={{ padding: '14px 24px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textMuted }}>Status</th>
										<th style={{ padding: '14px 24px', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textMuted }}>Date</th>
									</tr>
								</thead>
								<tbody>
									{recentPayments.map((payment) => {
										const methodLabel = payment.payment_method === 'cash' ? 'Cash' : 'Razorpay';
										const methodStyle =
											payment.payment_method === 'cash'
												? { background: 'rgba(245,158,11,0.1)', color: C.gold }
												: { background: 'rgba(59,130,246,0.1)', color: C.blue };
										const date = dateFormatter.format(new Date(payment.paid_at ?? payment.created_at));
										const statusStyle =
											payment.payment_status === 'completed'
												? { background: 'rgba(16,185,129,0.1)', color: C.green }
												: payment.payment_status === 'failed'
													? { background: 'rgba(239,68,68,0.1)', color: C.red }
													: { background: 'rgba(245,158,11,0.1)', color: C.gold };

										return (
											<tr key={payment.id} className="table-row" style={{ borderBottom: `1px solid ${C.border}` }}>
												<td style={{ padding: '16px 24px', color: C.textPrimary, fontWeight: 500 }}>
													{(payment as any).member_name ?? payment.member?.full_name ?? 'Unknown Member'}
												</td>
												<td
													style={{
														padding: '16px 24px',
														fontFamily: 'Bebas Neue, sans-serif',
														fontSize: '18px',
														color: C.textPrimary,
														letterSpacing: '0.02em',
													}}
												>
													{currencyFormatter.format(Number(payment.amount ?? 0))}
												</td>
												<td style={{ padding: '16px 24px' }}>
													<span
														className="inline-flex"
														style={{ borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 500, ...methodStyle }}
													>
														{methodLabel}
													</span>
												</td>
												<td style={{ padding: '16px 24px' }}>
													<span
														className="inline-flex"
														style={{ borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 500, ...statusStyle }}
													>
														{payment.payment_status}
													</span>
												</td>
												<td style={{ padding: '16px 24px', color: C.textMuted, fontSize: '12px' }}>{date}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					) : (
						<div className="text-center" style={{ padding: '40px 24px' }}>
							<div
								style={{
									width: '40px',
									height: '40px',
									borderRadius: '50%',
									background: C.glass,
									border: `1px solid ${C.border}`,
									margin: '0 auto 16px',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									fontSize: '18px',
									opacity: 0.4,
								}}
							>
								₹
							</div>
							<div style={{ fontSize: '14px', color: C.textSecondary }}>No recent payments</div>
							<div style={{ fontSize: '12px', color: C.textMuted, marginTop: '4px' }}>
								Payments will appear here once members pay
							</div>
						</div>
					)}
				</div>

				<div
					className="overflow-hidden rounded-2xl"
					style={{
						background: C.glass,
						border: `1px solid ${C.border}`,
					}}
				>
					<div
						className="flex items-center justify-between"
						style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}
					>
						<div>
							<h2
								style={{
									fontFamily: 'DM Sans, sans-serif',
									fontWeight: 600,
									fontSize: '14px',
									color: C.textPrimary,
									letterSpacing: '0.02em',
								}}
							>
								Expiring Subscriptions
							</h2>
							<div style={{ fontSize: '11px', color: C.textMuted }}>Next 7 days</div>
						</div>
						<Link
							href="/owner/members"
							className="nav-link text-sm"
							style={{ fontSize: '12px', color: C.accent, opacity: 0.7, transition: 'opacity 0.2s' }}
						>
							View All
						</Link>
					</div>

					{loading ? (
						<div className="space-y-3 p-6">
							{skeletonRows.map((_, index) => (
								<div key={index} className="h-14 animate-pulse rounded-lg" style={{ background: C.glassMid }} />
							))}
						</div>
					) : expiringSubscriptions.length > 0 ? (
						<div>
							{expiringSubscriptions.map((member) => {
								const daysRemaining = getDaysRemaining(member.subscription!.end_date);
								const daysStyle =
									daysRemaining <= 3
										? { background: 'rgba(239,68,68,0.1)', color: C.red }
										: daysRemaining <= 7
											? { background: 'rgba(245,158,11,0.1)', color: C.gold }
											: { background: 'rgba(124,58,237,0.08)', color: C.accent };

								return (
									<div key={member.id} className="expiring-row" style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}` }}>
										<div className="flex items-start justify-between gap-4">
											<div>
												<div style={{ color: C.textPrimary, fontWeight: 500, fontSize: '13px' }}>{member.full_name}</div>
												<div style={{ color: C.textMuted, fontSize: '11px' }}>{member.subscription?.plan?.name ?? 'Plan'}</div>
											</div>
											<div
												style={{
													borderRadius: '999px',
													padding: '4px 12px',
													fontSize: '12px',
													fontWeight: 500,
													...daysStyle,
												}}
											>
												{daysRemaining} days left
											</div>
										</div>

										<div className="mt-3 flex items-center justify-between gap-3">
											<div style={{ fontSize: '11px', color: C.textMuted }}>
												Expires on {dateFormatter.format(new Date(member.subscription!.end_date))}
											</div>
											<Link href={`/owner/members/${member.id}`} className="nav-link text-sm" style={{ fontSize: '12px', color: C.accent, opacity: 0.8 }}>
												View Member
											</Link>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="text-center" style={{ padding: '36px 24px' }}>
							<div style={{ opacity: 0.3, fontSize: '24px' }}>📅</div>
							<div style={{ fontSize: '13px', color: C.textSecondary, marginTop: '12px' }}>All subscriptions are healthy</div>
							<div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px' }}>
								No memberships expiring in the next 7 days
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

