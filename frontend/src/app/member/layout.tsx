"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { siteConfig } from '@/lib/config';
import useAuthStore from '@/store/authStore';

type MemberLayoutProps = {
	children: React.ReactNode;
};

export default function MemberLayout({ children }: MemberLayoutProps) {
	const router = useRouter();
	const initAuth = useAuthStore((state) => state.initAuth);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const role = useAuthStore((state) => state.role);
	const isLoading = useAuthStore((state) => state.isLoading);

	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		let mounted = true;

		void initAuth()
			.catch(() => {
				// initAuth clears invalid sessions.
			})
			.finally(() => {
				if (mounted) {
					setIsReady(true);
				}
			});

		return () => {
			mounted = false;
		};
	}, [initAuth]);

	useEffect(() => {
		if (!isReady || isLoading) {
			return;
		}

		if (!isAuthenticated || role !== 'gym_member') {
			router.replace('/login');
		}
	}, [isAuthenticated, isLoading, isReady, role, router]);



	if (!isReady || isLoading || !isAuthenticated || role !== 'gym_member') {
		return null;
	}

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b border-accent bg-background">
				<div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
					<Link href="/" className="text-lg font-semibold text-primary">
						{siteConfig.brand.name}
					</Link>

					<div>
						<Link href="/" className="text-sm font-medium text-textSecondary transition-colors hover:text-textPrimary">
							Home
						</Link>
					</div>
				</div>
			</header>

			<main className="min-h-screen bg-background p-6">{children}</main>
		</div>
	);
}