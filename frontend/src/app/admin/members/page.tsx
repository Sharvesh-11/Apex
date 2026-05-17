"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, UserX, Search, Plus, X, ChevronDown, ShieldCheck } from 'lucide-react';

import * as apiClient from '@/lib/api';
import type { Member, Plan, Subscription } from '@/types';
import useUIStore from '@/store/uiStore';

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
          apiClient.get<MemberRecord[]>('/members'),
          apiClient.get<Plan[]>('/plans'),
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

  const activePlanOptions = plans.filter((plan) => plan.is_active !== false);

  const refreshMembers = async () => {
    const nextMembers = await apiClient.get<MemberRecord[]>('/members');

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

  return (
    <div className="space-y-6">
      {toast ? (
        <div
          className={`fixed right-6 top-6 z-50 rounded-lg border px-4 py-3 shadow-lg ${
            toast.type === 'success'
              ? 'border-green-400/30 bg-green-400/10 text-green-400'
              : toast.type === 'error'
                ? 'border-red-400/30 bg-red-400/10 text-red-400'
                : 'border-accent bg-surface text-textPrimary'
            }`}
        >
          {toast.message}
        </div>
      ) : null}

      {roleModalMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={handleUpdateRole} className="w-full max-w-md rounded-xl border border-accent bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-textPrimary">Update Role for {roleModalMember.full_name}</h3>
              <button type="button" onClick={() => setRoleModalMember(null)} className="rounded p-2 text-textSecondary hover:text-textPrimary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-1 block text-sm text-textSecondary">Select Role</label>
            <select value={roleSelection} onChange={(e) => setRoleSelection(e.target.value)} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary mb-4">
              <option value="gym_member">Member</option>
              <option value="gym_owner">Owner</option>
              <option value="admin">Admin</option>
            </select>

            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setRoleModalMember(null)} className="rounded-lg border border-accent px-4 py-2 text-textSecondary hover:text-textPrimary">Cancel</button>
              <button type="submit" disabled={isUpdatingRole} className="rounded-lg bg-primary px-4 py-2 text-textPrimary hover:bg-primaryHover disabled:opacity-60">{isUpdatingRole ? 'Updating...' : 'Update Role'}</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-textPrimary">Members</h1>
        </div>

        <button
          type="button"
          onClick={openAddMemberModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-textPrimary hover:bg-primaryHover"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members by name or email"
            className="w-full rounded-lg border border-accent bg-surface py-2 pl-10 pr-4 text-textPrimary outline-none placeholder:text-textSecondary focus:border-primary"
          />
        </div>

        <div className="inline-flex rounded-lg border border-accent bg-surface p-1">
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
                selectedFilter === filter
                  ? 'bg-primary/10 text-primary'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-lg border border-accent bg-surface p-4 text-textSecondary">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-accent bg-surface">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-accent text-textSecondary">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? memberSkeletons.map((_, index) => (
                    <tr key={index} className="border-b border-accent/50 last:border-b-0">
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-4">
                          <div className="h-4 animate-pulse rounded bg-background/60" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filteredMembers.length > 0
                ? filteredMembers.map((member) => {
                    const isActive = getInitialFilter(member) === 'active';
                    const role = member.role ?? 'gym_member';
                    const roleBadge = role === 'gym_member' ? 'bg-blue-400/10 text-blue-400' : role === 'gym_owner' ? 'bg-primary/10 text-primary' : 'bg-red-400/10 text-red-400';
                    return (
                      <tr key={member.id} className="border-b border-accent/50 last:border-b-0">
                        <td className="px-4 py-4 text-textPrimary">{member.full_name}</td>
                        <td className="px-4 py-4 text-textSecondary">{member.email}</td>
                        <td className="px-4 py-4 text-textSecondary">{member.phone || '—'}</td>
                        <td className="px-4 py-4 text-textSecondary">{new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(member.joined_at))}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${isActive ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${roleBadge}`}>
                            {role === 'gym_member' ? 'Member' : role === 'gym_owner' ? 'Owner' : 'Admin'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Link href={`/admin/members/${member.id}`} className="inline-flex items-center gap-2 text-primary hover:text-primaryHover">
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          {isActive ? (
                            <button
                              type="button"
                              onClick={() => handleDeactivate(member.id)}
                              className="inline-flex items-center gap-2 text-textSecondary hover:text-red-400"
                            >
                              <UserX className="h-4 w-4" />
                              Deactivate
                              </button>
                          ) : null}

                          {/* Change Role button */}
                          <button type="button" onClick={() => { setRoleModalMember(member); setRoleSelection(member.role ?? 'gym_member'); }} className="inline-flex items-center gap-2 text-textSecondary hover:text-primary">
                            <ShieldCheck className="h-4 w-4" />
                            Change Role
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-textSecondary">
                      No members found
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-accent bg-surface p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-textPrimary">Add Member</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded p-2 text-textSecondary hover:text-textPrimary"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-textSecondary">Full Name</label>
                <input required value={form.full_name} onChange={(e) => setForm((current) => ({ ...current, full_name: e.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-textSecondary">Email</label>
                <input required type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-textSecondary">Phone</label>
                <input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
              </div>

              <div>
                <label className="mb-1 block text-sm text-textSecondary">Password</label>
                <div className="flex gap-2">
                  <input required value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
                  <button type="button" onClick={() => setForm((current) => ({ ...current, password: generateStrongPassword() }))} className="rounded-lg border border-accent px-3 py-2 text-textSecondary hover:text-textPrimary">
                    <ChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-textSecondary">Select Plan</label>
                <select required value={form.plan_id} onChange={(e) => setForm((current) => ({ ...current, plan_id: e.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary">
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
                <input required type="date" value={form.start_date} onChange={(e) => setForm((current) => ({ ...current, start_date: e.target.value }))} className="w-full rounded-lg border border-accent bg-background px-4 py-2 text-textPrimary outline-none focus:border-primary" />
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-accent px-4 py-2 text-textSecondary hover:text-textPrimary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-textPrimary hover:bg-primaryHover disabled:opacity-60">
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
