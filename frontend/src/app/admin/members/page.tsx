"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  UserX,
  Search,
  Plus,
  X,
  ChevronDown,
  ShieldCheck,
  Users,
  UserCheck,
  UserMinus,
  Crown,
  Shield,
  Sparkles,
} from 'lucide-react';

import * as apiClient from '@/lib/api';
import type { Member, Plan, Subscription } from '@/types';
import useUIStore from '@/store/uiStore';
import { C } from '@/lib/config';

type MemberRecord = Member & {
  status?: 'active' | 'inactive';
  subscription?: Subscription | null;
  role?: string;
};

type AddMemberFormState = {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  plan_id: string;
  start_date: string;
};

const today = new Date().toISOString().slice(0, 10);

const initialFormState: AddMemberFormState = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  plan_id: '',
  start_date: today,
};

const memberSkeletons = Array.from({ length: 6 });

const SURFACE_CLASS =
  'rounded-[24px] border border-[rgba(139,92,246,0.12)] bg-[rgba(16,6,35,0.72)] backdrop-blur-[24px]';

function generateStrongPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  return Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function getInitialFilter(member: MemberRecord) {
  return member.status ?? (member.is_active ? 'active' : 'inactive');
}

export default function AdminMembersPage() {
  const showToast = useUIStore((state) => state.showToast);
  const toast = useUIStore((state) => state.toast);
  const clearToast = useUIStore((state) => state.clearToast);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [roleModalMember, setRoleModalMember] = useState<MemberRecord | null>(null);
  const [roleSelection, setRoleSelection] = useState<string>('gym_member');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<AddMemberFormState>(initialFormState);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => clearToast(), 3000);
    return () => window.clearTimeout(timeout);
  }, [clearToast, toast]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const [membersResponse, plansResponse] = await Promise.all([
          apiClient.get<MemberRecord[]>('/members/'),
          apiClient.get<Plan[]>('/plans/'),
        ]);

        if (!mounted) return;
        const fetchedMembers = (membersResponse ?? []) as MemberRecord[];
        const fetchedPlans = plansResponse ?? [];

        // member objects already include a `role` field from the API; use it or default to 'gym_member'
        for (const m of fetchedMembers) {
          m.role = (m as any).role ?? 'gym_member';
        }
        setMembers(fetchedMembers);
        setPlans(fetchedPlans);
        setForm((current) => ({
          ...current,
          password: current.password || generateStrongPassword(),
          plan_id: current.plan_id || fetchedPlans?.[0]?.id || '',
        }));
      } catch (err) {
        console.error('Failed to load members or plans', err);
        if (!mounted) return;
        setError('Failed to load members');
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

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !term ||
        member.full_name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term);

      const status = getInitialFilter(member);
      const matchesFilter = selectedFilter === 'all' || status === selectedFilter;

      return matchesSearch && matchesFilter;
    });
  }, [members, search, selectedFilter]);

  const platformStats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let activeMembers = 0;
    let owners = 0;
    let admins = 0;
    let recentlyJoined = 0;

    for (const member of members) {
      const role = member.role ?? 'gym_member';
      const isActive = getInitialFilter(member) === 'active';
      const joinedAt = new Date(member.joined_at).getTime();

      if (isActive) activeMembers += 1;
      if (role === 'gym_owner') owners += 1;
      if (role === 'admin') admins += 1;
      if (!Number.isNaN(joinedAt) && joinedAt >= sevenDaysAgo) recentlyJoined += 1;
    }

    return {
      totalMembers: members.length,
      activeMembers,
      inactiveMembers: Math.max(0, members.length - activeMembers),
      owners,
      admins,
      recentlyJoined,
    };
  }, [members]);

  const activePlanOptions = plans.filter((plan) => plan.is_active !== false);

  const refreshMembers = async () => {
    const nextMembers = await apiClient.get<MemberRecord[]>('/members/');

    const fetchedMembers = nextMembers ?? [];

    for (const m of fetchedMembers) {
      m.role = (m as any).role ?? 'gym_member';
    }
    setMembers(fetchedMembers);
  };

  const handleDeactivate = async (memberId: string) => {
    const confirmed = window.confirm('Are you sure you want to deactivate this member?');
    if (!confirmed) return;

    try {
      await apiClient.del(`/members/${memberId}`);
      showToast('Member deactivated successfully', 'success');
      await refreshMembers();
    } catch {
      showToast('Failed to deactivate member', 'error');
    }
  };

  const handleUpdateRole = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roleModalMember) return;
    setIsUpdatingRole(true);
    try {
      const userId = roleModalMember.user_id;
      if (!userId) throw new Error('Missing user id');
      await apiClient.put(`/auth/users/${userId}/set-role`, { role: roleSelection });
      showToast('Role updated successfully', 'success');
      setRoleModalMember(null);
      await refreshMembers();
    } catch (err) {
      console.error('Failed to update role', err);
      showToast('Failed to update role', 'error');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const openAddMemberModal = () => {
    setForm({
      full_name: '',
      email: '',
      phone: '',
      password: generateStrongPassword(),
      plan_id: activePlanOptions[0]?.id ?? '',
      start_date: today,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.plan_id) {
      showToast('Please select a plan', 'error');
      return;
    }

    setSaving(true);
    try {
      const createdMember = await apiClient.post<MemberRecord>('/members', {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });

      const selectedPlan = plans.find((plan) => plan.id === form.plan_id);

      await apiClient.post('/subscriptions', {
        member_id: createdMember.id,
        plan_id: form.plan_id,
        start_date: form.start_date,
        status: 'active',
        plan: selectedPlan,
      });

      showToast('Member created successfully', 'success');
      setIsModalOpen(false);
      setForm(initialFormState);
      await refreshMembers();
    } catch {
      showToast('Failed to create member', 'error');
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    {
      key: 'total',
      label: 'Total Members',
      value: platformStats.totalMembers,
      icon: <Users className="h-4 w-4" />,
      glow: 'rgba(139,92,246,0.08)',
    },
    {
      key: 'active',
      label: 'Active Members',
      value: platformStats.activeMembers,
      icon: <UserCheck className="h-4 w-4" />,
      glow: 'rgba(34,197,94,0.08)',
    },
    {
      key: 'inactive',
      label: 'Inactive Members',
      value: platformStats.inactiveMembers,
      icon: <UserMinus className="h-4 w-4" />,
      glow: 'rgba(239,68,68,0.08)',
    },
    {
      key: 'owners',
      label: 'Owners',
      value: platformStats.owners,
      icon: <Crown className="h-4 w-4" />,
      glow: 'rgba(139,92,246,0.08)',
    },
    {
      key: 'admins',
      label: 'Admins',
      value: platformStats.admins,
      icon: <Shield className="h-4 w-4" />,
      glow: 'rgba(239,68,68,0.07)',
    },
    {
      key: 'recent',
      label: 'Recently Joined',
      value: platformStats.recentlyJoined,
      icon: <Sparkles className="h-4 w-4" />,
      glow: 'rgba(96,165,250,0.08)',
    },
  ];

  return (
    <div className="relative space-y-8 pb-4">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.09)_0%,transparent_70%)]" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.06)_0%,transparent_70%)]" />
      </div>

      {toast ? (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl border px-4 py-3 backdrop-blur-[16px] ${
            toast.type === 'success'
              ? 'border-green-400/30 bg-green-400/12 text-green-300'
              : toast.type === 'error'
                ? 'border-red-400/30 bg-red-400/12 text-red-300'
                : 'border-[rgba(139,92,246,0.18)] bg-[rgba(16,6,35,0.85)] text-textPrimary'
            }`}
        >
          {toast.message}
        </div>
      ) : null}

      {roleModalMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleUpdateRole} className={`w-full max-w-md p-6 shadow-xl ${C.SURFACE_CLASS}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-light text-textPrimary">Update Role for {roleModalMember.full_name}</h3>
              <button type="button" onClick={() => setRoleModalMember(null)} className="rounded-xl border border-[rgba(139,92,246,0.2)] p-2 text-textSecondary transition-colors hover:text-textPrimary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-1 block text-sm text-textSecondary">Select Role</label>
            <select value={roleSelection} onChange={(e) => setRoleSelection(e.target.value)} className="mb-4 w-full rounded-xl border border-[rgba(139,92,246,0.18)] bg-[rgba(3,0,20,0.6)] px-4 py-2 text-textPrimary outline-none focus:border-primary">
              <option value="gym_member">Member</option>
              <option value="gym_owner">Owner</option>
              <option value="admin">Admin</option>
            </select>

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setRoleModalMember(null)} className="rounded-xl border border-[rgba(139,92,246,0.2)] px-4 py-2 text-textSecondary transition-colors hover:text-textPrimary">Cancel</button>
              <button type="submit" disabled={isUpdatingRole} className="rounded-xl bg-primary px-4 py-2 text-textPrimary transition-colors hover:bg-primaryHover disabled:opacity-60">{isUpdatingRole ? 'Updating...' : 'Update Role'}</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className={`p-5 md:p-6 ${C.SURFACE_CLASS}`}>
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-wide text-textPrimary md:text-3xl">Platform Members</h1>
            <p className="mt-1 text-sm text-[#8E7CC3]">Live ecosystem operator console for identity and access control.</p>
          </div>
          <button
            type="button"
            onClick={openAddMemberModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(139,92,246,0.35)] bg-[linear-gradient(135deg,rgba(139,92,246,0.35),rgba(139,92,246,0.18))] px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(139,92,246,0.25)] transition-transform hover:scale-[1.01]"
          >
            <Plus className="h-4 w-4" />
            Add Member
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E7CC3]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-xl border border-[rgba(139,92,246,0.18)] bg-[rgba(3,0,20,0.65)] py-3 pl-11 pr-4 text-textPrimary outline-none placeholder:text-[#8E7CC3] transition-colors focus:border-primary"
            />
          </div>

          <div className="inline-flex w-full rounded-xl border border-[rgba(139,92,246,0.16)] bg-[rgba(3,0,20,0.65)] p-1 lg:w-auto">
            {(['all', 'active', 'inactive'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedFilter(filter)}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium capitalize transition-all lg:flex-none ${
                  selectedFilter === filter
                    ? 'bg-[rgba(139,92,246,0.2)] text-[#D8CCFF] shadow-[0_0_0_1px_rgba(139,92,246,0.15)_inset]'
                    : 'text-[#8E7CC3] hover:text-textPrimary'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {statCards.map((card) => (
          <div key={card.key} className={`${C.SURFACE_CLASS} relative overflow-hidden p-4`}>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(110px 70px at 30% 25%, ${card.glow}, transparent 70%)`,
              }}
            />
            <div className="relative z-10 flex items-center justify-between">
              <span className="inline-flex rounded-lg border border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.08)] p-2 text-[#D8CCFF]">
                {card.icon}
              </span>
            </div>
            <p className="relative z-10 mt-4 text-3xl font-light text-white">{loading ? '...' : card.value}</p>
            <p className="relative z-10 mt-1 text-xs uppercase tracking-[0.15em] text-[#8E7CC3]">{card.label}</p>
          </div>
        ))}
      </section>

      {error ? <div className={`${C.SURFACE_CLASS} p-4 text-textSecondary`}>{error}</div> : null}

      <section className={`${C.SURFACE_CLASS} p-3 md:p-4`}>
        <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
          {loading
            ? memberSkeletons.map((_, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-[rgba(139,92,246,0.1)] bg-[rgba(3,0,20,0.55)] p-4"
                >
                  <div className="grid animate-pulse gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="h-5 rounded bg-[rgba(139,92,246,0.15)]" />
                    <div className="h-8 w-28 rounded bg-[rgba(139,92,246,0.12)]" />
                  </div>
                </div>
              ))
            : filteredMembers.length > 0
              ? filteredMembers.map((member) => {
                  const isActive = getInitialFilter(member) === 'active';
                  const role = member.role ?? 'gym_member';
                  const initials = member.full_name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join('') || 'NA';
                  const roleBadgeClass =
                    role === 'gym_member'
                      ? 'bg-[rgba(96,165,250,0.14)] text-blue-300 border-blue-300/20'
                      : role === 'gym_owner'
                        ? 'bg-[rgba(139,92,246,0.16)] text-[#D8CCFF] border-[rgba(139,92,246,0.25)]'
                        : 'bg-[rgba(239,68,68,0.14)] text-red-300 border-red-300/20';

                  return (
                    <article
                      key={member.id}
                      className="group rounded-2xl border border-[rgba(139,92,246,0.1)] bg-[linear-gradient(135deg,rgba(16,6,35,0.7),rgba(7,2,22,0.86))] p-4 shadow-[0_8px_28px_rgba(0,0,0,0.24)] transition-all duration-200 hover:border-[rgba(139,92,246,0.24)] hover:bg-[linear-gradient(135deg,rgba(21,10,44,0.76),rgba(10,3,30,0.9))] hover:shadow-[0_12px_32px_rgba(139,92,246,0.16)]"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(139,92,246,0.24)] bg-[rgba(139,92,246,0.2)] text-sm font-medium text-white">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-base font-medium text-white md:text-lg">{member.full_name}</p>
                            <p className="truncate text-sm text-[#D8CCFF]">{member.email}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#8E7CC3]">
                              <span>{member.phone || 'No phone'}</span>
                              <span className="hidden h-1 w-1 rounded-full bg-[rgba(142,124,195,0.6)] md:inline-block" />
                              <span>
                                Joined{' '}
                                {new Intl.DateTimeFormat('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                }).format(new Date(member.joined_at))}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide ${
                              isActive
                                ? 'border-green-300/20 bg-[rgba(34,197,94,0.16)] text-green-300 shadow-[0_0_18px_rgba(34,197,94,0.12)]'
                                : 'border-red-300/20 bg-[rgba(239,68,68,0.14)] text-red-300'
                            }`}
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </span>

                          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide ${roleBadgeClass}`}>
                            {role === 'gym_member' ? 'Member' : role === 'gym_owner' ? 'Owner' : 'Admin'}
                          </span>

                          <div className="ml-0 inline-flex items-center gap-1 rounded-xl border border-[rgba(139,92,246,0.2)] bg-[rgba(3,0,20,0.5)] p-1 opacity-100 transition-all duration-200 md:ml-2 md:opacity-0 md:group-hover:opacity-100">
                            <Link
                              href={`/admin/members/${member.id}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#D8CCFF] transition-colors hover:bg-[rgba(139,92,246,0.2)] hover:text-white"
                              aria-label="View member"
                              title="View member"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>

                            {isActive ? (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(member.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#D8CCFF] transition-colors hover:bg-[rgba(239,68,68,0.2)] hover:text-red-300"
                                aria-label="Deactivate member"
                                title="Deactivate member"
                              >
                                <UserX className="h-4 w-4" />
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => {
                                setRoleModalMember(member);
                                setRoleSelection(member.role ?? 'gym_member');
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#D8CCFF] transition-colors hover:bg-[rgba(139,92,246,0.2)] hover:text-white"
                              aria-label="Change role"
                              title="Change role"
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              : (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-[rgba(139,92,246,0.1)] bg-[rgba(3,0,20,0.5)] px-6 py-10 text-center text-[#8E7CC3]">
                  No members found
                </div>
              )}
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className={`w-full max-w-2xl p-6 shadow-xl ${C.SURFACE_CLASS}`}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-light text-textPrimary">Add Member</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-[rgba(139,92,246,0.2)] p-2 text-textSecondary transition-colors hover:text-textPrimary"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-textSecondary">Full Name</label>
                <input required value={form.full_name} onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))} className="w-full rounded-xl border border-[rgba(139,92,246,0.18)] bg-[rgba(3,0,20,0.6)] px-4 py-2 text-textPrimary outline-none focus:border-primary" />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-textSecondary">Email</label>
                <input required type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-xl border border-[rgba(139,92,246,0.18)] bg-[rgba(3,0,20,0.6)] px-4 py-2 text-textPrimary outline-none focus:border-primary" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-textSecondary">Phone</label>
                <input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-xl border border-[rgba(139,92,246,0.18)] bg-[rgba(3,0,20,0.6)] px-4 py-2 text-textPrimary outline-none focus:border-primary" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-textSecondary">Password</label>
                <div className="flex gap-2">
                  <input required value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} className="w-full rounded-xl border border-[rgba(139,92,246,0.18)] bg-[rgba(3,0,20,0.6)] px-4 py-2 text-textPrimary outline-none focus:border-primary" />
                  <button type="button" onClick={() => setForm((current) => ({ ...current, password: generateStrongPassword() }))} className="rounded-xl border border-[rgba(139,92,246,0.2)] px-3 py-2 text-textSecondary transition-colors hover:text-textPrimary">
                    <ChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-textSecondary">Select Plan</label>
                <select required value={form.plan_id} onChange={(e) => setForm((current) => ({ ...current, plan_id: e.target.value }))} className="w-full rounded-xl border border-[rgba(139,92,246,0.18)] bg-[rgba(3,0,20,0.6)] px-4 py-2 text-textPrimary outline-none focus:border-primary">
                  {activePlanOptions.length === 0 ? <option value="">No plans available</option> : null}
                  {activePlanOptions.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-textSecondary">Start Date</label>
                <input required type="date" value={form.start_date} onChange={(e) => setForm((current) => ({ ...current, start_date: e.target.value }))} className="w-full rounded-xl border border-[rgba(139,92,246,0.18)] bg-[rgba(3,0,20,0.6)] px-4 py-2 text-textPrimary outline-none focus:border-primary" />
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-[rgba(139,92,246,0.2)] px-4 py-2 text-textSecondary transition-colors hover:text-textPrimary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-textPrimary transition-colors hover:bg-primaryHover disabled:opacity-60">
                  {saving ? 'Saving...' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
