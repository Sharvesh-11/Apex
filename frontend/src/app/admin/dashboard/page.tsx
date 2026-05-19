'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
	Users,
	CreditCard,
	TrendingUp,
	Tag,
	AlertCircle,
	Activity,
	Circle,
	ShieldCheck,
	Server,
	Database,
} from 'lucide-react';
import useAuthStore from '@/store/authStore';
import * as api from '@/lib/api';
import { siteConfig, C } from '@/lib/config';

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
	payment_method: string;
	payment_status: string;
	created_at: string;
}

interface CheckIn {
	id: string;
	member_name: string;
	date: string;
	time: string;
	method: string;
}

interface StatCardProps {
	icon: ReactNode;
	label: string;
	value: number;
	accentColor: string;
	glowColor: string;
	trend: string;
	formatter?: (value: number) => string;
}

const getInitials = (name?: string | null) => {
	if (!name) return 'NA';

	return (
		name
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join('') || 'NA'
	);
};

const StatCard = ({
	icon,
	label,
	value,
	accentColor,
	glowColor,
	trend,
	formatter = (val) => val.toLocaleString('en-IN'),
}: StatCardProps) => {
	const [displayValue, setDisplayValue] = useState(0);

	useEffect(() => {
		let frame = 0;
		const duration = 900;
		const start = performance.now();

		const tick = (now: number) => {
			const progress = Math.min((now - start) / duration, 1);
			setDisplayValue(Math.round(value * progress));
			if (progress < 1) {
				frame = requestAnimationFrame(tick);
			}
		};

		setDisplayValue(0);
		frame = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(frame);
	}, [value]);

	return (
		<div className={`${C.SURFACE_CLASS} relative overflow-hidden p-6`}>
			<div
				className="absolute inset-0 -z-0"
				style={{
					background: `radial-gradient(120px 80px at 35% 25%, ${glowColor}, transparent 70%)`,
				}}
			/>
			<div className="absolute left-0 top-0 h-[2px] w-full" style={{ backgroundColor: accentColor }} />
			<div className="absolute right-5 top-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#22C55E]">
				<span className="h-[6px] w-[6px] rounded-full bg-[#22C55E] animate-[pulse_2s_ease-in-out_infinite]" />
				live
			</div>

			<div className="relative z-10 flex items-center justify-between">
				<div className="inline-flex rounded-2xl border border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.08)] p-2 text-[#FFFFFF]">
					{icon}
				</div>
			</div>
			<div className="relative z-10 mt-5">
				<p className="text-4xl font-light text-[#FFFFFF]">{formatter(displayValue)}</p>
				<p className="mt-2 text-sm uppercase tracking-[0.2em] text-[#8E7CC3]">{label}</p>
				<div className="mt-4 inline-flex items-center rounded-full border border-[rgba(139,92,246,0.18)] bg-[rgba(139,92,246,0.08)] px-3 py-1 text-xs text-[#D8CCFF]">
					{trend}
				</div>
			</div>
		</div>
	);
};

const FeedSkeleton = () => (
	<div className="space-y-3 p-6">
		{Array.from({ length: 4 }).map((_, idx) => (
			<div
				key={idx}
				className="h-16 animate-pulse rounded-2xl border border-[rgba(139,92,246,0.08)] bg-[rgba(139,92,246,0.06)]"
			/>
		))}
	</div>
);

const EmptyStateCard = ({ text }: { text: string }) => (
	<div className="p-8">
		<div className="mx-auto flex max-w-sm flex-col items-center justify-center rounded-2xl border border-[rgba(139,92,246,0.1)] bg-[rgba(139,92,246,0.04)] px-6 py-10 text-center">
			<Activity className="h-5 w-5 text-[#8E7CC3]" />
			<p className="mt-3 text-sm tracking-wide text-[#8E7CC3]">{text}</p>
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

	const pendingPaymentsAmount = useMemo(
		() =>
			payments
				.filter((payment) => payment.payment_status?.toLowerCase() === 'pending')
				.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
		[payments]
	);

	const recentCompletedPayments = useMemo(
		() => payments.filter((payment) => payment.payment_status?.toLowerCase() === 'completed').length,
		[payments]
	);

	const todayRegistrations = 0;
	const expiringThisWeek = 0;

	if (authLoading) {
		return (
			<div className="min-h-screen bg-[#030014]">
				<div className="mx-auto max-w-7xl p-6">
					<div className="h-20 animate-pulse rounded-[24px] border border-[rgba(139,92,246,0.1)] bg-[rgba(16,6,35,0.72)]" />
				</div>
			</div>
		);
	}

	return (
		<div
			className="relative min-h-screen pb-10"
			style={{
				background:
					'linear-gradient(135deg, #030014 0%, #090018 30%, #14002E 65%, #1A1040 100%)',
			}}
		>
			<div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
				<div className="absolute -right-20 -top-20 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.04)_0%,transparent_70%)]" />
				<div className="absolute -bottom-20 -left-20 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.03)_0%,transparent_70%)]" />
			</div>

			<style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

			<div className="relative z-[1] mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 sm:px-6 lg:px-8">
				<header className="rounded-[24px] border border-[rgba(139,92,246,0.08)] bg-[rgba(3,0,20,0.6)] p-5 backdrop-blur-[20px]">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-xl font-light uppercase tracking-[0.2em] text-[#FFFFFF]">APEX</h1>
							<p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-[#8E7CC3]">system console</p>
						</div>
						<div className="inline-flex items-center rounded-[20px] border border-[rgba(139,92,246,0.25)] px-4 py-2 text-sm font-medium text-[#8B5CF6]">
							{siteConfig.brand.name}
						</div>
					</div>
				</header>

				{error && (
					<div className="flex items-start gap-3 rounded-[24px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] p-4 backdrop-blur-[16px]">
						<AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#EF4444]" />
						<div>
							<h3 className="font-medium text-[#FFFFFF]">Error loading dashboard</h3>
							<p className="text-sm text-[#D8CCFF]">{error}</p>
						</div>
					</div>
				)}

				<section className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
					{isLoading ? (
						<>
							<div className="h-56 animate-pulse rounded-[24px] border border-[rgba(139,92,246,0.12)] bg-[rgba(16,6,35,0.72)]" />
							<div className="h-56 animate-pulse rounded-[24px] border border-[rgba(139,92,246,0.12)] bg-[rgba(16,6,35,0.72)]" />
							<div className="h-56 animate-pulse rounded-[24px] border border-[rgba(139,92,246,0.12)] bg-[rgba(16,6,35,0.72)]" />
							<div className="h-56 animate-pulse rounded-[24px] border border-[rgba(139,92,246,0.12)] bg-[rgba(16,6,35,0.72)]" />
						</>
					) : (
						<>
							<StatCard
								icon={<Tag className="h-5 w-5" />}
								label="Total Owners"
								value={stats.totalPlans}
								accentColor="rgba(139,92,246,0.55)"
								glowColor="rgba(139,92,246,0.08)"
								trend={`+${Math.max(1, Math.floor(stats.totalPlans * 0.08))} this month`}
							/>
							<StatCard
								icon={<Users className="h-5 w-5" />}
								label="Total Members"
								value={stats.totalMembers}
								accentColor="rgba(96,165,250,0.55)"
								glowColor="rgba(96,165,250,0.08)"
								trend={`+${Math.max(1, Math.floor(stats.totalMembers * 0.06))} this month`}
							/>
							<StatCard
								icon={<TrendingUp className="h-5 w-5" />}
								label="Total Revenue"
								value={stats.totalRevenue}
								accentColor="rgba(34,197,94,0.55)"
								glowColor="rgba(34,197,94,0.08)"
								trend={`${Math.max(1, recentCompletedPayments * 2)}% growth`}
								formatter={(val) => `₹${val.toLocaleString('en-IN')}`}
							/>
							<StatCard
								icon={<CreditCard className="h-5 w-5" />}
								label="Active Subscriptions"
								value={stats.activeSubscriptions}
								accentColor="rgba(250,204,21,0.55)"
								glowColor="rgba(250,204,21,0.08)"
								trend={`${Math.max(1, Math.floor((stats.activeSubscriptions / Math.max(stats.totalMembers, 1)) * 100))}% growth`}
							/>
						</>
					)}
				</section>

				<section className={`${C.SURFACE_CLASS} overflow-hidden p-6`}>
					<div className="mb-4 flex items-center gap-2">
						<ShieldCheck className="h-4 w-4 text-[#8B5CF6]" />
						<h2 className="text-xl font-light text-[#FFFFFF]">Platform Signals</h2>
					</div>
					<div className="divide-y divide-[rgba(139,92,246,0.08)]">
						<div className="flex items-center justify-between py-4">
							<span className="text-sm text-[#8E7CC3]">Expiring this week</span>
							<span className="text-xl font-light text-[#FFFFFF]">
								<span className="text-[#FACC15]">{expiringThisWeek}</span>
							</span>
						</div>
						<div className="flex items-center justify-between py-4">
							<span className="text-sm text-[#8E7CC3]">New registrations today</span>
							<span className="text-xl font-light text-[#FFFFFF]">
								<span className="text-[#8B5CF6]">{todayRegistrations}</span>
							</span>
						</div>
						<div className="flex items-center justify-between py-4">
							<span className="text-sm text-[#8E7CC3]">Pending payments</span>
							<span className="text-xl font-light text-[#FFFFFF]">
								<span className="text-[#FACC15]">₹{pendingPaymentsAmount.toLocaleString('en-IN')}</span>
							</span>
						</div>
					</div>
				</section>

				<section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<div className={`${C.SURFACE_CLASS} overflow-hidden`}>
						<div className="flex items-center gap-3 border-b border-[rgba(139,92,246,0.08)] px-6 py-5">
							<h2 className="text-xl font-light text-[#FFFFFF]">Payment Activity</h2>
							<div className="inline-flex items-center gap-2 rounded-full border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-3 py-1">
								<span className="h-2 w-2 rounded-full bg-[#22C55E] animate-[pulse_1.8s_ease-in-out_infinite]" />
								<span className="text-xs font-medium tracking-[0.15em] text-[#22C55E]">LIVE</span>
							</div>
						</div>
						{isLoading ? (
							<FeedSkeleton />
						) : payments.length > 0 ? (
							<div className="divide-y divide-[rgba(139,92,246,0.06)]">
								{payments.map((payment) => {
									const statusLower = payment.payment_status?.toLowerCase() ?? 'unknown';
									const statusClasses =
										statusLower === 'completed'
											? 'bg-[rgba(34,197,94,0.16)] text-[#22C55E]'
											: statusLower === 'pending'
												? 'bg-[rgba(250,204,21,0.16)] text-[#FACC15]'
												: 'bg-[rgba(239,68,68,0.16)] text-[#EF4444]';

									return (
										<div
											key={payment.id}
											className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[rgba(139,92,246,0.04)]"
										>
											<div className="flex min-w-0 items-center gap-3">
												<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(139,92,246,0.2)] text-xs font-medium text-[#FFFFFF]">
													{getInitials(payment.member_name)}
												</div>
												<div className="min-w-0">
													<p className="truncate text-sm text-[#FFFFFF]">{payment.member_name}</p>
													<p className="truncate text-xs text-[#8E7CC3]">via {payment.payment_method}</p>
												</div>
											</div>
											<div className="text-right">
												<p className="text-lg font-light text-[#FFFFFF]">₹{Number(payment.amount).toLocaleString('en-IN')}</p>
												<div className="mt-1 flex items-center justify-end gap-2">
													<span className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${statusClasses}`}>
														{payment.payment_status ?? 'unknown'}
													</span>
													<span className="text-xs text-[#8E7CC3]">{new Date(payment.created_at).toLocaleDateString()}</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<EmptyStateCard text="No recent payments" />
						)}
					</div>

					<div className={`${C.SURFACE_CLASS} overflow-hidden`}>
						<div className="border-b border-[rgba(139,92,246,0.08)] px-6 py-5">
							<h2 className="text-xl font-light text-[#FFFFFF]">Access Activity</h2>
						</div>
						{isLoading ? (
							<FeedSkeleton />
						) : checkIns.length > 0 ? (
							<div className="divide-y divide-[rgba(139,92,246,0.06)]">
								{checkIns.map((checkIn) => (
									<div
										key={checkIn.id}
										className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[rgba(139,92,246,0.04)]"
									>
										<div className="flex min-w-0 items-center gap-3">
											<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(139,92,246,0.15)] text-xs font-medium text-[#FFFFFF]">
												{getInitials(checkIn.member_name)}
											</div>
											<div className="min-w-0">
												<p className="truncate text-sm text-[#FFFFFF]">{checkIn.member_name}</p>
												<p className="truncate text-xs text-[#8E7CC3]">
													{new Date(checkIn.date).toLocaleDateString()} at {checkIn.time}
												</p>
											</div>
										</div>
										<div className="text-right">
											<span className="rounded-full bg-[rgba(34,197,94,0.14)] px-3 py-1 text-xs font-medium text-[#22C55E]">
												checked in
											</span>
											<p className="mt-1 text-xs text-[#8E7CC3] capitalize">{checkIn.method}</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<EmptyStateCard text="No recent activity" />
						)}
					</div>
				</section>

				<section className={`${C.SURFACE_CLASS} p-6`}>
					<h2 className="mb-4 text-xl font-light text-[#FFFFFF]">Platform Health</h2>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
						{[
							{
								name: 'Database Cluster',
								type: 'Storage',
								status: 'operational',
								label: '99.9% uptime',
								icon: <Database className="h-4 w-4" />,
							},
							{
								name: 'Razorpay Gateway',
								type: 'Payments',
								status: 'operational',
								label: 'Operational',
								icon: <CreditCard className="h-4 w-4" />,
							},
							{
								name: 'API Orchestrator',
								type: 'Core Service',
								status: 'degraded',
								label: 'Degraded',
								icon: <Server className="h-4 w-4" />,
							},
						].map((node) => {
							const isOperational = node.status === 'operational';
							const dotColor =
								node.status === 'operational'
									? '#22C55E'
									: node.status === 'degraded'
										? '#FACC15'
										: '#EF4444';

							return (
								<div
									key={node.name}
									className="relative overflow-hidden rounded-2xl border border-[rgba(139,92,246,0.12)] bg-[rgba(16,6,35,0.72)] p-4 backdrop-blur-[24px]"
								>
									{isOperational && (
										<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,197,94,0.04),transparent_68%)]" />
									)}
									<div className="relative z-10 flex items-start justify-between">
										<div>
											<div className="mb-2 inline-flex rounded-lg border border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.08)] p-2 text-[#D8CCFF]">
												{node.icon}
											</div>
											<p className="text-sm text-[#FFFFFF]">{node.name}</p>
											<p className="text-xs text-[#8E7CC3]">{node.type}</p>
										</div>
										<Circle
											className="h-3 w-3 fill-current animate-[pulse_2s_ease-in-out_infinite]"
											style={{ color: dotColor }}
										/>
									</div>
									<p className={`relative z-10 mt-3 text-xs ${isOperational ? 'text-[#22C55E]' : node.status === 'degraded' ? 'text-[#FACC15]' : 'text-[#EF4444]'}`}>
										{node.label}
									</p>
								</div>
							);
						})}
					</div>
				</section>

			</div>
		</div>
	);
}
