"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Users } from 'lucide-react';

import DashboardNavbar from '@/components/layout/DashboardNavbar';
import useAuthStore from '@/store/authStore';

const navigation = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Members', href: '/admin/members', icon: Users },
  
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const initAuth = useAuthStore((s) => s.initAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    void initAuth()
      .catch(() => {
        // handled by initAuth
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [initAuth]);

  useEffect(() => {
    if (!isReady || isLoading) return;
    if (!isAuthenticated || role !== 'admin') router.replace('/login');
  }, [isAuthenticated, isLoading, isReady, role, router]);

  if (!isReady || isLoading || !isAuthenticated || role !== 'admin') return null;

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(135deg, #030014 0%, #090018 30%, #14002E 65%, #1A1040 100%)',
      }}
    >
      <DashboardNavbar role="admin" />

      <div className="relative flex pt-16">
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="absolute -right-20 -top-14 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.08)_0%,transparent_70%)]" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(96,165,250,0.06)_0%,transparent_70%)]" />
        </div>

        <aside className="fixed left-4 top-20 z-20 hidden h-[calc(100vh-6rem)] w-56 overflow-y-auto rounded-[22px] border border-[rgba(139,92,246,0.14)] bg-[rgba(9,2,26,0.62)] shadow-[0_16px_40px_rgba(3,0,20,0.45)] backdrop-blur-[24px] md:block">
          <div className="px-4 pb-3 pt-4">
            <div className="text-base font-light tracking-[0.18em] text-[#FFFFFF]">APEX</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#8E7CC3]">admin navigation</div>
          </div>

          <nav className="space-y-1 px-3 py-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-[rgba(139,92,246,0.2)] text-[#D8CCFF] shadow-[0_0_0_1px_rgba(139,92,246,0.22)_inset]'
                      : 'text-[#A995DE] hover:bg-[rgba(139,92,246,0.12)] hover:text-[#FFFFFF]'
                  }`}
                >
                  {active ? (
                    <span className="absolute left-0 top-2 h-8 w-[2px] rounded-full bg-[linear-gradient(to_bottom,#8B5CF6,rgba(139,92,246,0.25))]" />
                  ) : null}
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 px-4 pb-4 pt-4">
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#8E7CC3]">operator mode</span>
          </div>
        </aside>

        <div className="pointer-events-none fixed left-[15rem] top-16 z-10 hidden h-[calc(100vh-4rem)] w-10 bg-[linear-gradient(to_right,rgba(139,92,246,0.12),rgba(139,92,246,0.02),transparent)] blur-2xl md:block" />

        <main className="relative z-10 min-h-screen flex-1 px-4 py-6 md:ml-60 md:px-6">{children}</main>
      </div>
    </div>
  );
}
