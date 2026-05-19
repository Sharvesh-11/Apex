"use client";

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import type { Member, Subscription } from '@/types';

export type CashPaymentData = {
  member_id: string;
  subscription_id: string;
  amount: number;
  notes: string;
};

type Props = {
  members: Member[];
  onSubmit: (data: CashPaymentData) => Promise<void>;
  onClose: () => void;
};

export default function PaymentForm({ members, onSubmit, onClose }: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMemberId) {
      setSubscriptions([]);
      setSelectedSubscriptionId('');
      setAmount('');
      return;
    }

    const fetchSubs = async () => {
      setIsLoadingSubs(true);
      setSubscriptions([]);
      setSelectedSubscriptionId('');
      setAmount('');

      try {
        const res = await api.get<Subscription[]>(`/subscriptions/member/${selectedMemberId}/`);
          setSubscriptions(res.data ?? []);
      } catch (err) {
        setSubscriptions([]);
      } finally {
        setIsLoadingSubs(false);
      }
    };

    void fetchSubs();
  }, [selectedMemberId]);

  useEffect(() => {
    if (!selectedSubscriptionId) return;
    const sub = subscriptions.find((s) => s.id === selectedSubscriptionId);
    if (sub?.plan?.price) setAmount(sub.plan.price);
  }, [selectedSubscriptionId, subscriptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedMemberId) return setError('Please select a member.');
    if (!selectedSubscriptionId) return setError('Please select a subscription.');
    if (!amount || Number(amount) <= 0) return setError('Please enter a valid amount.');

    const payload: CashPaymentData = {
      member_id: selectedMemberId,
      subscription_id: selectedSubscriptionId,
      amount: Number(amount),
      notes,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError('Failed to log payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  function formatDate(dateStr?: string) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="w-full max-w-lg rounded-xl bg-surface p-6 border border-accent">
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-textPrimary">Log Cash Payment</h3>
        <button type="button" onClick={onClose} className="text-textSecondary hover:text-textPrimary">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error ? <div className="text-sm text-red-400">{error}</div> : null}

        <div>
          <label className="block text-sm text-textSecondary mb-2">Member</label>
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="w-full rounded-md border border-accent bg-background px-3 py-2 text-textPrimary outline-none"
          >
            <option value="">Select member</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name} — {m.email}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-textSecondary mb-2">Subscription</label>
          <select
            value={selectedSubscriptionId}
            onChange={(e) => setSelectedSubscriptionId(e.target.value)}
            disabled={isLoadingSubs || subscriptions.length === 0}
            className="w-full rounded-md border border-accent bg-background px-3 py-2 text-textPrimary outline-none"
          >
            <option value="">Select subscription</option>
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.plan?.name ?? 'Plan'} — ends {formatDate(s.end_date)} — {s.status}
              </option>
            ))}
          </select>

          {isLoadingSubs ? <div className="text-sm text-textSecondary mt-2">Loading subscriptions...</div> : null}
          {selectedSubscriptionId ? (
            <div className="mt-2 text-sm text-textSecondary">
              {/* show selected subscription summary */}
              {(() => {
                const s = subscriptions.find((i) => i.id === selectedSubscriptionId);
                if (!s) return null;
                return (
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      {s.plan?.name} — ends {formatDate(s.end_date)}
                    </div>
                    <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      s.status === 'active' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                    }`}>{s.status}</div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm text-textSecondary mb-2">Amount</label>
          <div className="flex items-center">
            <span className="inline-flex items-center px-3 py-2 rounded-l-md bg-background border border-r-0 border-accent text-textSecondary">₹</span>
            <input
              type="number"
              value={amount as number | ''}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-r-md border border-accent bg-background px-3 py-2 text-textPrimary outline-none"
              min={0}
              step="0.01"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-textSecondary mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cash payment note..."
            className="w-full rounded-md border border-accent bg-background px-3 py-2 text-textPrimary outline-none"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-accent px-4 py-2 text-sm text-textSecondary hover:text-textPrimary"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-textPrimary disabled:opacity-60"
          >
            {isSubmitting ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : null}
            Log Payment
          </button>
        </div>
      </form>
    </div>
  );
}
