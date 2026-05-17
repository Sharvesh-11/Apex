"use client";

import { useEffect } from 'react';
import useAuthStore from '@/store/authStore';

export default function AuthInit({ children }: { children: React.ReactNode }) {
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    void initAuth().catch(() => {
      // ignore - initAuth will perform logout on invalid token
    });
  }, [initAuth]);

  return <>{children}</>;
}
