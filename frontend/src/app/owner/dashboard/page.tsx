"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
	Users,
	CreditCard,
	TrendingUp,
	AlertCircle,
} from 'lucide-react';

import * as apiClient from '@/lib/api';
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
	iconClassName,
}: {
	title: string;
	value: string | number;
	Icon: React.ComponentType<{ className?: string }>;
	iconClassName: string;
}) {
	return (
		<div className="relative rounded-xl border border-accent bg-surface p-6">
			<Icon className={`absolute right-5 top-5 h-6 w-6 ${iconClassName}`} />
			<div className="mt-6 text-3xl font-bold text-textPrimary">{value}</div>
			<div className="mt-2 text-sm text-textSecondary">{title}</div>
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
					apiClient.get<MemberWithSubscription[]>('/members'),
					apiClient.get<Subscription[]>('/subscriptions/active'),
					apiClient.get<PaymentWithMember[]>('/payments'),
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
				iconClassName: 'text-primary',
			},
			{
				title: 'Active Subscriptions',
				value: stats.activeSubscriptions,
				Icon: CreditCard,
				iconClassName: 'text-green-400',
			},
			{
				title: 'Revenue This Month',
				value: currencyFormatter.format(stats.revenueThisMonth),
				Icon: TrendingUp,
				iconClassName: 'text-primary',
			},
			{
				title: 'Expiring Soon',
				value: stats.expiringSoon,
				Icon: AlertCircle,
				iconClassName: 'text-yellow-400',
			},
		],
		[stats],
	);

	return (
		<div className="space-y-6">
			{error ? (
				<div className="rounded-xl border border-accent bg-surface p-4 text-textSecondary">{error}</div>
			) : null}

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{loading
					? skeletonCards.map((_, index) => (
						<div key={index} className="h-32 animate-pulse rounded-xl border border-accent bg-surface p-6" />
					))
					: statCards.map((card) => <StatCard key={card.title} {...card} />)}
			</div>

			<div className="grid gap-6 xl:grid-cols-2">
				<div className="rounded-xl border border-accent bg-surface p-6">
					<div className="mb-4 flex items-center justify-between gap-3">
						<h2 className="text-xl font-semibold text-textPrimary">Recent Payments</h2>
						<Link href="/owner/payments" className="text-sm text-primary hover:text-primaryHover">
							View All
						</Link>
					</div>

					{loading ? (
						<div className="space-y-3">
							{skeletonRows.map((_, index) => (
								<div key={index} className="h-12 animate-pulse rounded-lg bg-background/60" />
							))}
						</div>
					) : recentPayments.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="min-w-full text-left text-sm">
								<thead className="border-b border-accent text-textSecondary">
									<tr>
										<th className="pb-3 font-medium">Member</th>
										<th className="pb-3 font-medium">Amount</th>
										<th className="pb-3 font-medium">Method</th>
										<th className="pb-3 font-medium">Status</th>
										<th className="pb-3 font-medium">Date</th>
									</tr>
								</thead>
								<tbody>
									{recentPayments.map((payment) => {
										const methodLabel = payment.payment_method === 'cash' ? 'Cash' : 'Razorpay';
										const methodClass = payment.payment_method === 'cash' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400';
										const date = dateFormatter.format(new Date(payment.paid_at ?? payment.created_at));
										const statusClass =
											payment.payment_status === 'completed'
												? 'bg-green-400/10 text-green-400'
												: payment.payment_status === 'failed'
													? 'bg-red-400/10 text-red-400'
													: 'bg-textSecondary/10 text-textSecondary';

										return (
											<tr key={payment.id} className="border-b border-accent/50 last:border-b-0">
												<td className="py-3 text-textPrimary">{(payment as any).member_name ?? payment.member?.full_name ?? 'Unknown Member'}</td>
												<td className="py-3 text-textPrimary">{currencyFormatter.format(Number(payment.amount ?? 0))}</td>
												<td className="py-3">
													<span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${methodClass}`}>{methodLabel}</span>
												</td>
												<td className="py-3">
													<span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}>{payment.payment_status}</span>
												</td>
												<td className="py-3 text-textSecondary">{date}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					) : (
						<div className="text-textSecondary">No recent payments found.</div>
					)}
				</div>

				<div className="rounded-xl border border-accent bg-surface p-6">
					<h2 className="mb-4 text-xl font-semibold text-textPrimary">Expiring Subscriptions</h2>

					{loading ? (
						<div className="space-y-3">
							{skeletonRows.map((_, index) => (
								<div key={index} className="h-14 animate-pulse rounded-lg bg-background/60" />
							))}
						</div>
					) : expiringSubscriptions.length > 0 ? (
						<div className="space-y-3">
							{expiringSubscriptions.map((member) => {
								const daysRemaining = getDaysRemaining(member.subscription!.end_date);
								const urgent = daysRemaining <= 3;

								return (
									<div key={member.id} className="rounded-lg border border-accent px-4 py-3">
										<div className="flex items-start justify-between gap-4">
											<div>
												<div className="font-medium text-textPrimary">{member.full_name}</div>
												<div className="text-sm text-textSecondary">{member.subscription?.plan?.name ?? 'Plan'}</div>
											</div>
											<div className={`text-sm font-medium ${urgent ? 'text-red-400' : 'text-textSecondary'}`}>
												{daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining
											</div>
										</div>

										<div className="mt-3 flex items-center justify-between gap-3">
											<div className="text-xs text-textSecondary">
												Expires on {dateFormatter.format(new Date(member.subscription!.end_date))}
											</div>
											<Link href={`/owner/members/${member.id}`} className="text-sm text-primary hover:text-primaryHover">
												View Member
											</Link>
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="text-textSecondary">No subscriptions expiring soon.</div>
					)}
				</div>
			</div>
		</div>
	);
}

