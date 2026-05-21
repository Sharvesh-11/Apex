"use client";

import React from 'react';
import { Pencil } from 'lucide-react';
import type { Plan } from '@/types';

type Props = {
	plan: Plan;
	onEdit: (plan: Plan) => void;
	onToggleActive: (planId: string, currentStatus: boolean) => void;
};

const billingLabel = (cycle: Plan['billing_cycle']) => {
	if (cycle === 'monthly') return 'Monthly';
	if (cycle === 'half_yearly') return '6 Months';
	return 'Annual';
};

export default function PlanCard({ plan, onEdit, onToggleActive }: Props) {
	const cycleLabel = billingLabel(plan.billing_cycle);

	const badgeClasses =
		plan.billing_cycle === 'monthly'
			? 'bg-blue-400/10 text-blue-400'
			: plan.billing_cycle === 'half_yearly'
			? 'bg-purple-400/10 text-purple-400'
			: 'bg-green-400/10 text-green-400';

	return (
		<div className="bg-surface rounded-xl p-6 border border-accent hover:border-primary transition">
			<div className="flex items-start justify-between">
				<div>
					<div className="text-textPrimary font-bold text-lg">{plan.name}</div>
					<div className={`mt-2 inline-flex items-center text-xs rounded-full px-2.5 py-1 ${badgeClasses}`}>
						{cycleLabel}
					</div>
				</div>

				<div className="ml-4 flex items-center">
					<button
						type="button"
						onClick={() => onToggleActive(plan.id, plan.is_active)}
						aria-pressed={plan.is_active}
						className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
							plan.is_active ? 'bg-primary' : 'bg-accent'
						}`}
					>
						<span
							className={`ml-1 h-4 w-4 transform rounded-full bg-white transition-transform ${
								plan.is_active ? 'translate-x-6' : 'translate-x-0'
							}`}
						/>
					</button>
				</div>
			</div>

			<div className="mt-4">
				<div className="text-2xl font-semibold text-textPrimary">₹{plan.price.toLocaleString('en-IN')}</div>
				<div className="text-sm text-textSecondary">per {cycleLabel.toLowerCase()}</div>

				{plan.description ? (
					<p className="text-textSecondary text-sm mt-2">{plan.description}</p>
				) : null}
			</div>

			<div className="mt-6 flex items-center justify-between">
				<button
					type="button"
					onClick={() => onEdit(plan)}
					className="inline-flex items-center gap-2 rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"
				>
					<Pencil className="h-4 w-4" />
					Edit
				</button>

				{plan.is_active ? (
					<span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
						Active
					</span>
				) : (
					<span className="text-textSecondary text-xs">Inactive</span>
				)}
			</div>
		</div>
	);
}
