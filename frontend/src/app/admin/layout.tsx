"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Settings } from 'lucide-react';

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
    <div className="min-h-screen bg-background">
      <DashboardNavbar role="admin" />

      <div className="flex pt-16">
        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-surface border-r border-accent overflow-y-auto hidden md:block">
          <div className="p-4">
            <div className="text-xl font-bold text-primary">Admin Panel</div>
          </div>

          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary/10 text-primary border-r-2 border-primary rounded-l-lg'
                      : 'text-textSecondary hover:text-textPrimary hover:bg-white/5 rounded-lg'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="px-4 pt-4 border-t border-accent mt-4">
            <span className="text-xs text-primary uppercase tracking-widest">Admin</span>
          </div>
        </aside>

        <main className="flex-1 md:ml-64 p-6 min-h-screen">{children}</main>
      </div>
    </div>
  );
}
