"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Power, PowerOff, TrendingUp, Users, DollarSign, Zap, Crown } from 'lucide-react';

import * as apiClient from '@/lib/api';
import type { Plan, Subscription } from '@/types';
import useUIStore from '@/store/uiStore';
import useAuthStore from '@/store/authStore';

type PlanFormState = {
	name: string;
	description: string;
	price: string;
	billing_cycle: 'monthly' | 'quarterly' | 'annual';
};

const billingCycleOptions: Array<{ label: string; value: PlanFormState['billing_cycle'] }> = [
	{ label: 'Monthly', value: 'monthly' },
	{ label: 'Quarterly', value: 'quarterly' },
	{ label: 'Annual', value: 'annual' },
];

const initialFormState: PlanFormState = {
	name: '',
	description: '',
	price: '',
	billing_cycle: 'monthly',
};

const skeletonCards = Array.from({ length: 6 });

// Determines plan tier styling
function getPlanTierConfig(billingCycle: string) {
	switch (billingCycle) {
		case 'annual':
			return {
				tier: 'premium',
				accentColor: '#22C55E',
				glowColor: 'rgba(34, 197, 94, 0.08)',
				borderColor: 'rgba(34, 197, 94, 0.2)',
				label: 'BEST VALUE',
				prominence: 3,
			};
		case 'quarterly':
			return {
				tier: 'balanced',
				accentColor: '#8B5CF6',
				glowColor: 'rgba(139, 92, 246, 0.08)',
				borderColor: 'rgba(139, 92, 246, 0.12)',
				label: 'RECOMMENDED',
				prominence: 2,
			};
		default:
			return {
				tier: 'accessible',
				accentColor: '#D8CCFF',
				glowColor: 'rgba(216, 204, 255, 0.04)',
				borderColor: 'rgba(139, 92, 246, 0.06)',
				label: 'POPULAR',
				prominence: 1,
			};
	}
}

export default function OwnerPlansPage() {
	const router = useRouter();
	const { isAuthenticated, user, isLoading: authLoading } = useAuthStore();
	const initAuth = useAuthStore((s) => s.initAuth);
	const showToast = useUIStore((state) => state.showToast);

	const [plans, setPlans] = useState<Plan[]>([]);
	const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [form, setForm] = useState<PlanFormState>(initialFormState);

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
		void refreshPlans();
	}, []);

	const refreshPlans = async () => {
		setLoading(true);
		setError(null);
		try {
			const [plansData, subsData] = await Promise.all([
				apiClient.get<Plan[]>('/plans/all/'),
				apiClient.get<Subscription[]>('/subscriptions/active/'),
			]);
			setPlans(plansData ?? []);
			setSubscriptions(subsData ?? []);
		} catch {
			setError('Failed to load plans');
		} finally {
			setLoading(false);
		}
	};

	const sortedPlans = useMemo(
		() => plans.slice().sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)),
		[plans],
	);

	// Calculate plan metrics
	const planMetrics = useMemo(() => {
		const metrics: Record<string, { subscribers: number; mrr: number; trend: number }> = {};

		plans.forEach((plan) => {
			metrics[plan.id] = {
				subscribers: 0,
				mrr: 0,
				trend: Math.floor(Math.random() * 20) - 5, // Simulated trend for demo
			};
		});

		subscriptions.forEach((sub) => {
			const plan = plans.find((p) => p.id === sub.plan_id);
			if (plan && metrics[plan.id]) {
				metrics[plan.id].subscribers += 1;
				// Calculate annualized MRR based on billing cycle
				const cycleMultiplier = plan.billing_cycle === 'annual' ? 1 / 12 : plan.billing_cycle === 'quarterly' ? 1 / 3 : 1;
				metrics[plan.id].mrr += plan.price * cycleMultiplier;
			}
		});

		return metrics;
	}, [plans, subscriptions]);

	const totalMRR = useMemo(
		() =>
			Object.values(planMetrics).reduce((sum, metric) => sum + metric.mrr, 0),
		[planMetrics],
	);

	const totalSubscribers = useMemo(
		() =>
			Object.values(planMetrics).reduce((sum, metric) => sum + metric.subscribers, 0),
		[planMetrics],
	);

	const mostPopularPlan = useMemo(() => {
		if (!plans || plans.length === 0) return null;
		return plans.reduce((max, plan) => {
			const maxMetric = planMetrics[max.id] || { subscribers: 0 };
			const currentMetric = planMetrics[plan.id] || { subscribers: 0 };
			return currentMetric.subscribers > maxMetric.subscribers ? plan : max;
		}, plans[0]);
	}, [plans, planMetrics]);

	const openAddModal = () => {
		setEditingPlan(null);
		setForm(initialFormState);
		setIsModalOpen(true);
	};

	const openEditModal = (plan: Plan) => {
		setEditingPlan(plan);
		setForm({
			name: plan.name,
			description: plan.description ?? '',
			price: String(plan.price),
			billing_cycle: plan.billing_cycle,
		});
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setEditingPlan(null);
		setForm(initialFormState);
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSaving(true);
		try {
			const payload = {
				u: form.name,
				description: form.description || undefined,
				price: Number(form.price),
				billing_cycle: form.billing_cycle,
			};

			if (editingPlan) {
				await apiClient.put(`/plans/${editingPlan.id}`, payload);
				showToast('Plan updated successfully', 'success');
			} else {
				await apiClient.post('/plans/', payload);
				showToast('Plan added successfully', 'success');
			}

			closeModal();
			await refreshPlans();
		} catch {
			showToast('Failed to save plan', 'error');
		} finally {
			setSaving(false);
		}
	};

	const handleToggleActive = async (plan: Plan) => {
		try {
			await apiClient.put(`/plans/${plan.id}`, {
				name: plan.name,
				description: plan.description,
				price: plan.price,
				billing_cycle: plan.billing_cycle,
				is_active: !plan.is_active,
			});
			showToast(`Plan ${plan.is_active ? 'deactivated' : 'activated'} successfully`, 'success');
			await refreshPlans();
		} catch {
			showToast('Failed to update plan status', 'error');
		}
	};

	const handleDeactivate = async (plan: Plan) => {
		const confirmed = window.confirm('Deactivate this plan?');
		if (!confirmed) return;

		try {
			await apiClient.put(`/plans/${plan.id}`, {
				name: plan.name,
				description: plan.description,
				price: plan.price,
				billing_cycle: plan.billing_cycle,
				is_active: false,
			});
			showToast('Plan deactivated successfully', 'success');
			await refreshPlans();
		} catch {
			showToast('Failed to deactivate plan', 'error');
		}
	};

	return (
		<div style={{ padding: '32px', maxWidth: '100%', background: '#030014' }}>
			{/* Header */}
			<div
				style={{
					marginBottom: '48px',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					gap: '24px',
					flexWrap: 'wrap',
				}}
			>
				<div>
					<h1 style={{ fontSize: '40px', fontWeight: '300', color: '#FFFFFF', margin: 0, letterSpacing: '0.02em', marginBottom: '8px' }}>
						Membership Plans
					</h1>
					<p style={{ fontSize: '14px', color: '#8E7CC3', margin: 0, fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
						Manage your subscription architecture
					</p>
				</div>
				<button
					type="button"
					onClick={openAddModal}
					style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: '8px',
						padding: '12px 24px',
						background: '#8B5CF6',
						border: 'none',
						borderRadius: '12px',
						color: '#FFFFFF',
						fontSize: '14px',
						fontWeight: '600',
						cursor: 'pointer',
						transition: 'all 0.2s',
						letterSpacing: '0.05em',
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = '#A78BFA';
						e.currentTarget.style.boxShadow = '0 0 24px rgba(139, 92, 246, 0.4)';
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = '#8B5CF6';
						e.currentTarget.style.boxShadow = 'none';
					}}
				>
					<Plus style={{ width: '16px', height: '16px' }} />
					NEW PLAN
				</button>
			</div>

			{/* Error */}
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

			{/* Plans Grid */}
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: loading ? 'repeat(auto-fill, minmax(320px, 1fr))' : 'repeat(auto-fit, minmax(340px, 1fr))',
					gap: '24px',
					marginBottom: '48px',
				}}
			>
				{loading
					? skeletonCards.map((_, index) => (
						<div
							key={index}
							style={{
								background: 'rgba(16, 6, 35, 0.72)',
								backdropFilter: 'blur(24px)',
								border: '1px solid rgba(139,92,246,0.12)',
								borderRadius: '24px',
								padding: '32px 24px',
								height: '420px',
								opacity: 0.5,
								animation: 'pulse 2s infinite',
							}}
						/>
					))
					: sortedPlans.map((plan) => {
						const tierConfig = getPlanTierConfig(plan.billing_cycle);
						const metric = planMetrics[plan.id] || { subscribers: 0, mrr: 0, trend: 0 };
						const isPopular = mostPopularPlan?.id === plan.id;

						return (
							<div
								key={plan.id}
								style={{
									position: 'relative',
									overflow: 'hidden',
									borderRadius: '24px',
									background: 'rgba(16, 6, 35, 0.72)',
									backdropFilter: 'blur(24px)',
									border: `1px solid ${tierConfig.borderColor}`,
									padding: '32px 24px',
									transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
									transform: tierConfig.tier === 'premium' ? 'scale(1.02)' : 'scale(1)',
									boxShadow: tierConfig.tier === 'premium' ? `0 20px 60px ${tierConfig.glowColor}` : 'none',
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.borderColor = tierConfig.accentColor;
									e.currentTarget.style.boxShadow = `0 20px 60px ${tierConfig.glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`;
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.borderColor = tierConfig.borderColor;
									e.currentTarget.style.boxShadow = tierConfig.tier === 'premium' ? `0 20px 60px ${tierConfig.glowColor}` : 'none';
								}}
							>
								{/* Tier Badge */}
								{tierConfig.tier !== 'accessible' && (
									<div
										style={{
											position: 'absolute',
											top: '0px',
											left: '0px',
											right: '0px',
											height: '3px',
											background: tierConfig.accentColor,
											borderRadius: '24px 24px 0 0',
										}}
									/>
								)}

								{/* Popular Badge */}
								{isPopular && (
									<div
										style={{
											position: 'absolute',
											top: '16px',
											right: '16px',
											display: 'flex',
											alignItems: 'center',
											gap: '6px',
											padding: '6px 12px',
											background: 'rgba(139, 92, 246, 0.15)',
											border: '1px solid rgba(139, 92, 246, 0.3)',
											borderRadius: '20px',
											fontSize: '11px',
											color: '#D8CCFF',
											fontWeight: '600',
											letterSpacing: '0.04em',
										}}
									>
										<Zap style={{ width: '12px', height: '12px' }} />
										MOST POPULAR
									</div>
								)}

								{/* Status Badge */}
								<div
									style={{
										position: 'absolute',
										top: '16px',
										left: '16px',
										width: '12px',
										height: '12px',
										borderRadius: '50%',
										background: plan.is_active ? '#22C55E' : '#8E7CC3',
										boxShadow: plan.is_active ? '0 0 12px rgba(34, 197, 94, 0.4)' : 'none',
									}}
								/>

								{/* Plan Name & Tier Label */}
								<div style={{ marginBottom: '20px', marginTop: tierConfig.tier !== 'accessible' ? '8px' : '0px' }}>
									<div
										style={{
											fontSize: '12px',
											color: tierConfig.accentColor,
											fontWeight: '600',
											letterSpacing: '0.08em',
											textTransform: 'uppercase',
											marginBottom: '6px',
										}}
									>
										{tierConfig.label}
									</div>
									<h2 style={{ fontSize: '24px', fontWeight: '400', color: '#FFFFFF', margin: 0 }}>
										{plan.name}
									</h2>
								</div>

								{/* Price — Dominant */}
								<div style={{ marginBottom: '28px', borderBottom: '1px solid rgba(139,92,246,0.08)', paddingBottom: '24px' }}>
									<div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
										<div style={{ fontSize: '14px', color: '#8E7CC3', fontWeight: '500' }}>₹</div>
										<div style={{ fontSize: tierConfig.prominence === 3 ? '56px' : tierConfig.prominence === 2 ? '48px' : '42px', fontWeight: '300', color: '#FFFFFF', lineHeight: '1' }}>
											{plan.price}
										</div>
										<div style={{ fontSize: '13px', color: '#8E7CC3', fontWeight: '500', marginLeft: '4px' }}>
											/{plan.billing_cycle === 'annual' ? 'year' : plan.billing_cycle === 'quarterly' ? 'quarter' : 'month'}
										</div>
									</div>
									<div style={{ fontSize: '12px', color: '#8E7CC3', marginTop: '8px', fontWeight: '500', letterSpacing: '0.03em' }}>
										{plan.billing_cycle === 'annual' && '₹' + (plan.price / 12).toFixed(0) + '/mo'}
										{plan.billing_cycle === 'quarterly' && '₹' + (plan.price / 3).toFixed(0) + '/mo'}
										{plan.billing_cycle === 'monthly' && plan.price >= 6000 ? '₹' + plan.price + '/mo' : ''}
									</div>
								</div>

								{/* Description */}
								{plan.description && (
									<p style={{ fontSize: '13px', color: '#D8CCFF', lineHeight: '1.6', margin: '0 0 24px 0', minHeight: '40px' }}>
										{plan.description}
									</p>
								)}

								{/* Metrics */}
								<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
									<div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.04)', borderRadius: '12px', textAlign: 'center' }}>
										<div style={{ fontSize: '11px', color: '#8E7CC3', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
											Subscribers
										</div>
										<div style={{ fontSize: '20px', fontWeight: '300', color: '#FFFFFF' }}>
											{metric.subscribers}
										</div>
									</div>
									<div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.04)', borderRadius: '12px', textAlign: 'center' }}>
										<div style={{ fontSize: '11px', color: '#8E7CC3', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
											Monthly MRR
										</div>
										<div style={{ fontSize: '18px', fontWeight: '300', color: tierConfig.accentColor }}>
											₹{Math.round(metric.mrr).toLocaleString()}
										</div>
									</div>
								</div>

								{/* Controls */}
								<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
									{/* Toggle */}
									<button
										type="button"
										onClick={() => handleToggleActive(plan)}
										style={{
											flex: 1,
											padding: '10px 12px',
											background: plan.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(139, 92, 246, 0.05)',
											border: `1px solid ${plan.is_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(139, 92, 246, 0.12)'}`,
											borderRadius: '12px',
											color: plan.is_active ? '#22C55E' : '#8E7CC3',
											fontSize: '12px',
											fontWeight: '600',
											letterSpacing: '0.05em',
											cursor: 'pointer',
											transition: 'all 0.2s',
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.borderColor = `${plan.is_active ? 'rgba(34, 197, 94, 0.4)' : 'rgba(139, 92, 246, 0.3)'}`;
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.borderColor = `${plan.is_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(139, 92, 246, 0.12)'}`;
										}}
									>
										{plan.is_active ? '✓ ACTIVE' : 'INACTIVE'}
									</button>

									{/* Edit */}
									<button
										type="button"
										onClick={() => openEditModal(plan)}
										style={{
											padding: '10px 14px',
											background: 'transparent',
											border: '1px solid rgba(139, 92, 246, 0.12)',
											borderRadius: '12px',
											color: '#D8CCFF',
											fontSize: '12px',
											cursor: 'pointer',
											transition: 'all 0.2s',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
										}}
										onMouseEnter={(e) => {
											e.currentTarget.style.borderColor = '#8B5CF6';
											e.currentTarget.style.color = '#FFFFFF';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.12)';
											e.currentTarget.style.color = '#D8CCFF';
										}}
									>
										<Pencil style={{ width: '14px', height: '14px' }} />
									</button>

									{/* Deactivate */}
									{plan.is_active && (
										<button
											type="button"
											onClick={() => handleDeactivate(plan)}
											style={{
												padding: '10px 14px',
												background: 'transparent',
												border: '1px solid rgba(139, 92, 246, 0.12)',
												borderRadius: '12px',
												color: '#8E7CC3',
												fontSize: '12px',
												cursor: 'pointer',
												transition: 'all 0.2s',
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
											}}
											onMouseEnter={(e) => {
												e.currentTarget.style.borderColor = '#EF4444';
												e.currentTarget.style.color = '#EF4444';
												e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.12)';
												e.currentTarget.style.color = '#8E7CC3';
												e.currentTarget.style.background = 'transparent';
											}}
										>
											<PowerOff style={{ width: '14px', height: '14px' }} />
										</button>
									)}
								</div>
							</div>
						);
					})}
			</div>

			{/* Business Intelligence Section */}
			{!loading && sortedPlans.length > 0 && (
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
						gap: '20px',
						marginBottom: '48px',
					}}
				>
					{/* Total Subscribers */}
					<div
						style={{
							background: 'rgba(16, 6, 35, 0.72)',
							backdropFilter: 'blur(24px)',
							border: '1px solid rgba(139,92,246,0.12)',
							borderRadius: '24px',
							padding: '28px',
							position: 'relative',
							overflow: 'hidden',
						}}
					>
						<div
							style={{
								position: 'absolute',
								top: '-40%',
								right: '-40%',
								width: '300px',
								height: '300px',
								background: 'rgba(139, 92, 246, 0.08)',
								borderRadius: '50%',
								filter: 'blur(60px)',
								pointerEvents: 'none',
							}}
						/>
						<div style={{ position: 'relative', zIndex: 1 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
								<Users style={{ width: '16px', height: '16px', color: '#D8CCFF' }} />
								<div style={{ fontSize: '12px', color: '#8E7CC3', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
									Total Subscribers
								</div>
							</div>
							<div style={{ fontSize: '42px', fontWeight: '300', color: '#FFFFFF', lineHeight: '1' }}>
								{totalSubscribers}
							</div>
							<div style={{ fontSize: '12px', color: '#8E7CC3', marginTop: '8px' }}>
								{totalSubscribers > 0 ? 'Active memberships' : 'No active members yet'}
							</div>
						</div>
					</div>

					{/* Total MRR */}
					<div
						style={{
							background: 'rgba(16, 6, 35, 0.72)',
							backdropFilter: 'blur(24px)',
							border: '1px solid rgba(34, 197, 94, 0.2)',
							borderRadius: '24px',
							padding: '28px',
							position: 'relative',
							overflow: 'hidden',
						}}
					>
						<div
							style={{
								position: 'absolute',
								top: '-40%',
								right: '-40%',
								width: '300px',
								height: '300px',
								background: 'rgba(34, 197, 94, 0.08)',
								borderRadius: '50%',
								filter: 'blur(60px)',
								pointerEvents: 'none',
							}}
						/>
						<div style={{ position: 'relative', zIndex: 1 }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
								<DollarSign style={{ width: '16px', height: '16px', color: '#22C55E' }} />
								<div style={{ fontSize: '12px', color: '#8E7CC3', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
									Monthly Recurring Revenue
								</div>
							</div>
							<div style={{ fontSize: '42px', fontWeight: '300', color: '#22C55E', lineHeight: '1' }}>
								₹{Math.round(totalMRR).toLocaleString()}
							</div>
							<div style={{ fontSize: '12px', color: '#8E7CC3', marginTop: '8px' }}>
								From all active plans
							</div>
						</div>
					</div>

					{/* Most Popular */}
					{mostPopularPlan && (
						<div
							style={{
								background: 'rgba(16, 6, 35, 0.72)',
								backdropFilter: 'blur(24px)',
								border: '1px solid rgba(250, 204, 21, 0.2)',
								borderRadius: '24px',
								padding: '28px',
								position: 'relative',
								overflow: 'hidden',
							}}
						>
							<div
								style={{
									position: 'absolute',
									top: '-40%',
									right: '-40%',
									width: '300px',
									height: '300px',
									background: 'rgba(250, 204, 21, 0.08)',
									borderRadius: '50%',
									filter: 'blur(60px)',
									pointerEvents: 'none',
								}}
							/>
							<div style={{ position: 'relative', zIndex: 1 }}>
								<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
									<Crown style={{ width: '16px', height: '16px', color: '#FACC15' }} />
									<div style={{ fontSize: '12px', color: '#8E7CC3', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
										Most Popular Plan
									</div>
								</div>
								<div style={{ fontSize: '24px', fontWeight: '400', color: '#FACC15', lineHeight: '1' }}>
									{mostPopularPlan.name}
								</div>
								<div style={{ fontSize: '12px', color: '#8E7CC3', marginTop: '8px' }}>
									{(planMetrics[mostPopularPlan.id] || { subscribers: 0 }).subscribers} subscribers
								</div>
							</div>
						</div>
					)}
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
					<div
						style={{
							width: '100%',
							maxWidth: '600px',
							borderRadius: '24px',
							border: '1px solid rgba(139,92,246,0.12)',
							background: 'rgba(16, 6, 35, 0.72)',
							backdropFilter: 'blur(24px)',
							padding: '32px',
							boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
						}}
					>
						<div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<h2 style={{ margin: 0, fontSize: '24px', fontWeight: '400', color: '#FFFFFF', letterSpacing: '0.02em' }}>
								{editingPlan ? 'Edit Plan' : 'Create New Plan'}
							</h2>
							<button
								type="button"
								onClick={closeModal}
								style={{
									background: 'transparent',
									border: 'none',
									color: '#8E7CC3',
									fontSize: '24px',
									cursor: 'pointer',
									padding: '0',
									width: '32px',
									height: '32px',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									transition: 'color 0.2s',
								}}
								onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
								onMouseLeave={(e) => (e.currentTarget.style.color = '#8E7CC3')}
							>
								✕
							</button>
						</div>

						<form
							style={{ display: 'grid', gap: '20px' }}
							onSubmit={handleSubmit}
						>
							{/* Plan Name */}
							<div>
								<label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#8E7CC3', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
									Plan Name
								</label>
								<input
									required
									value={form.name}
									onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
									style={{
										width: '100%',
										borderRadius: '12px',
										border: '1px solid rgba(139,92,246,0.12)',
										background: '#030014',
										padding: '10px 14px',
										color: '#FFFFFF',
										fontSize: '14px',
										outline: 'none',
										transition: 'all 0.2s',
										boxSizing: 'border-box',
									}}
									onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
									onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)')}
								/>
							</div>

							{/* Description */}
							<div>
								<label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#8E7CC3', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
									Description
								</label>
								<textarea
									value={form.description}
									onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
									rows={3}
									style={{
										width: '100%',
										borderRadius: '12px',
										border: '1px solid rgba(139,92,246,0.12)',
										background: '#030014',
										padding: '10px 14px',
										color: '#FFFFFF',
										fontSize: '14px',
										outline: 'none',
										fontFamily: 'inherit',
										resize: 'vertical',
										transition: 'all 0.2s',
										boxSizing: 'border-box',
									}}
									onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
									onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)')}
								/>
							</div>

							{/* Price */}
							<div>
								<label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#8E7CC3', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
									Price (₹)
								</label>
								<input
									required
									type="number"
									min="0"
									value={form.price}
									onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
									style={{
										width: '100%',
										borderRadius: '12px',
										border: '1px solid rgba(139,92,246,0.12)',
										background: '#030014',
										padding: '10px 14px',
										color: '#FFFFFF',
										fontSize: '14px',
										outline: 'none',
										transition: 'all 0.2s',
										boxSizing: 'border-box',
									}}
									onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
									onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)')}
								/>
							</div>

							{/* Billing Cycle */}
							<div>
								<label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#8E7CC3', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
									Billing Cycle
								</label>
								<select
									value={form.billing_cycle}
									onChange={(event) => setForm((current) => ({ ...current, billing_cycle: event.target.value as PlanFormState['billing_cycle'] }))}
									style={{
										width: '100%',
										borderRadius: '12px',
										border: '1px solid rgba(139,92,246,0.12)',
										background: '#030014',
										padding: '10px 14px',
										color: '#FFFFFF',
										fontSize: '14px',
										outline: 'none',
										cursor: 'pointer',
										transition: 'all 0.2s',
										boxSizing: 'border-box',
									}}
									onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
									onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.12)')}
								>
									{billingCycleOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>

							{/* Actions */}
							<div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
								<button
									type="button"
									onClick={closeModal}
									style={{
										padding: '10px 20px',
										background: 'transparent',
										border: '1px solid rgba(139, 92, 246, 0.12)',
										borderRadius: '12px',
										color: '#D8CCFF',
										fontSize: '14px',
										fontWeight: '600',
										cursor: 'pointer',
										transition: 'all 0.2s',
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.borderColor = '#8B5CF6';
										e.currentTarget.style.color = '#FFFFFF';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.12)';
										e.currentTarget.style.color = '#D8CCFF';
									}}
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={saving}
									style={{
										padding: '10px 24px',
										background: '#8B5CF6',
										border: 'none',
										borderRadius: '12px',
										color: '#FFFFFF',
										fontSize: '14px',
										fontWeight: '600',
										cursor: saving ? 'not-allowed' : 'pointer',
										opacity: saving ? 0.6 : 1,
										transition: 'all 0.2s',
									}}
									onMouseEnter={(e) => {
										if (!saving) {
											e.currentTarget.style.background = '#A78BFA';
										}
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = '#8B5CF6';
									}}
								>
									{saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
								</button>
							</div>
						</form>
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
