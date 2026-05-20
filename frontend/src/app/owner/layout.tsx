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

	if (!isReady || isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#050508] text-[#D8CCFF]">
				<div className="rounded-2xl border border-[rgba(139,92,246,0.14)] bg-[rgba(9,2,26,0.72)] px-6 py-4 text-sm">
					Loading owner dashboard...
				</div>
			</div>
		)
	}

	if (!isAuthenticated || role !== 'gym_owner') {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[#050508] text-[#D8CCFF]">
				<div className="rounded-2xl border border-[rgba(139,92,246,0.14)] bg-[rgba(9,2,26,0.72)] px-6 py-4 text-sm">
					Redirecting to login...
				</div>
			</div>
		)
	}

	return (
		<div className="min-h-screen bg-background flex">
			<style jsx global>{`
				.owner-nav-link {
					transition: background 0.15s ease, color 0.15s ease;
				}

				.owner-nav-link.inactive {
					color: rgba(255, 255, 255, 0.35) !important;
				}

				.owner-nav-link.inactive:hover {
					color: rgba(255, 255, 255, 0.7) !important;
					background: rgba(255, 255, 255, 0.03) !important;
				}

				.owner-nav-link.active {
					background: rgba(124, 58, 237, 0.1) !important;
					color: #a78bfa !important;
					box-shadow: inset 3px 0 0 rgba(124, 58, 237, 0.6);
				}

				.signout-btn {
					transition: color 0.2s ease;
				}

				.signout-btn:hover {
					color: rgba(239, 68, 68, 0.7) !important;
				}
			`}</style>

			{/* SIDEBAR */}
			<aside
				style={{
					position: 'fixed',
					top: 0,
					left: 0,
					height: '100vh',
					width: 256,
					zIndex: 50,
					background: 'linear-gradient(180deg, #08080f 0%, #050508 100%)',
					borderColor: 'var(--brand-accent)',
					display: 'flex',
					flexDirection: 'column',
					borderRight: '1px solid rgba(255,255,255,0.04)',
					transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
					transition: 'transform 0.25s ease',
				}}
			>

				{/* Brand + Close button (mobile only) */}
				<div
					className="flex items-center justify-between border-b"
					style={{ padding: '20px 20px 16px', borderColor: 'rgba(255,255,255,0.04)', marginBottom: '8px' }}
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
				<div style={{ padding: '8px 20px 4px', marginBottom: '4px' }}>
					<span
						style={{
							fontSize: '9px',
							letterSpacing: '0.25em',
							color: 'rgba(255,255,255,0.2)',
							textTransform: 'uppercase',
						}}
					>
						Owner Panel
					</span>
				</div>

				{/* Nav */}
				<nav className="flex-1 space-y-1" style={{ padding: '2px 12px' }}>
					{navItems.map((item) => {
						const Icon = item.icon
						const isActive = pathname === item.href
						return (
							<Link
								key={item.href}
								href={item.href}
								onClick={() => isMobile && setSidebarOpen(false)}
								className={`owner-nav-link ${isActive ? 'active' : 'inactive'} flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium`}
								style={{ padding: '10px 12px' }}
							>
								<Icon className="h-[15px] w-[15px] shrink-0" style={{ opacity: isActive ? 0.8 : 0.5 }} />
								{item.label}
								<ChevronRight className="ml-auto h-[15px] w-[15px]" style={{ opacity: isActive ? 0.8 : 0.5 }} />
							</Link>
						)
					})}
				</nav>

				{/* Footer */}
				<div
					style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.04)' }}
				>
					<Link href="/" className="flex items-center gap-2 text-sm mb-3"
						style={{ color: 'var(--brand-text-secondary)' }}>
						← Back to Site
					</Link>
					<button
						onClick={() => { logout(); router.push('/') }}
						className="signout-btn flex w-full items-center"
						style={{
							alignItems: 'center',
							gap: '10px',
							fontSize: '13px',
							color: 'rgba(255,255,255,0.3)',
						}}
					>
						<LogOut className="h-[14px] w-[14px]" />
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