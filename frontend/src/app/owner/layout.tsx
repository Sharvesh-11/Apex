"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
	LayoutDashboard,
	Users,
	CreditCard,
	DollarSign,
	CalendarCheck,
	Image,
	LogOut,
	ChevronRight,
	Menu,
	X,
} from 'lucide-react'
import { siteConfig } from '@/lib/config'
import useAuthStore from '@/store/authStore'

const navItems = [
	{ label: 'Dashboard', href: '/owner/dashboard', icon: LayoutDashboard },
	{ label: 'Members', href: '/owner/members', icon: Users },
	{ label: 'Plans', href: '/owner/plans', icon: CreditCard },
	{ label: 'Payments', href: '/owner/payments', icon: DollarSign },
	{ label: 'Attendance', href: '/owner/attendance', icon: CalendarCheck },
	{ label: 'Gallery', href: '/owner/gallery', icon: Image },
]

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter()
	const pathname = usePathname()

	const initAuth = useAuthStore((s) => s.initAuth)
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
	const role = useAuthStore((s) => s.role)
	const logout = useAuthStore((s) => s.logout)
	const isLoading = useAuthStore((s) => s.isLoading)

	const [isReady, setIsReady] = useState(false)
	const [isMobile, setIsMobile] = useState(false)
	const [sidebarOpen, setSidebarOpen] = useState(false)

	useEffect(() => {
		let mounted = true
		void initAuth()
			.catch(() => {})
			.finally(() => {
				if (mounted) setIsReady(true)
			})
		return () => { mounted = false }
	}, [initAuth])

	useEffect(() => {
		const check = () => setIsMobile(window.innerWidth < 768)
		check()
		window.addEventListener('resize', check)
		return () => window.removeEventListener('resize', check)
	}, [])

	useEffect(() => {
		if (!isReady || isLoading) return
		if (!isAuthenticated || role !== 'gym_owner') router.replace('/login')
	}, [isReady, isLoading, isAuthenticated, role, router])

	if (!isReady || isLoading || !isAuthenticated || role !== 'gym_owner') return null

	return (
		<div className="min-h-screen bg-background flex">

			{/* SIDEBAR */}
			<aside
				style={{
					position: 'fixed',
					top: 0,
					left: 0,
					height: '100vh',
					width: 256,
					zIndex: 50,
					backgroundColor: 'var(--brand-surface)',
					borderColor: 'var(--brand-accent)',
					display: 'flex',
					flexDirection: 'column',
					borderRight: '1px solid var(--brand-accent)',
					transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
					transition: 'transform 0.25s ease',
				}}
			>

				{/* Brand + Close button (mobile only) */}
				<div
					className="flex items-center justify-between p-4 border-b"
					style={{ borderColor: 'var(--brand-accent)' }}
				>
					<Link href="/" className="font-bold text-lg"
						style={{ color: 'var(--brand-primary)' }}>
						{siteConfig.brand.name}
					</Link>
					{isMobile && (
						<button
							onClick={() => setSidebarOpen(false)}
							className="p-1 hover:opacity-70 transition-opacity"
							style={{ color: 'var(--brand-text-secondary)' }}
						>
							<X className="h-5 w-5" />
						</button>
					)}
				</div>

				{/* Label */}
				<div className="px-4 py-3">
					<span className="text-xs uppercase tracking-widest"
						style={{ color: 'var(--brand-text-secondary)' }}>
						Owner Panel
					</span>
				</div>

				{/* Nav */}
				<nav className="flex-1 px-3 space-y-1">
					{navItems.map((item) => {
						const Icon = item.icon
						const isActive = pathname === item.href
						return (
							<Link
								key={item.href}
								href={item.href}
								onClick={() => isMobile && setSidebarOpen(false)}
								style={isActive ? {
									backgroundColor: 'var(--brand-primary)20',
									color: 'var(--brand-primary)',
								} : {
									color: 'var(--brand-text-secondary)',
								}}
								className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
							>
								<Icon className="h-4 w-4 shrink-0" />
								{item.label}
								<ChevronRight className="ml-auto h-4 w-4 opacity-50" />
							</Link>
						)
					})}
				</nav>

				{/* Footer */}
				<div className="p-4 border-t"
					style={{ borderColor: 'var(--brand-accent)' }}>
					<Link href="/" className="flex items-center gap-2 text-sm mb-3"
						style={{ color: 'var(--brand-text-secondary)' }}>
						← Back to Site
					</Link>
					<button
						onClick={() => { logout(); router.push('/') }}
						className="flex items-center gap-2 text-sm w-full hover:text-red-400 transition-colors"
						style={{ color: 'var(--brand-text-secondary)' }}
					>
						<LogOut className="h-4 w-4" />
						Sign Out
					</button>
				</div>
			</aside>

			{/* Mobile overlay */}
			{isMobile && sidebarOpen && (
				<div
					onClick={() => setSidebarOpen(false)}
					style={{
						position: 'fixed',
						inset: 0,
						background: 'rgba(0,0,0,0.6)',
						zIndex: 40,
						backdropFilter: 'blur(2px)',
					}}
				/>
			)}

			{/* MAIN AREA */}
			<div
				className="flex-1 flex flex-col"
				style={{ marginLeft: isMobile ? 0 : 256 }}
			>

				{/* Top bar */}
				<header
					className="sticky top-0 z-30 h-16 border-b flex items-center justify-between px-6"
					style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-accent)' }}
				>
					<div className="flex items-center gap-4">
						{isMobile && (
							<button
								onClick={() => setSidebarOpen(true)}
								className="p-1 hover:opacity-70 transition-opacity"
								style={{ color: 'var(--brand-text-secondary)' }}
							>
								<Menu className="h-5 w-5" />
							</button>
						)}
						<span className="font-semibold"
							style={{ color: 'var(--brand-text-primary)' }}>
							Owner Dashboard
						</span>
					</div>
					<Link href="/" className="flex items-center gap-2 text-sm" style={{ color: 'var(--brand-text-secondary)' }}>
						← Back to Site
					</Link>
				</header>

				{/* Page content */}
				<main className="flex-1 p-6 overflow-y-auto">
					{children}
				</main>
			</div>
		</div>
	)
}