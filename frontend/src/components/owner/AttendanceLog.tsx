"use client";

import React from 'react';
import type { AttendanceLog } from '@/types';

type Props = {
  logs: AttendanceLog[];
  isLoading: boolean;
  showMemberName?: boolean;
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

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export default function AttendanceLog({ logs, isLoading, showMemberName = false }: Props) {
  if (isLoading) {
    const cols = showMemberName ? 4 : 3;
    return (
      <div className="bg-surface rounded-xl border border-accent overflow-hidden">
        <table className="w-full table-auto">
          <thead className="border-b border-accent text-textSecondary text-sm">
            <tr>
              {showMemberName ? <th className="text-left px-4 py-3">Member</th> : null}
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Method</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-accent/50 last:border-0">
                {Array.from({ length: cols }).map((__, j) => (
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

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-accent p-6 text-center text-textSecondary">
        No check-ins recorded yet
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-accent overflow-hidden">
      <table className="w-full table-auto">
        <thead className="border-b border-accent text-textSecondary text-sm">
          <tr>
            {showMemberName ? <th className="text-left px-4 py-3">Member</th> : null}
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Time</th>
            <th className="text-left px-4 py-3">Method</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-accent/50 last:border-0">
              {showMemberName ? (
                <td className="px-4 py-4">
                  <div className="text-textPrimary font-medium">{(log as any).member_name ?? log.member_id}</div>
                </td>
              ) : null}

              <td className="px-4 py-4">
                <div className="text-textSecondary text-sm">{formatDate(log.checked_in_at)}</div>
              </td>

              <td className="px-4 py-4">
                <div className="text-textSecondary text-sm">{formatTime(log.checked_in_at)}</div>
              </td>

              <td className="px-4 py-4">
                {log.method === 'qr' ? (
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">QR Scan</span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-accent/50 text-textSecondary px-3 py-1 text-xs font-medium">PIN</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
