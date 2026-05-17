"use client";

import React from 'react';
import { Eye, UserX } from 'lucide-react';
import type { Member } from '@/types';

type Props = {
  members: Member[];
  isLoading: boolean;
  onView: (memberId: string) => void;
  onDeactivate: (memberId: string) => void;
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function MemberTable({ members, isLoading, onView, onDeactivate }: Props) {
  if (isLoading) {
    return (
      <div className="bg-surface rounded-xl border border-accent overflow-hidden">
        <table className="w-full table-auto">
          <thead className="border-b border-accent text-textSecondary text-sm">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-accent/50 hover:bg-white/5 transition">
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="px-4 py-4">
                    <div className="h-4 w-full bg-gray-700/40 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-accent p-6 text-center text-textSecondary">
        No members found
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-accent overflow-hidden">
      <table className="w-full table-auto">
        <thead className="border-b border-accent text-textSecondary text-sm">
          <tr>
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Email</th>
            <th className="text-left px-4 py-3">Phone</th>
            <th className="text-left px-4 py-3">Joined</th>
            <th className="text-left px-4 py-3">Status</th>
            <th className="text-left px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="border-b border-accent/50 hover:bg-white/5 transition">
              <td className="px-4 py-4">
                <div className="text-textPrimary font-medium">{member.full_name}</div>
              </td>

              <td className="px-4 py-4">
                <div className="text-textSecondary text-sm">{member.email}</div>
              </td>

              <td className="px-4 py-4">
                <div className="text-textSecondary text-sm">{member.phone ?? '—'}</div>
              </td>

              <td className="px-4 py-4">
                <div className="text-textSecondary text-sm">{formatDate(member.joined_at)}</div>
              </td>

              <td className="px-4 py-4">
                {member.is_active ? (
                  <span className="inline-flex items-center rounded-full bg-green-400/10 text-green-400 px-3 py-1 text-xs font-medium">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-red-400/10 text-red-400 px-3 py-1 text-xs font-medium">
                    Inactive
                  </span>
                )}
              </td>

              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    title="View"
                    onClick={() => onView(member.id)}
                    className="inline-flex items-center justify-center p-2 text-primary hover:bg-primary/10 rounded"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  {member.is_active ? (
                    <button
                      type="button"
                      title="Deactivate"
                      onClick={() => onDeactivate(member.id)}
                      className="inline-flex items-center justify-center p-2 text-red-400 hover:bg-red-400/10 rounded"
                    >
                      <UserX className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
