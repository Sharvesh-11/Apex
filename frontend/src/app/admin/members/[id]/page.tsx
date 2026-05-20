"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  Phone,
  Mail,
  Pencil,
  Plus,
  Wallet,
  Trash2,
} from 'lucide-react';

import * as apiClient from '@/lib/api';
import type { Member, Payment, Plan, Subscription, AttendanceLog } from '@/types';
import useUIStore from '@/store/uiStore';
import { C } from '@/lib/config';

type RouteParams = {
  id?: string | string[];
};

type MemberDetails = Member & {
  pin?: string;
};

type SubscriptionRecord = Subscription & {
  plan: Plan;
};

type PaymentRecord = Payment & {
  member?: Pick<Member, 'full_name'>;
};

type AttendanceRecord = AttendanceLog;

type EditFormState = {
  full_name: string;
  phone: string;
};

type SubscriptionModalState = {
  plan_id: string;
  start_date: string;
};

type CashPaymentModalState = {
  amount: string;
  notes: string;
};

type TabKey = 'subscription' | 'payments' | 'attendance';

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

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
});

const today = new Date().toISOString().slice(0, 10);

const tabLabels: Array<{ key: TabKey; label: string }> = [
  { key: 'subscription', label: 'Subscription' },
  { key: 'payments', label: 'Payments' },
  { key: 'attendance', label: 'Attendance' },
];

function getInitials(name?: string) {
  if (!name) return 'NA';
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'NA'
  );
}

function getDaysRemaining(endDate: string) {
  const end = new Date(endDate);
  const now = new Date();
  const endOfToday = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((endOfToday.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
}

function getPercentageThrough(startDate: string, endDate: string) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const total = Math.max(end - start, 1);
  const elapsed = Math.min(Math.max(now - start, 0), total);
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide ${className}`}>
      {children}
    </span>
  );
}

function ModalShell({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className={`w-full max-w-2xl p-6 shadow-2xl ${C.SURFACE_CLASS}`}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h3 className="text-xl font-light text-textPrimary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[rgba(139,92,246,0.2)] px-3 py-1 text-textSecondary transition-colors hover:text-textPrimary"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminMemberDetailPage() {
  const params = useParams<RouteParams>();
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);

  const memberId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [member, setMember] = useState<MemberDetails | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('subscription');
  const [isEditing, setIsEditing] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormState>({ full_name: '', phone: '' });
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionModalState>({
    plan_id: '',
    start_date: today,
  });
  const [cashForm, setCashForm] = useState<CashPaymentModalState>({ amount: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [processingCancelId, setProcessingCancelId] = useState<string | null>(null);
  const [processingDeleteId, setProcessingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId) return;

    let mounted = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [
          memberResponse,
          subscriptionResponse,
          paymentResponse,
          attendanceResponse,
          planResponse,
        ] = await Promise.all([
          apiClient.get<MemberDetails>(`/members/${memberId}`),
                apiClient.get<SubscriptionRecord[]>(`/subscriptions/member/${memberId}`),
          apiClient.get<PaymentRecord[]>(`/payments/member/${memberId}`),
          apiClient.get<AttendanceRecord[]>(`/attendance/member/${memberId}`),
          apiClient.get<Plan[]>('/plans/'),
        ]);

                if (!mounted) return;

					// Filter out pending subscriptions: only show active or cancelled
					const filteredSubscriptions = (subscriptionResponse ?? []).filter(
						(s) => s.status === 'active' || s.status === 'cancelled'
					);

                setMember(memberResponse);
                setSubscriptions(filteredSubscriptions);
        setPayments(paymentResponse ?? []);
        setAttendance(attendanceResponse ?? []);
        setPlans(planResponse ?? []);
        setEditForm({
          full_name: memberResponse.full_name ?? '',
          phone: memberResponse.phone ?? '',
        });
        const currentPlan =
          subscriptionResponse?.find((sub) => sub.status === 'active') ??
          subscriptionResponse?.[0];
        setSubscriptionForm((current) => ({
          ...current,
          plan_id: current.plan_id || planResponse?.[0]?.id || currentPlan?.plan_id || '',
          start_date: current.start_date || today,
        }));
        setCashForm((current) => ({
          ...current,
          amount:
            current.amount ||
            String(currentPlan?.plan?.price ?? planResponse?.[0]?.price ?? 0),
        }));
      } catch {
        if (!mounted) return;
        setError('Failed to load member details');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [memberId]);

  const refreshSubscriptions = async () => {
    if (!memberId) return [] as SubscriptionRecord[];
    try {
      const next = await apiClient.get<SubscriptionRecord[]>(`/subscriptions/member/${memberId}`);
      const filtered = (next ?? []).filter((s) => s.status === 'active' || s.status === 'cancelled');
      setSubscriptions(filtered);
      return filtered;
    } catch (err) {
      console.error('Failed to refresh subscriptions:', err);
      return [] as SubscriptionRecord[];
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!window.confirm('Cancel this subscription? The member will lose access.')) return;
    setProcessingCancelId(subscriptionId);
    try {
      await apiClient.put(`/subscriptions/${subscriptionId}/cancel`);
      showToast('Subscription cancelled', 'success');
      await refreshSubscriptions();
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      showToast('Failed to cancel subscription', 'error');
    } finally {
      setProcessingCancelId(null);
    }
  };

  const handleDeleteSubscriptionLog = async (subscriptionId: string) => {
    if (!window.confirm('Delete this subscription log permanently?')) return;
    setProcessingDeleteId(subscriptionId);
    try {
      await apiClient.del(`/subscriptions/${subscriptionId}`);
      showToast('Log deleted', 'success');
      await refreshSubscriptions();
    } catch (err) {
      console.error('Failed to delete subscription log:', err);
      showToast('Failed to delete log', 'error');
    } finally {
      setProcessingDeleteId(null);
    }
  };

  

  const currentSubscription = useMemo(() => {
    return subscriptions.find((subscription) => subscription.status === 'active') ?? null;
  }, [subscriptions]);

  const currentSubscriptionDaysRemaining = currentSubscription
    ? getDaysRemaining(currentSubscription.end_date)
    : 0;
  const currentSubscriptionProgress = currentSubscription
    ? getPercentageThrough(currentSubscription.start_date, currentSubscription.end_date)
    : 0;

  const totalCheckinsThisMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return attendance.filter((entry) => {
      const time = new Date(entry.checked_in_at);
      return time >= startOfMonth && time <= endOfMonth;
    }).length;
  }, [attendance]);

  const totalPaymentVolume = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments]
  );

  const memberInitials = getInitials(member?.full_name);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 animate-pulse rounded-xl bg-[rgba(139,92,246,0.1)]" />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className={`${C.SURFACE_CLASS} p-6`}>
            <div className="h-48 animate-pulse rounded-xl bg-[rgba(139,92,246,0.1)]" />
          </div>
          <div className={`${C.SURFACE_CLASS} p-6`}>
            <div className="h-48 animate-pulse rounded-xl bg-[rgba(139,92,246,0.1)]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className={`${C.SURFACE_CLASS} p-6 text-textSecondary`}>
        {error ?? 'Member not found'}
      </div>
    );
  }

  const handleSaveMember = async () => {
    setSaving(true);
    try {
      const updated = await apiClient.put<MemberDetails>(`/members/${memberId}`, {
        full_name: editForm.full_name,
        phone: editForm.phone || null,
      });
      setMember(updated);
      setIsEditing(false);
      showToast('Member updated successfully', 'success');
    } catch {
      showToast('Failed to update member', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubscriptionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setModalSaving(true);
    try {
      await apiClient.post('/subscriptions', {
        member_id: memberId,
        plan_id: subscriptionForm.plan_id,
        start_date: subscriptionForm.start_date,
        status: 'active',
      });
      showToast('Subscription added successfully', 'success');
      setIsSubscriptionModalOpen(false);
      const nextSubscriptions = await apiClient.get<SubscriptionRecord[]>(
        `/subscriptions/member/${memberId}`
      );
      setSubscriptions(nextSubscriptions ?? []);
    } catch {
      showToast('Failed to add subscription', 'error');
    } finally {
      setModalSaving(false);
    }
  };

  const handleCashPaymentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setModalSaving(true);
    try {
      await apiClient.post('/payments/cash', {
        member_id: memberId,
        subscription_id: currentSubscription?.id ?? null,
        amount: Number(cashForm.amount),
        notes: cashForm.notes,
      });
      showToast('Cash payment logged successfully', 'success');
      setIsCashModalOpen(false);
      const nextPayments = await apiClient.get<PaymentRecord[]>(`/payments/member/${memberId}`);
      setPayments(nextPayments ?? []);
    } catch {
      showToast('Failed to log cash payment', 'error');
    } finally {
      setModalSaving(false);
    }
  };

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.07)_0%,transparent_70%)]" />
        <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.05)_0%,transparent_70%)]" />
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/admin/members"
          className="inline-flex items-center gap-2 rounded-xl border border-[rgba(139,92,246,0.2)] bg-[rgba(3,0,20,0.55)] px-3.5 py-2 text-sm text-[#D8CCFF] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className={`${C.SURFACE_CLASS} relative overflow-hidden p-6`}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(139,92,246,0.11),transparent_55%)]" />

          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.2)] text-xl font-medium text-white">
                {memberInitials}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-light text-textPrimary md:text-[2rem]">{member.full_name}</h1>
                  <Badge
                    className={
                      member.is_active
                        ? 'border-green-300/20 bg-[rgba(34,197,94,0.16)] text-green-300'
                        : 'border-red-300/20 bg-[rgba(239,68,68,0.16)] text-red-300'
                    }
                  >
                    {member.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-[#D8CCFF]">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[#8B5CF6]" /> {member.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[#8B5CF6]" /> {member.phone || '—'}
                  </div>
                  <div className="flex items-center gap-2 text-[#A995DE]">
                    <CalendarDays className="h-4 w-4 text-[#8B5CF6]" /> Joined{' '}
                    {dateFormatter.format(new Date(member.joined_at))}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditing((state) => !state)}
              className="inline-flex items-center gap-2 rounded-xl border border-[rgba(139,92,246,0.24)] bg-[rgba(139,92,246,0.1)] px-4 py-2 text-sm text-[#D8CCFF] transition-colors hover:text-white"
            >
              <Pencil className="h-4 w-4" />
              Edit member
            </button>
          </div>

          {isEditing ? (
            <div className="relative z-10 mt-5 grid gap-4 rounded-2xl border border-[rgba(139,92,246,0.14)] bg-[rgba(3,0,20,0.48)] p-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-textSecondary">Name</label>
                <input
                  value={editForm.full_name}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, full_name: event.target.value }))
                  }
                  className={C.FIELD_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-textSecondary">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  className={C.FIELD_CLASS}
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-[rgba(139,92,246,0.2)] px-4 py-2 text-textSecondary transition-colors hover:text-textPrimary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMember}
                  disabled={saving}
                  className="rounded-xl bg-primary px-4 py-2 text-textPrimary transition-colors hover:bg-primaryHover disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className={`${C.SURFACE_CLASS} p-5`}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[rgba(139,92,246,0.14)] bg-[rgba(3,0,20,0.45)] p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-[#8E7CC3]">Subscription</div>
              <div className="mt-2 text-sm text-white">{currentSubscription?.plan?.name ?? 'No active plan'}</div>
            </div>
            <div className="rounded-2xl border border-[rgba(139,92,246,0.14)] bg-[rgba(3,0,20,0.45)] p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-[#8E7CC3]">Days Remaining</div>
              <div className={`mt-2 text-xl font-light ${currentSubscriptionDaysRemaining <= 3 ? 'text-red-300' : 'text-white'}`}>
                {currentSubscription ? currentSubscriptionDaysRemaining : '-'}
              </div>
            </div>
            <div className="rounded-2xl border border-[rgba(139,92,246,0.14)] bg-[rgba(3,0,20,0.45)] p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-[#8E7CC3]">Payment Volume</div>
              <div className="mt-2 text-xl font-light text-white">{currencyFormatter.format(totalPaymentVolume)}</div>
            </div>
            <div className="rounded-2xl border border-[rgba(139,92,246,0.14)] bg-[rgba(3,0,20,0.45)] p-3">
              <div className="text-xs uppercase tracking-[0.12em] text-[#8E7CC3]">Check-ins / Month</div>
              <div className="mt-2 text-xl font-light text-white">{totalCheckinsThisMonth}</div>
            </div>
          </div>
        </section>
      </div>

      <div className={`${C.SURFACE_CLASS} p-2`}>
        <div className="flex flex-wrap gap-2">
          {tabLabels.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-[rgba(139,92,246,0.2)] text-[#D8CCFF] shadow-[0_0_0_1px_rgba(139,92,246,0.24)_inset]'
                  : 'text-[#A995DE] hover:bg-[rgba(139,92,246,0.1)] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subscription tab */}
      {activeTab === 'subscription' ? (
        <div className="space-y-6">
          {currentSubscription ? (
            <div className={`${C.SURFACE_CLASS} p-6`}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm text-[#8E7CC3]">Current Active Subscription</div>
                  <div className="mt-1 text-2xl font-light text-textPrimary">
                    {currentSubscription.plan?.name}
                  </div>
                  <div className="mt-2 text-[#D8CCFF]">
                    {`${currentSubscription.plan.billing_cycle} • ${dateFormatter.format(
                      new Date(currentSubscription.start_date),
                    )} - ${dateFormatter.format(new Date(currentSubscription.end_date))}`}
                  </div>
                  <div
                    className={`mt-3 text-sm font-medium ${
                      currentSubscriptionDaysRemaining <= 3 ? 'text-red-300' : 'text-[#8E7CC3]'
                    }`}
                  >
                    {currentSubscriptionDaysRemaining} day{currentSubscriptionDaysRemaining === 1 ? '' : 's'} remaining
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSubscriptionModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-textPrimary transition-colors hover:bg-primaryHover"
                >
                  <Plus className="h-4 w-4" /> Add New Subscription
                </button>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm text-[#8E7CC3]">
                  <span>Subscription progress</span>
                  <span>{currentSubscriptionProgress}%</span>
                </div>
                <div className="h-3 rounded-full bg-[rgba(3,0,20,0.7)]">
                  <div
                    className="h-3 rounded-full bg-primary transition-all"
                    style={{ width: `${currentSubscriptionProgress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className={`${C.SURFACE_CLASS} p-6`}>
              <div className="text-lg font-light text-textPrimary">No active subscription</div>
              <div className="mt-2 text-[#8E7CC3]">Use Add New Subscription to assign a plan</div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIsSubscriptionModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-textPrimary transition-colors hover:bg-primaryHover"
                >
                  <Plus className="h-4 w-4" /> Add New Subscription
                </button>
              </div>
            </div>
          )}

          <div className={`${C.SURFACE_CLASS} space-y-3 p-3 md:p-4`}>
            {subscriptions.length > 0 ? (
              subscriptions.map((subscription) => (
                <article
                  key={subscription.id}
                  className="rounded-2xl border border-[rgba(139,92,246,0.12)] bg-[linear-gradient(135deg,rgba(16,6,35,0.72),rgba(8,2,25,0.9))] p-4 transition-all duration-200 hover:border-[rgba(139,92,246,0.24)]"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-medium text-white">{subscription.plan.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#8E7CC3]">
                        {subscription.plan.billing_cycle}
                      </p>
                      <p className="mt-2 text-sm text-[#D8CCFF]">
                        {dateFormatter.format(new Date(subscription.start_date))} - {dateFormatter.format(new Date(subscription.end_date))}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={
                          subscription.status === 'active'
                            ? 'border-green-300/20 bg-[rgba(34,197,94,0.16)] text-green-300'
                            : 'border-[rgba(142,124,195,0.25)] bg-[rgba(142,124,195,0.12)] text-[#D8CCFF]'
                        }
                      >
                        {subscription.status}
                      </Badge>

                      {subscription.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleCancelSubscription(subscription.id)}
                          disabled={processingCancelId === subscription.id}
                          className="rounded-xl border border-red-300/25 px-3 py-1.5 text-sm text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-60"
                        >
                          {processingCancelId === subscription.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      ) : subscription.status === 'cancelled' ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteSubscriptionLog(subscription.id)}
                          disabled={processingDeleteId === subscription.id}
                          className="inline-flex items-center rounded-xl border border-[rgba(139,92,246,0.18)] px-3 py-1.5 text-sm text-[#D8CCFF] transition-colors hover:text-red-300 disabled:opacity-60"
                        >
                          {processingDeleteId === subscription.id ? (
                            'Deleting...'
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Log
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-[rgba(139,92,246,0.12)] bg-[rgba(3,0,20,0.52)] px-6 py-10 text-center text-[#8E7CC3]">
                No subscription history found
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Payments tab */}
      {activeTab === 'payments' ? (
        <div className="space-y-6">
          <div className={`${C.SURFACE_CLASS} flex items-center justify-between p-6`}>
            <h2 className="text-xl font-light text-textPrimary">Payments</h2>
            <button
              type="button"
              onClick={() => setIsCashModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-textPrimary transition-colors hover:bg-primaryHover"
            >
              <Wallet className="h-4 w-4" /> Log Cash Payment
            </button>
          </div>

          <div className={`${C.SURFACE_CLASS} space-y-3 p-3 md:p-4`}>
            {payments.length > 0 ? (
              payments.map((payment) => (
                <article
                  key={payment.id}
                  className="rounded-2xl border border-[rgba(139,92,246,0.12)] bg-[linear-gradient(135deg,rgba(16,6,35,0.72),rgba(8,2,25,0.9))] p-4 transition-all duration-200 hover:border-[rgba(139,92,246,0.24)]"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-light text-white">{currencyFormatter.format(Number(payment.amount))}</p>
                      <p className="mt-1 text-sm text-[#A995DE]">{dateFormatter.format(new Date(payment.paid_at ?? payment.created_at))}</p>
                      <p className="mt-2 text-sm text-[#D8CCFF]">{payment.notes || 'No notes'}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={
                          payment.payment_method === 'cash'
                            ? 'border-yellow-300/20 bg-[rgba(250,204,21,0.15)] text-yellow-300'
                            : 'border-blue-300/20 bg-[rgba(96,165,250,0.14)] text-blue-300'
                        }
                      >
                        {payment.payment_method}
                      </Badge>

                      <Badge
                        className={
                          payment.payment_status === 'completed'
                            ? 'border-green-300/20 bg-[rgba(34,197,94,0.16)] text-green-300'
                            : payment.payment_status === 'failed'
                              ? 'border-red-300/20 bg-[rgba(239,68,68,0.14)] text-red-300'
                              : 'border-[rgba(142,124,195,0.25)] bg-[rgba(142,124,195,0.12)] text-[#D8CCFF]'
                        }
                      >
                        {payment.payment_status}
                      </Badge>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-[rgba(139,92,246,0.12)] bg-[rgba(3,0,20,0.52)] px-6 py-10 text-center text-[#8E7CC3]">
                No payments recorded
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Attendance tab */}
      {activeTab === 'attendance' ? (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <div className={`${C.SURFACE_CLASS} p-6`}>
            <h2 className="text-xl font-light text-textPrimary">Last 10 Check-Ins</h2>
            <div className="mt-5 space-y-3">
              {attendance.length > 0 ? (
                attendance.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-[rgba(139,92,246,0.14)] bg-[rgba(3,0,20,0.52)] px-4 py-3 transition-colors hover:border-[rgba(139,92,246,0.24)]"
                  >
                    <div>
                      <div className="text-textPrimary">
                        {dateFormatter.format(new Date(entry.checked_in_at))}
                      </div>
                      <div className="text-sm text-[#8E7CC3]">
                        {timeFormatter.format(new Date(entry.checked_in_at))}
                      </div>
                    </div>
                    <Badge
                      className={
                        entry.method === 'qr'
                          ? 'border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.16)] text-[#D8CCFF]'
                          : 'border-yellow-300/20 bg-[rgba(250,204,21,0.15)] text-yellow-300'
                      }
                    >
                      {entry.method}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-[rgba(139,92,246,0.12)] bg-[rgba(3,0,20,0.52)] px-5 py-8 text-[#8E7CC3]">
                  No attendance records found
                </div>
              )}
            </div>
          </div>

          <div className={`${C.SURFACE_CLASS} relative overflow-hidden p-6`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(34,197,94,0.07),transparent_65%)]" />
            <div className="relative z-10 text-sm text-[#8E7CC3]">Check-ins this month</div>
            <div className="relative z-10 mt-2 text-4xl font-light text-textPrimary">{totalCheckinsThisMonth}</div>
          </div>
        </div>
      ) : null}

      {/* Add Subscription modal */}
      {isSubscriptionModalOpen ? (
        <ModalShell
          title="Add New Subscription"
          onClose={() => setIsSubscriptionModalOpen(false)}
        >
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubscriptionSubmit}>
            <div>
              <label className="mb-1 block text-sm text-textSecondary">Select Plan</label>
              <select
                required
                value={subscriptionForm.plan_id}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({ ...current, plan_id: event.target.value }))
                }
                className={C.FIELD_CLASS}
              >
                <option value="">Select a plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-textSecondary">Start Date</label>
              <input
                type="date"
                value={subscriptionForm.start_date}
                onChange={(event) =>
                  setSubscriptionForm((current) => ({
                    ...current,
                    start_date: event.target.value,
                  }))
                }
                className={C.FIELD_CLASS}
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsSubscriptionModalOpen(false)}
                className="rounded-xl border border-[rgba(139,92,246,0.2)] px-4 py-2 text-textSecondary transition-colors hover:text-textPrimary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalSaving}
                className="rounded-xl bg-primary px-4 py-2 text-textPrimary transition-colors hover:bg-primaryHover disabled:opacity-60"
              >
                {modalSaving ? 'Saving...' : 'Create Subscription'}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {/* Cash payment modal */}
      {isCashModalOpen ? (
        <ModalShell title="Log Cash Payment" onClose={() => setIsCashModalOpen(false)}>
          <form className="grid gap-4" onSubmit={handleCashPaymentSubmit}>
            <div>
              <label className="mb-1 block text-sm text-textSecondary">Amount</label>
              <input
                type="number"
                required
                value={cashForm.amount}
                onChange={(event) =>
                  setCashForm((current) => ({ ...current, amount: event.target.value }))
                }
                className={C.FIELD_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-textSecondary">Notes</label>
              <textarea
                value={cashForm.notes}
                onChange={(event) =>
                  setCashForm((current) => ({ ...current, notes: event.target.value }))
                }
                className={C.FIELD_CLASS}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCashModalOpen(false)}
                className="rounded-xl border border-[rgba(139,92,246,0.2)] px-4 py-2 text-textSecondary transition-colors hover:text-textPrimary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={modalSaving}
                className="rounded-xl bg-primary px-4 py-2 text-textPrimary transition-colors hover:bg-primaryHover disabled:opacity-60"
              >
                {modalSaving ? 'Saving...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}