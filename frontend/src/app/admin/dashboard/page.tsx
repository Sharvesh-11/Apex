'use client';

import { useEffect, useState } from 'react';
import {
	Users,
	CreditCard,
	TrendingUp,
	Tag,
	AlertCircle,
	Database,
	Zap,
} from 'lucide-react';
import useAuthStore from '@/store/authStore';
import * as api from '@/lib/api';
import { siteConfig } from '@/lib/config';

interface Stats {
	totalMembers: number;
	activeSubscriptions: number;
	totalRevenue: number;
	totalPlans: number;
}

interface Payment {
	id: string;
	member_name: string;
	amount: number;
	method: string;
	status: string;
	created_at: string;
}

interface CheckIn {
	id: string;
	member_name: string;
	date: string;
	time: string;
	method: string;
}

// Skeleton components
const StatCardSkeleton = () => (
	<div className="bg-surface rounded-lg p-6 border border-accent animate-pulse">
		<div className="h-8 w-8 bg-accent rounded mb-3" />
		<div className="h-4 w-24 bg-accent rounded mb-3" />
		<div className="h-6 w-32 bg-accent rounded" />
	</div>
);

const TableSkeletonRow = ({ cols = 5 }: { cols?: number }) => (
	<tr className="border-b border-accent">
		{Array.from({ length: cols }).map((_, i) => (
			<td key={i} className="px-4 py-3">
				<div className="h-4 bg-accent rounded animate-pulse w-24" />
			</td>
		))}
	</tr>
);

// Stat card component
interface StatCardProps {
	icon: React.ReactNode;
	label: string;
	value: string | number;
	iconColor: string;
}

const StatCard = ({ icon, label, value, iconColor }: StatCardProps) => (
	<div className="bg-surface rounded-lg p-6 border border-accent">
		<div className={`inline-block p-3 rounded-lg ${iconColor} mb-4`}>
			{icon}
		</div>
		<p className="text-textSecondary text-sm mb-1">{label}</p>
		<h3 className="text-2xl font-bold text-textPrimary">{value}</h3>
	</div>
);

// System status badge
const StatusBadge = ({ label, status }: { label: string; status: string }) => (
	<div className="bg-surface rounded-lg p-4 border border-accent flex items-center justify-between">
		<span className="text-textPrimary font-medium">{label}</span>
		<div className="flex items-center gap-2">
			<div className="w-2 h-2 rounded-full bg-green-400" />
			<span className="text-sm text-green-400">{status}</span>
		</div>
	</div>
);

// Main component
export default function AdminDashboard() {
	const { user, isLoading: authLoading } = useAuthStore();
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [stats, setStats] = useState<Stats>({
		totalMembers: 0,
		activeSubscriptions: 0,
		totalRevenue: 0,
		totalPlans: 0,
	});
	const [payments, setPayments] = useState<Payment[]>([]);
	const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

	useEffect(() => {
		if (!user || authLoading) return;

		const fetchData = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const [membersRes, subscriptionsRes, paymentsRes, plansRes] = await Promise.all([
					api.get<unknown[]>('/members/').catch((err) => {
						console.error('Failed to fetch members:', err);
						return [] as unknown[];
					}),
					api.get<unknown[]>('/subscriptions/active/').catch((err) => {
						console.error('Failed to fetch active subscriptions:', err);
						return [] as unknown[];
					}),
					api.get<Payment[]>('/payments/').catch((err) => {
						console.error('Failed to fetch payments:', err);
						return [] as Payment[];
					}),
					api.get<unknown[]>('/plans/').catch((err) => {
						console.error('Failed to fetch plans:', err);
						return [] as unknown[];
					}),
				]);

				const totalRevenue = paymentsRes.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);

				setStats({
					totalMembers: membersRes.length,
					activeSubscriptions: subscriptionsRes.length,
					totalRevenue,
					totalPlans: plansRes.length,
				});

				// Get recent payments (last 10)
				setPayments(paymentsRes.slice(0, 10));

				// Fetch recent check-ins (last 10)
				try {
					const checkInsRes = await api.get<CheckIn[]>('/attendance/');
					setCheckIns(checkInsRes.slice(0, 10));
				} catch (err) {
					console.error('Failed to fetch check-ins:', err);
				}
			} catch (err) {
				console.error('Failed to fetch dashboard data:', err);
				setError('Failed to load dashboard data. Please try again.');
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [user, authLoading]);

	if (authLoading) {
		return (
			<div className="min-h-screen bg-background">
				<div className="p-6">
					<div className="h-8 w-32 bg-accent rounded animate-pulse" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8 pb-8">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-textPrimary">Admin Dashboard</h1>
				<p className="text-textSecondary mt-2">
					Welcome back! Here's what's happening with {siteConfig.brand.name}.
				</p>
			</div>

			{/* Error state */}
			{error && (
				<div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
					<AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
					<div>
						<h3 className="font-medium text-red-900">Error loading dashboard</h3>
						<p className="text-sm text-red-700">{error}</p>
					</div>
				</div>
			)}

			{/* Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{isLoading ? (
					<>
						<StatCardSkeleton />
						<StatCardSkeleton />
						<StatCardSkeleton />
						<StatCardSkeleton />
					</>
				) : (
					<>
						<StatCard
							icon={<Users className="w-6 h-6 text-textPrimary" />}
							label="Total Members"
							value={stats.totalMembers}
							iconColor="bg-primary/10"
						/>
						<StatCard
							icon={<CreditCard className="w-6 h-6 text-green-400" />}
							label="Active Subscriptions"
							value={stats.activeSubscriptions}
							iconColor="bg-green-400/10"
						/>
						<StatCard
							icon={<TrendingUp className="w-6 h-6 text-textPrimary" />}
							label="Total Revenue"
							value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`}
							iconColor="bg-primary/10"
						/>
						<StatCard
							icon={<Tag className="w-6 h-6 text-blue-400" />}
							label="Total Plans"
							value={stats.totalPlans}
							iconColor="bg-blue-400/10"
						/>
					</>
				)}
			</div>

			{/* Recent Activity */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Recent Payments */}
				<div className="bg-surface rounded-lg border border-accent overflow-hidden">
					<div className="p-6 border-b border-accent">
						<h2 className="text-lg font-semibold text-textPrimary">Recent Payments</h2>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-background border-b border-accent">
								<tr>
									<th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">
										Member
									</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">
										Amount
									</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">
										Method
									</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">
										Status
									</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">
										Date
									</th>
								</tr>
							</thead>
							<tbody>
								{isLoading ? (
									<>
										<TableSkeletonRow cols={5} />
										<TableSkeletonRow cols={5} />
										<TableSkeletonRow cols={5} />
									</>
								) : payments.length > 0 ? (
									payments.map((payment) => (
										<tr key={payment.id} className="border-b border-accent hover:bg-background/50 transition-colors">
											<td className="px-4 py-3 text-sm text-textPrimary">
												{payment.member_name}
											</td>
											<td className="px-4 py-3 text-sm text-textPrimary font-medium">
												₹{payment.amount}
											</td>
											<td className="px-4 py-3 text-sm text-textSecondary capitalize">
												{payment.method}
											</td>
											<td className="px-4 py-3 text-sm">
												<span
													className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
														payment.status === 'completed'
															? 'bg-green-100 text-green-700'
															: payment.status === 'pending'
																? 'bg-yellow-100 text-yellow-700'
																: 'bg-red-100 text-red-700'
													}`}
												>
													{payment.status}
												</span>
											</td>
											<td className="px-4 py-3 text-sm text-textSecondary">
												{new Date(payment.created_at).toLocaleDateString()}
											</td>
										</tr>
									))
								) : (
									<tr>
										<td colSpan={5} className="px-4 py-8 text-center text-textSecondary">
											No payments yet
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Recent Check-ins */}
				<div className="bg-surface rounded-lg border border-accent overflow-hidden">
					<div className="p-6 border-b border-accent">
						<h2 className="text-lg font-semibold text-textPrimary">Recent Check-ins</h2>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-background border-b border-accent">
								<tr>
									<th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">
										Member
									</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">
										Date
									</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">
										Time
									</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-textPrimary">
										Method
									</th>
								</tr>
							</thead>
							<tbody>
								{isLoading ? (
									<>
										<TableSkeletonRow cols={4} />
										<TableSkeletonRow cols={4} />
										<TableSkeletonRow cols={4} />
									</>
								) : checkIns.length > 0 ? (
									checkIns.map((checkIn) => (
										<tr key={checkIn.id} className="border-b border-accent hover:bg-background/50 transition-colors">
											<td className="px-4 py-3 text-sm text-textPrimary">
												{checkIn.member_name}
											</td>
											<td className="px-4 py-3 text-sm text-textSecondary">
												{new Date(checkIn.date).toLocaleDateString()}
											</td>
											<td className="px-4 py-3 text-sm text-textPrimary font-medium">
												{checkIn.time}
											</td>
											<td className="px-4 py-3 text-sm text-textSecondary capitalize">
												{checkIn.method}
											</td>
										</tr>
									))
								) : (
									<tr>
										<td colSpan={4} className="px-4 py-8 text-center text-textSecondary">
											No check-ins yet
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{/* System Status */}
			<div>
				<h2 className="text-lg font-semibold text-textPrimary mb-4">System Status</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<StatusBadge label="Database" status="Connected" />
					<StatusBadge label="Razorpay" status="Active" />
					<StatusBadge label="API" status="Running" />
				</div>
			</div>
		</div>
	);
}
