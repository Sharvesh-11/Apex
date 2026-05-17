"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

import { siteConfig } from '@/lib/config';
import useAuthStore from '@/store/authStore';

export default function Navbar() {
	const router = useRouter();
	const user = useAuthStore((state) => state.user);
	const role = useAuthStore((state) => state.role);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const logout = useAuthStore((state) => state.logout);

	const [open, setOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 10);
		onScroll();
		window.addEventListener('scroll', onScroll);
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	const greetingName = useMemo(() => {
		const userWithName = user as (typeof user & { full_name?: string }) | null;
		return userWithName?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Member';
	}, [user]);

	const dashboardConfig = useMemo(() => {
		if (role === 'gym_member') {
			return { label: 'My Dashboard', href: '/member/dashboard' };
		}

		if (role === 'gym_owner') {
			return { label: 'Dashboard', href: '/owner/dashboard' };
		}

		if (role === 'admin') {
			return { label: 'Admin Panel', href: '/admin/dashboard' };
		}

		return { label: 'Dashboard', href: '/' };
	}, [role]);

	const handleLogout = () => {
		logout();
		router.push('/');
	};

	return (
		<header className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-auto">
			<div className={`glass w-[min(96%,1200px)] transition-transform duration-300 ${scrolled ? 'shadow-xl scale-100' : 'shadow-md'}`}>
				<div className="flex items-center justify-between px-4 py-2">
					<div className="flex items-center gap-4">
						<button className="lg:hidden inline-flex items-center justify-center rounded p-2 text-textPrimary hover:bg-white/5" onClick={() => setOpen(true)} aria-label="Open menu">
							<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
						</button>
						<Link href="/" className="flex items-center gap-3">
							<img src={siteConfig.brand.logo} alt={siteConfig.brand.name} className="h-8 w-auto" />
							<span className="font-semibold text-primary tracking-tight">{siteConfig.brand.name}</span>
						</Link>
					</div>

					<nav className="hidden md:flex items-center gap-8">
						<a href="/#hero" className="text-textSecondary hover:text-textPrimary transition">Home</a>
						<a href="/#gallery" className="text-textSecondary hover:text-textPrimary transition">Gallery</a>
						<a href="/#pricing" className="text-textSecondary hover:text-textPrimary transition">Pricing</a>
						<a href="/#contact" className="text-textSecondary hover:text-textPrimary transition">Contact</a>
					</nav>

					<div className="flex items-center gap-3">
						{!isAuthenticated ? (
							<>
								<Link href="/login" className="px-3 py-1 rounded-full text-sm font-medium border border-primary text-primary hover:bg-primary/5 transition">Sign In</Link>
								<Link href="/register" className="px-4 py-1 rounded-full bg-primary text-white text-sm font-medium hover:bg-[#A78BFA] transition">Join Now</Link>
							</>
						) : (
							<>
								<span className="hidden md:inline-flex text-[13px] text-textSecondary">Hey, {greetingName}</span>
								<a href={dashboardConfig.href} className="hidden md:inline-flex px-3 py-1 rounded-full text-sm font-medium border border-primary text-primary hover:bg-primary hover:text-white transition">{dashboardConfig.label}</a>
								<button onClick={handleLogout} className="inline-flex items-center gap-2 text-textSecondary hover:text-red-400">
									<LogOut className="h-5 w-5" />
								</button>
							</>
						)}
					</div>
				</div>
			</div>

			{/* mobile menu drawer */}
			{open && (
				<div className="fixed inset-0 z-40 lg:hidden">
					<div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
					<div className="absolute left-4 top-20 w-64 rounded-lg bg-surface border border-accent p-4 shadow-2xl">
						{!isAuthenticated ? (
							<nav className="flex flex-col gap-3">
								<a href="/#hero" onClick={() => setOpen(false)} className="text-textSecondary">Home</a>
								<a href="/#gallery" onClick={() => setOpen(false)} className="text-textSecondary">Gallery</a>
								<a href="/#pricing" onClick={() => setOpen(false)} className="text-textSecondary">Pricing</a>
								<a href="/#contact" onClick={() => setOpen(false)} className="text-textSecondary">Contact</a>
								<div className="my-2 h-px bg-accent/60" />
								<Link href="/login" onClick={() => setOpen(false)} className="w-full rounded-full border border-primary px-4 py-2 text-center text-sm font-medium text-primary transition hover:bg-primary/5">Sign In</Link>
								<Link href="/register" onClick={() => setOpen(false)} className="w-full rounded-full bg-primary px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-[#A78BFA]">Join Now</Link>
							</nav>
						) : (
							<nav className="flex flex-col">
								<div className="px-4 py-3 text-[14px] text-textSecondary">Hey, {greetingName}</div>
								<Link href={dashboardConfig.href} onClick={() => setOpen(false)} className="w-full rounded-full bg-primary px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-[#A78BFA]">{dashboardConfig.label}</Link>
								<div className="my-3 h-px bg-accent/60" />
								<a href="/#hero" onClick={() => setOpen(false)} className="py-2 text-textSecondary">Home</a>
								<a href="/#gallery" onClick={() => setOpen(false)} className="py-2 text-textSecondary">Gallery</a>
								<a href="/#pricing" onClick={() => setOpen(false)} className="py-2 text-textSecondary">Pricing</a>
								<a href="/#contact" onClick={() => setOpen(false)} className="py-2 text-textSecondary">Contact</a>
								<div className="my-3 h-px bg-accent/60" />
								<button
									type="button"
									onClick={() => {
										setOpen(false);
										handleLogout();
									}}
									className="w-full py-2 text-left text-sm font-medium text-red-500 transition hover:text-red-400"
								>
									Logout
								</button>
							</nav>
						)}
					</div>
				</div>
			)}
		</header>
	);
}

