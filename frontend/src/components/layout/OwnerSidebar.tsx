"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
	LayoutDashboard,
	Users,
	CreditCard,
	DollarSign,
	CalendarCheck,
	Image,
	Menu,
	X,
} from 'lucide-react';

import { siteConfig } from '@/lib/config';
import useAuthStore from '@/store/authStore';

type OwnerSidebarProps = {
	isOpen?: boolean;
	onClose?: () => void;
};

const navigation = [
	{ label: 'Dashboard', href: '/owner/dashboard', icon: LayoutDashboard },
	{ label: 'Members', href: '/owner/members', icon: Users },
	{ label: 'Plans', href: '/owner/plans', icon: CreditCard },
	{ label: 'Payments', href: '/owner/payments', icon: DollarSign },
	{ label: 'Attendance', href: '/owner/attendance', icon: CalendarCheck },
	{ label: 'Gallery', href: '/owner/gallery', icon: Image },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
	const pathname = usePathname();
	const router = useRouter();
	const user = useAuthStore((state) => state.user);
	const logout = useAuthStore((state) => state.logout);

	const handleLogout = () => {
		logout();
		onClose?.();
		router.push('/login');
	};

	return (
		<div className="flex h-full flex-col bg-surface text-textPrimary border-r border-accent">
			<div className="px-6 py-6 border-b border-accent">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="text-xl font-bold text-primary">{siteConfig.brand.name}</div>
						<div className="text-sm text-textSecondary mt-1">Owner Panel</div>
					</div>
					{onClose ? (
						<button
							type="button"
							onClick={onClose}
							className="inline-flex items-center justify-center rounded p-2 text-textSecondary hover:text-textPrimary"
							aria-label="Close sidebar"
						>
							<X className="h-5 w-5" />
						</button>
					) : null}
				</div>
			</div>

			<nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
				{navigation.map((item) => {
					const Icon = item.icon;
					const active = pathname === item.href;

					return (
						<Link
							key={item.href}
							href={item.href}
							onClick={onClose}
							className={`flex items-center gap-3 rounded-l-md border-r-2 px-4 py-3 text-sm font-medium transition-colors ${
								active
									? 'bg-primary/10 text-primary border-primary'
									: 'border-transparent text-textSecondary hover:text-textPrimary hover:bg-white/5'
							}`}
						>
							<Icon className="h-5 w-5 shrink-0" />
							<span>{item.label}</span>
						</Link>
					);
				})}
			</nav>

			<div className="border-t border-accent px-6 py-5 space-y-3">
				<div className="text-sm text-textSecondary break-all">
					{user?.email ?? ''}
				</div>
				<button
					type="button"
					onClick={handleLogout}
					className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-textPrimary hover:bg-primaryHover"
				>
					Logout
				</button>
			</div>
		</div>
	);
}

export default function OwnerSidebar({ isOpen = false, onClose }: OwnerSidebarProps) {
	return (
		<>
			{/* Desktop sidebar */}
			<aside className="fixed left-0 top-0 hidden h-screen w-64 lg:block">
				<SidebarContent />
			</aside>

			{/* Mobile trigger is expected from parent layout; drawer renders when open */}
			<div
				className={`fixed inset-0 z-50 lg:hidden transition-opacity ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
				aria-hidden={!isOpen}
			>
				<button
					type="button"
					className="absolute inset-0 bg-black/50"
					onClick={onClose}
					aria-label="Close sidebar overlay"
				/>

				<aside
					className={`absolute left-0 top-0 h-full w-64 transform transition-transform duration-300 ${
						isOpen ? 'translate-x-0' : '-translate-x-full'
					}`}
				>
					<SidebarContent onClose={onClose} />
				</aside>
			</div>
		</>
	);
}

