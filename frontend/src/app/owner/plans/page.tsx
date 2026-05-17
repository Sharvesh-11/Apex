"use client";

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, PowerOff } from 'lucide-react';

import * as apiClient from '@/lib/api';
import type { Plan } from '@/types';
import useUIStore from '@/store/uiStore';

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

export default function OwnerPlansPage() {
	const showToast = useUIStore((state) => state.showToast);
	const [plans, setPlans] = useState<Plan[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [form, setForm] = useState<PlanFormState>(initialFormState);

	useEffect(() => {
		void refreshPlans();
	}, []);

	const refreshPlans = async () => {
		setLoading(true);
		setError(null);
		try {
			const data = await apiClient.get<Plan[]>('/plans/all');
			setPlans(data ?? []);
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
				name: form.name,
				description: form.description || undefined,
				price: Number(form.price),
				billing_cycle: form.billing_cycle,
			};

			if (editingPlan) {
				await apiClient.put(`/plans/${editingPlan.id}`, payload);
				showToast('Plan updated successfully', 'success');
			} else {
				await apiClient.post('/plans', payload);
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
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-3xl font-bold text-textPrimary">Membership Plans</h1>
				<button type="button" onClick={openAddModal} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-textPrimary hover:bg-primaryHover">
					<Plus className="h-4 w-4" />
					Add Plan
				</button>
			</div>

			{error ? <div className="rounded-xl border border-accent bg-surface p-4 text-textSecondary">{error}</div> : null}

			<div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
				{loading
					? skeletonCards.map((_, index) => (
						<div key={index} className="rounded-xl border border-accent bg-surface p-6">
							<div className="h-6 w-1/2 animate-pulse rounded bg-background/60" />
							<div className="mt-4 h-10 w-1/3 animate-pulse rounded bg-background/60" />
							<div className="mt-6 h-16 animate-pulse rounded bg-background/60" />
						</div>
					))
					: sortedPlans.map((plan) => (
						<div key={plan.id} className="rounded-xl border border-accent bg-surface p-6 shadow-sm transition-shadow hover:shadow-lg">
							<div className="flex items-start justify-between gap-4">
								<div>
									<h2 className="text-xl font-bold text-textPrimary">{plan.name}</h2>
									<div className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary capitalize">
										{plan.billing_cycle}
									</div>
								</div>
								<div className="text-right">
									<div className="text-3xl font-bold text-textPrimary">₹{plan.price}</div>
									<div className={`mt-2 text-sm font-medium ${plan.is_active ? 'text-green-400' : 'text-red-400'}`}>
										{plan.is_active ? 'Active' : 'Inactive'}
									</div>
								</div>
							</div>

							{plan.description ? <p className="mt-4 text-sm leading-6 text-textSecondary">{plan.description}</p> : null}

							<div className="mt-6 flex flex-wrap items-center gap-3">
								<label className="inline-flex items-center gap-3 rounded-lg border border-accent px-3 py-2 text-sm text-textSecondary">
									<span>Active</span>
									<button
										type="button"
										onClick={() => handleToggleActive(plan)}
										className={`relative h-6 w-11 rounded-full transition-colors ${plan.is_active ? 'bg-primary' : 'bg-textSecondary/30'}`}
										aria-label={`Toggle ${plan.name} status`}
									>
										<span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${plan.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
									</button>
								</label>

								<button type="button" onClick={() => openEditModal(plan)} className="inline-flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-sm text-textSecondary hover:text-textPrimary">
									<Pencil className="h-4 w-4" />
									Edit
								</button>

								{plan.is_active ? (
									<button type="button" onClick={() => handleDeactivate(plan)} className="inline-flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-sm text-red-400 hover:bg-red-400/10">
										<PowerOff className="h-4 w-4" />
										Deactivate
									</button>
								) : null}
							</div>
						</div>
					))}
			</div>

			{isModalOpen ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
					<div className="w-full max-w-2xl rounded-xl border border-accent bg-surface p-6 shadow-2xl">
						<div className="mb-6 flex items-center justify-between gap-4">
							<h2 className="text-xl font-semibold text-textPrimary">{editingPlan ? 'Edit Plan' : 'Add Plan'}</h2>
							<button type="button" onClick={closeModal} className="rounded p-2 text-textSecondary hover:text-textPrimary" aria-label="Close modal">×</button>
						</div>

						<form className="grid gap-4" onSubmit={handleSubmit}>
							<div>
								<label className="mb-1 block text-sm text-textSecondary">Plan Name</label>
								<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
							</div>

							<div>
								<label className="mb-1 block text-sm text-textSecondary">Description</label>
								<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
							</div>

							<div>
								<label className="mb-1 block text-sm text-textSecondary">Price</label>
								<div className="flex items-center rounded-lg border border-accent bg-background px-4 focus-within:border-primary">
									<span className="text-textSecondary">₹</span>
									<input required type="number" min="0" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} className="w-full bg-transparent px-2 py-2 text-textPrimary outline-none" />
								</div>
							</div>

							<div>
								<label className="mb-1 block text-sm text-textSecondary">Billing Cycle</label>
								<select value={form.billing_cycle} onChange={(event) => setForm((current) => ({ ...current, billing_cycle: event.target.value as PlanFormState['billing_cycle'] }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary">
									{billingCycleOptions.map((option) => (
										<option key={option.value} value={option.value}>{option.label}</option>
									))}
								</select>
							</div>

							<div className="flex justify-end gap-3 pt-2">
								<button type="button" onClick={closeModal} className="rounded-lg border border-accent px-4 py-2 text-textSecondary hover:text-textPrimary">Cancel</button>
								<button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-textPrimary hover:bg-primaryHover disabled:opacity-60">
									{saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}
		</div>
	);
}
