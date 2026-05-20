"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { get } from '@/lib/api';
import { siteConfig } from '@/lib/config';
import useAuthStore from '@/store/authStore';
import type { AttendanceLog, Member, Payment, Subscription } from '@/types';
import { Zap, Calendar, Activity, Shield, Lock, Download } from 'lucide-react';

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
	day: '2-digit',
	month: 'short',
	year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-IN', {
	hour: '2-digit',
	minute: '2-digit',
});

const currencyFormatter = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	maximumFractionDigits: 0,
});

const skeletonRows = Array.from({ length: 5 });

// streak is now provided by the API as member.current_streak; local calculation removed

export default function MemberDashboardPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const user = useAuthStore((state) => state.user);
	const userId = user?.id;

	const [member, setMember] = useState<Member | null>(null);
	const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
	const [payments, setPayments] = useState<Payment[]>([]);
	const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
	const [attendanceRecords, setAttendanceRecords] = useState<Array<{ date: string; time: string; method: string }>>([]);
	const [streakLoading, setStreakLoading] = useState(false);
	const [streakError, setStreakError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [alreadyActiveBanner, setAlreadyActiveBanner] = useState<{ show: boolean; endDate?: string }>({ show: false });

	// mobile detection
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const check = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
		check();
		window.addEventListener('resize', check);
		return () => window.removeEventListener('resize', check);
	}, []);

	useEffect(() => {
		const message = searchParams?.get?.('message');
		const endDate = searchParams?.get?.('end_date');
		if (message === 'already_active') {
			setAlreadyActiveBanner({ show: true, endDate: endDate ?? undefined });
			const t = setTimeout(() => setAlreadyActiveBanner({ show: false }), 5000);
			return () => clearTimeout(t);
		}

		if (!userId) {
			setLoading(true);
			return;
		}

		let mounted = true;

		(async () => {
			setLoading(true);
			setError(null);

			// fetch member
			let currentMember: Member | null = null;
			try {
				currentMember = await get<Member>('/members/me');
			} catch (err) {
				console.error('[Member Dashboard] Failed to fetch member profile:', err);
				if (!mounted) return;
				setError('Your member profile is being set up. Please contact the gym.');
				setLoading(false);
				return;
			}

			if (!mounted) return;
			setMember(currentMember);

			const memberId = currentMember.id;

			// fetch subscriptions, payments, attendance in parallel
			try {
				const [subscriptionsResponse, paymentsResponse, attendanceResponse] = await Promise.all([
					get<Subscription[]>(`/subscriptions/member/${memberId}/`).catch((err) => {
						console.error('[Member Dashboard] Failed to fetch subscriptions:', err);
						return [] as Subscription[];
					}),
					get<Payment[]>(`/payments/member/${memberId}/`).catch((err) => {
						console.error('[Member Dashboard] Failed to fetch payments:', err);
						return [] as Payment[];
					}),
					get<AttendanceLog[]>(`/attendance/member/${memberId}/`).catch((err) => {
						console.error('[Member Dashboard] Failed to fetch attendance:', err);
						return [] as AttendanceLog[];
					}),
				]);

				if (!mounted) return;
				setSubscriptions(subscriptionsResponse ?? []);
				setPayments(paymentsResponse ?? []);
				setAttendance(attendanceResponse ?? []);
			} catch (err) {
				console.error('[Member Dashboard] Unexpected error during parallel fetch:', err);
				if (!mounted) return;
				setSubscriptions([]);
				setPayments([]);
				setAttendance([]);
				setError(null);
			} finally {
				if (mounted) setLoading(false);
			}
		})();

		return () => {
			mounted = false;
		};
	}, [userId, searchParams]);

	useEffect(() => {
		if (!userId) return;

		let mounted = true;

		(async () => {
			setStreakLoading(true);
			setStreakError(null);

			try {
				const response = await get<Array<{ date: string; time: string; method: string }>>('/attendance/me/');
				if (!mounted) return;
				setAttendanceRecords(response ?? []);
			} catch (err) {
				console.error('[Member Dashboard] Failed to fetch attendance streak:', err);
				if (!mounted) return;
				setStreakError('Unable to load streak data');
			} finally {
				if (mounted) setStreakLoading(false);
			}
		})();

		return () => {
			mounted = false;
		};
	}, [userId]);

	// Derived values per spec
	const activeSub = useMemo(() => subscriptions.find((s) => s.status === 'active') ?? null, [subscriptions]);

	const daysLeft = activeSub
		? Math.max(0, Math.ceil((new Date(activeSub.end_date).getTime() - Date.now()) / 86400000))
		: 0;

	const totalDays = activeSub
		? Math.max(1, Math.ceil((new Date(activeSub.end_date).getTime() - new Date(activeSub.start_date).getTime()) / 86400000))
		: 1;

	const progressPct = activeSub ? Math.min(100, Math.round(((totalDays - daysLeft) / totalDays) * 100)) : 0;

	const checkInsThisMonth = useMemo(() => {
		const now = new Date();
		return attendance.filter((a) => {
			const d = new Date(a.checked_in_at);
			return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
		}).length;
	}, [attendance]);

	const lastCheckIn = useMemo(() => {
		if (attendance.length === 0) return null;
		return attendance.slice().sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())[0];
	}, [attendance]);

	const recentPayments = useMemo(() => payments.slice().sort((a, b) => new Date(b.paid_at ?? b.created_at).getTime() - new Date(a.paid_at ?? a.created_at).getTime()).slice(0, 5), [payments]);

	const { currentStreak, checksThisMonth, lastCheckInForStreak } = useMemo(() => {
		if (attendanceRecords.length === 0) {
			return { currentStreak: 0, checksThisMonth: 0, lastCheckInForStreak: 'Never' };
		}

		// Parse dates and compute checksThisMonth
		const now = new Date();
		const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

		const checksThisMonth = attendanceRecords.filter((record) => {
			const recordDate = new Date(record.date);
			return recordDate >= thisMonthStart && recordDate <= thisMonthEnd;
		}).length;

		// Use streak data from member (server source of truth) when available
		const currentStreak = (member as any)?.current_streak ?? 0;

		// Prefer API last_checkin_date when available
		const lastCheckInForStreak = (member as any)?.last_checkin_date
			? dateFormatter.format(new Date((member as any).last_checkin_date))
			: dateFormatter.format(new Date(attendanceRecords[0].date));

		return { currentStreak, checksThisMonth, lastCheckInForStreak };
	}, [attendanceRecords]);

	// Flame style based on server-provided streak value (member.current_streak)
	const flameStyle = (() => {
		const s = (member as any)?.current_streak ?? 0;
		if (s === 0) return { color: '#9CA3AF' };
		if (s >= 30) return { color: '#7f1d1d', boxShadow: '0 0 24px rgba(127,29,29,0.45)' };
		if (s >= 7) return { color: '#ef4444' };
		return { color: '#f97316' };
	})();

	const last7Days = useMemo(() => {
		const result = [];
		const recordDates = new Set(attendanceRecords.map((r) => r.date));
		const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const dateKey = d.toISOString().split('T')[0];
			const hasCheckIn = recordDates.has(dateKey);
			const dayAbbr = dayLabels[d.getDay()];
			result.push({ dateKey, hasCheckIn, dayAbbr });
		}

		return result;
	}, [attendanceRecords]);

	const C = {
		bg: '#050508',
		surface: '#0d0d14',
		glass: 'rgba(255,255,255,0.04)',
		border: 'rgba(255,255,255,0.08)',
		primary: '#7c3aed',
		primaryGlow: 'rgba(124,58,237,0.4)',
		accent: '#a78bfa',
		gold: '#f59e0b',
		green: '#10b981',
		red: '#ef4444',
		textPrimary: '#f8fafc',
		textSecondary: '#64748b',
		textMuted: '#334155',
	} as const;

	const ringRadius = isMobile ? 60 : 80;
	const circumference = 2 * Math.PI * ringRadius;

	// Loading skeleton
	if (loading) {
		return (
			<div style={{ minHeight: '100vh', backgroundColor: C.bg, paddingTop: 80, fontFamily: "'DM Sans', sans-serif", color: C.textPrimary }}>
				<style>{`
					@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
					@keyframes shimmer { 0% { background-position: 200% 0;} 100% { background-position: -200% 0; } }
				`}</style>
				<div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
					<div style={{ height: 280, borderRadius: 24, background: `linear-gradient(90deg, ${C.surface} 25%, rgba(124,58,237,0.1) 50%, ${C.surface} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginBottom: 32 }} />
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} style={{ height: 120, borderRadius: 16, background: `linear-gradient(90deg, ${C.surface} 25%, rgba(124,58,237,0.1) 50%, ${C.surface} 75%)`, animation: 'shimmer 1.5s infinite' }} />
						))}
					</div>
					<div style={{ height: 200, borderRadius: 24, background: `linear-gradient(90deg, ${C.surface} 25%, rgba(124,58,237,0.1) 50%, ${C.surface} 75%)`, animation: 'shimmer 1.5s infinite' }} />
				</div>
			</div>
		);
	}

	if (!member) {
		return (
			<div style={{ minHeight: '100vh', backgroundColor: C.bg, paddingTop: 80, fontFamily: "'DM Sans', sans-serif", color: C.textPrimary }}>
				<div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 80px' }}>
					<div style={{ borderRadius: 16, padding: 24, background: C.surface, border: `1px solid ${C.border}`, color: C.textSecondary }}>{error ?? 'Member profile is unavailable right now.'}</div>
				</div>
			</div>
		);
	}

	const containerPadding = isMobile ? '0 16px 60px' : '0 24px 80px';
	const containerPaddingTop = isMobile ? 70 : 80;
	const sectionSpacing = isMobile ? '18px' : '32px';
	const heroPadding = isMobile ? '28px 20px' : '48px';
	const heroFlexDirection = isMobile ? 'column' : 'row';
	const statsGap = isMobile ? 10 : 16;
	const qrSize = isMobile ? 140 : 160;
	const membershipStatusLabel = activeSub ? 'ACTIVE' : 'NONE';
	const membershipStatusColor = activeSub ? C.green : C.gold;

	return (
		<div style={{ minHeight: '100vh', backgroundColor: C.bg, fontFamily: "'DM Sans', sans-serif", color: C.textPrimary, paddingTop: containerPaddingTop }}>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');

				@keyframes pulse { 0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.05)} }
				@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
				@keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
				@keyframes glowPulse { 0%,100%{box-shadow:0 0 20px rgba(124,58,237,0.3);}50%{box-shadow:0 0 40px rgba(124,58,237,0.6);} }
			`}</style>

			{/* ambient radial blob */}
			<div style={{ position: 'fixed', top: '-20%', left: '-10%', width: isMobile ? 280 : 600, height: isMobile ? 280 : 600, background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0, animation: 'pulse 8s ease-in-out infinite alternate' }} />

			<div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: containerPadding, animation: 'fadeInUp 0.6s ease forwards', opacity: 0, animationDelay: '0ms' }}>
				{/* success banner from search params */}
				{alreadyActiveBanner.show ? (
					<div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.18)`, color: C.green }}>
						You already have an active subscription until {alreadyActiveBanner.endDate ? dateFormatter.format(new Date(alreadyActiveBanner.endDate)) : 'N/A'}
					</div>
				) : null}

				{/* HERO STATUS */}
				{isMobile ? (
					<section
						style={{
							position: 'relative',
							overflow: 'hidden',
							borderRadius: 20,
							border: '1px solid rgba(124,58,237,0.2)',
							background: 'linear-gradient(160deg, rgba(124,58,237,0.18) 0%, rgba(10,10,18,0.97) 55%, rgba(124,58,237,0.06) 100%)',
							padding: '28px 24px 32px',
							margin: '0 4px',
							boxShadow: '0 0 60px rgba(124,58,237,0.12), 0 20px 60px rgba(0,0,0,0.4)',
							marginBottom: sectionSpacing,
						}}
					>
						<div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, background: 'radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
						<div style={{ position: 'absolute', top: 0, right: 0, width: 150, height: 120, background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.25) 0%, transparent 65%)', pointerEvents: 'none' }} />

						<div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>
							<div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 999, padding: '5px 14px', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.accent, marginBottom: 14, width: 'fit-content' }}>
								<span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
								<span>{activeSub ? 'ACTIVE MEMBER' : 'NO ACTIVE PLAN'}</span>
							</div>

							<h1 style={{ margin: 0, fontFamily: "'Bebas Neue', cursive", fontSize: 44, lineHeight: 0.95, letterSpacing: '0.02em', background: `linear-gradient(135deg, #ffffff 0%, ${C.accent} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{member.full_name.toUpperCase()}</h1>

							<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 0 }}>
								<div style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 999, padding: '4px 12px', fontSize: 11, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{activeSub ? activeSub.plan?.name : 'No active membership'}</div>
								{activeSub ? <div style={{ fontSize: 11, color: C.textSecondary }}>{activeSub.plan?.billing_cycle}</div> : null}
							</div>

							{activeSub ? (
								<>
									<div style={{ display: 'flex', gap: 20, marginBottom: 4 }}>
										<div>
											<div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textMuted }}>Start</div>
											<div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500, marginTop: 2 }}>{dateFormatter.format(new Date(activeSub.start_date))}</div>
										</div>
										<div>
											<div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textMuted }}>Expires</div>
											<div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500, marginTop: 2 }}>{dateFormatter.format(new Date(activeSub.end_date))}</div>
										</div>
									</div>

									<div>
										<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
											<div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textSecondary }}>Days remaining</div>
											<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20, color: daysLeft > 30 ? C.textPrimary : daysLeft >= 7 ? C.gold : C.red }}>{daysLeft} days</div>
										</div>
										<div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)', marginTop: 10, overflow: 'hidden' }}>
											<div style={{ height: '100%', width: `${progressPct}%`, borderRadius: 999, background: `linear-gradient(90deg, ${C.primary}, ${C.accent})`, boxShadow: `0 0 10px ${C.primaryGlow}`, transition: 'width 1.2s ease' }} />
										</div>
									</div>

									{daysLeft < 30 ? (
										<button onClick={() => router.push('/member/pay')} style={{ marginTop: 4, width: '100%', background: `linear-gradient(135deg, ${C.primary}, #5b21b6)`, border: 'none', borderRadius: 10, padding: '13px 24px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', boxShadow: `0 0 24px ${C.primaryGlow}` }}>Renew Membership →</button>
									) : null}
								</>
							) : (
								<div>
									<div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textSecondary, marginBottom: 6 }}>Subscription</div>
									<div style={{ color: C.textSecondary, fontSize: 14 }}>No active subscription</div>
									<div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>Contact gym to get started</div>
								</div>
							)}
						</div>
					</section>
				) : (
					<section style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, border: `1px solid ${C.border}`, background: `linear-gradient(135deg, rgba(124,58,237,0.15) 0%, ${C.surface} 50%, rgba(124,58,237,0.05) 100%)`, padding: heroPadding, marginBottom: sectionSpacing, boxShadow: `0 0 60px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.06)`, display: 'flex', gap: 48, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', flexDirection: heroFlexDirection }}>
						{/* corner accent */}
						<div style={{ position: 'absolute', top: 0, right: 0, width: 200, height: 200, background: 'radial-gradient(circle at top right, rgba(124,58,237,0.3), transparent 70%)', pointerEvents: 'none' }} />

						{/* LEFT */}
						<div style={{ flex: '1 1 480px', minWidth: 260 }}>
							{/* status chip */}
							<div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 999, padding: '6px 16px', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.accent }}>
								<span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 8px ${C.green}`, animation: 'pulse 2s infinite' }} />
								<span>{activeSub ? 'ACTIVE MEMBER' : 'NO ACTIVE PLAN'}</span>
							</div>

							{/* member name */}
							<h1 style={{ marginTop: 16, fontFamily: "'Bebas Neue', cursive", fontSize: isMobile ? '52px' : 'clamp(48px, 8vw, 80px)', lineHeight: 1, letterSpacing: '0.02em', marginBottom: 8, background: `linear-gradient(135deg,#ffffff 0%, ${C.accent} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{member.full_name.toUpperCase()}</h1>

							<div style={{ fontSize: 14, color: C.textSecondary, marginTop: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{activeSub ? activeSub.plan?.name : 'No active membership'}</div>

							{activeSub ? (
								<div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
									<div>
										<div style={{ fontSize: 10, letterSpacing: '0.15em', color: C.textMuted, textTransform: 'uppercase' }}>Start</div>
										<div style={{ fontSize: 14, color: C.textPrimary, fontWeight: 600 }}>{dateFormatter.format(new Date(activeSub.start_date))}</div>
									</div>
									<div>
										<div style={{ fontSize: 10, letterSpacing: '0.15em', color: C.textMuted, textTransform: 'uppercase' }}>Expires</div>
										<div style={{ fontSize: 14, color: C.textPrimary, fontWeight: 600 }}>{dateFormatter.format(new Date(activeSub.end_date))}</div>
									</div>
								</div>
							) : null}
						</div>

						{/* RIGHT: Days remaining ring */}
						<div style={{ width: isMobile ? 140 : 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', alignSelf: isMobile ? 'center' : 'auto' }}>
							<div style={{ position: 'relative', width: isMobile ? 140 : 180, height: isMobile ? 140 : 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
								<svg viewBox="0 0 200 200" width={isMobile ? 140 : 180} height={isMobile ? 140 : 180}>
									<circle cx="100" cy="100" r={ringRadius} stroke={C.border} strokeWidth="4" fill="none" />
									<circle cx="100" cy="100" r={ringRadius} stroke={C.primary} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progressPct / 100)} style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', filter: `drop-shadow(0 0 8px ${C.primary})`, transition: 'stroke-dashoffset 1.5s ease' }} />
								</svg>

								<div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
									<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isMobile ? 44 : 56, lineHeight: 1, color: daysLeft > 30 ? C.textPrimary : daysLeft >= 7 ? C.gold : C.red }}>{daysLeft}</div>
									<div style={{ fontSize: 10, letterSpacing: '0.2em', color: C.textSecondary, textTransform: 'uppercase' }}>DAYS LEFT</div>
								</div>
							</div>

							{daysLeft < 30 ? (
								<button onClick={() => router.push('/member/pay')} style={{ marginTop: 16, background: `linear-gradient(135deg, ${C.primary}, #5b21b6)`, border: 'none', borderRadius: 999, padding: '10px 24px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', boxShadow: `0 0 20px ${C.primaryGlow}` }}>Renew Now</button>
							) : null}
						</div>
					</section>
				)}

				{/* STATS CARDS */}
				<section style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: statsGap, marginBottom: sectionSpacing, animation: 'fadeInUp 0.6s ease forwards', animationDelay: '150ms', opacity: 0 }}>
					{/* Card template */}
					<div style={{ background: C.glass, backdropFilter: 'blur(12px)', border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? '16px 18px' : 24, position: 'relative', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
							<Zap color={C.primary} />
							<div style={{ marginLeft: 'auto', textAlign: 'right' }}>
								<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isMobile ? 30 : 40, color: C.textPrimary }}>{checkInsThisMonth}</div>
								<div style={{ fontSize: isMobile ? 9 : 11, color: C.textSecondary, letterSpacing: '0.12em', textTransform: 'uppercase' }}>CHECK-INS THIS MONTH</div>
							</div>
						</div>
						<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.primary}, transparent)` }} />
					</div>

					<div style={{ background: C.glass, backdropFilter: 'blur(12px)', border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? '16px 18px' : 24, position: 'relative', overflow: 'hidden' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
							<Calendar color={C.accent} />
							<div style={{ marginLeft: 'auto', textAlign: 'right' }}>
								<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isMobile ? 30 : 40, color: C.textPrimary }}>{new Date(member.joined_at).getFullYear()}</div>
								<div style={{ fontSize: 12, color: C.textSecondary }}>{dateFormatter.format(new Date(member.joined_at))}</div>
								<div style={{ fontSize: isMobile ? 9 : 11, color: C.textSecondary, letterSpacing: '0.12em', textTransform: 'uppercase' }}>MEMBER SINCE</div>
							</div>
						</div>
						<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)` }} />
					</div>

					<div style={{ background: C.glass, backdropFilter: 'blur(12px)', border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? '16px 18px' : 24, position: 'relative', overflow: 'hidden' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
							<Activity color={C.green} />
							<div style={{ marginLeft: 'auto', textAlign: 'right' }}>
								{lastCheckIn ? (
									<>
										<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isMobile ? 30 : 32, color: C.textPrimary }}>{new Date(lastCheckIn.checked_in_at).getDate()} {new Date(lastCheckIn.checked_in_at).toLocaleString('en-IN', { month: 'short' }).toUpperCase()}</div>
										<div style={{ fontSize: 12, color: C.textSecondary }}>{timeFormatter.format(new Date(lastCheckIn.checked_in_at))}</div>
									</>
								) : (
									<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isMobile ? 30 : 32, color: C.textMuted }}>NEVER</div>
								)}
								<div style={{ fontSize: isMobile ? 9 : 11, color: C.textSecondary, letterSpacing: '0.12em', textTransform: 'uppercase' }}>LAST CHECK-IN</div>
							</div>
						</div>
						<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.green}, transparent)` }} />
					</div>

					<div style={{ background: C.glass, backdropFilter: 'blur(12px)', border: `1px solid ${C.border}`, borderRadius: 16, padding: isMobile ? '16px 18px' : 24, position: 'relative', overflow: 'hidden' }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
							<Shield color={C.textPrimary} />
							<div style={{ marginLeft: 'auto', textAlign: 'right' }}>
								<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isMobile ? 30 : 32, color: membershipStatusColor }}>{membershipStatusLabel}</div>
								<div style={{ fontSize: isMobile ? 9 : 11, color: C.textSecondary, letterSpacing: '0.12em', textTransform: 'uppercase' }}>MEMBERSHIP STATUS</div>
							</div>
						</div>
						<div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: activeSub ? `linear-gradient(90deg, transparent, ${C.green}, transparent)` : `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />
					</div>
				</section>

				{/* ATTENDANCE STREAK CARD */}
				<section style={{ background: '#1a1430', borderRadius: 16, padding: isMobile ? '24px 20px' : 24, marginBottom: sectionSpacing, animation: 'fadeInUp 0.6s ease forwards', animationDelay: '300ms', opacity: 0 }}>
					<div style={{ display: isMobile ? 'block' : 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, textAlign: isMobile ? 'center' : 'left' }}>
						{/* Left: Streak flame and count */}
						<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: isMobile ? 16 : 0 }}>
							<div style={{ fontSize: isMobile ? 40 : 48, ...(flameStyle as any) }}>🔥</div>
							<div style={{ color: C.textPrimary, fontSize: isMobile ? 44 : 52, fontWeight: 700, lineHeight: 1 }}>{currentStreak}</div>
							<div style={{ color: C.accent, fontSize: 14 }}>day streak</div>
						</div>

						{/* Right: Mini stats */}
						<div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: isMobile ? 'center' : 'flex-start' }}>
							<div>
								<div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '2px' }}>CHECK-INS THIS MONTH</div>
								<div style={{ color: C.textPrimary, fontSize: 18, fontWeight: 600, marginTop: 4 }}>{checksThisMonth}</div>
							</div>
							<div>
								<div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '2px' }}>LAST CHECK-IN</div>
									<div style={{ color: C.textPrimary, fontSize: 18, fontWeight: 600, marginTop: 4 }}>{lastCheckInForStreak}</div>
							</div>
						</div>
					</div>

					{/* Divider */}
					<div style={{ height: 1, background: '#2d2060', margin: '16px 0' }} />

					{/* Last 7 days dot row */}
					<div>
						<div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 8, textAlign: isMobile ? 'center' : 'left' }}>LAST 7 DAYS</div>

						{streakLoading ? (
								<div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
								{[...Array(7)].map((_, i) => (
										<div key={i} style={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: '50%', background: '#2d2060', animation: 'pulse 2s infinite' }} />
								))}
							</div>
						) : attendanceRecords.length === 0 ? (
							<div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14 }}>No check-ins yet — scan the gym QR to start!</div>
						) : (
							<>
									<div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
									{last7Days.map(({ dateKey, hasCheckIn, dayAbbr }) => (
										<div key={dateKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
											<div
												style={{
														width: isMobile ? 28 : 32,
														height: isMobile ? 28 : 32,
													borderRadius: '50%',
													background: hasCheckIn ? C.primary : '#2d2060',
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
														color: hasCheckIn ? 'white' : '#4b3a8a',
														fontSize: hasCheckIn ? 14 : 11,
													fontWeight: 600,
												}}
											>
												{hasCheckIn ? '✓' : dayAbbr[0]}
											</div>
											<div style={{ fontSize: 10, color: '#6b7280' }}>{dayAbbr}</div>
										</div>
									))}
								</div>

								{/* Streak milestone message */}
								<div style={{ marginTop: 12, textAlign: 'center', fontSize: 14 }}>
									{currentStreak === 0 ? (
										<span style={{ color: '#6b7280' }}>Start your streak today 💪</span>
									) : currentStreak >= 30 ? (
										<span style={{ color: C.gold }}>Legendary. 30 days! 👑</span>
									) : currentStreak >= 7 ? (
										<span style={{ color: C.gold }}>One week strong! 🏆</span>
									) : currentStreak >= 3 ? (
										<span style={{ color: C.accent }}>On a roll! Keep it up 🔥</span>
									) : (
										<span style={{ color: '#6b7280' }}>Keep showing up!</span>
									)}
								</div>

								{/* Best streak */}
								<div style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: C.textMuted }}>Best: {(member as any)?.longest_streak ?? 0} days</div>
							</>
						)}
					</div>
				</section>

				{/* RECENT PAYMENTS */}
				<section style={{ animation: 'fadeInUp 0.6s ease forwards', animationDelay: '450ms', opacity: 0 }}>
					<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
						<div>
							<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, letterSpacing: '0.1em' }}>TRANSACTION LOG</div>
							<div style={{ color: C.textSecondary, marginTop: 4 }}>Recent completed payments</div>
						</div>
					</div>

					<div style={{ marginTop: 16, background: C.glass, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
						<div style={{ background: 'rgba(124,58,237,0.08)', borderBottom: `1px solid ${C.border}`, padding: '12px 24px', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.textMuted, display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1fr auto auto auto' }}>
							<div>PLAN</div>
							<div>AMOUNT</div>
							{!isMobile ? <div>METHOD</div> : null}
							{!isMobile ? <div>DATE</div> : null}
						</div>

						{recentPayments.length === 0 ? (
							<div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
								<Lock />
								<div>No transactions recorded</div>
							</div>
						) : (
							recentPayments.map((p) => {
								const methodStyles = p.payment_method === 'cash' ? { background: 'rgba(245,158,11,0.15)', color: C.gold } : { background: 'rgba(99,102,241,0.15)', color: '#818cf8' };
									const paymentLabel = p.notes ?? 'Payment';
								return (
									<div key={p.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1fr auto auto auto', gap: 16, alignItems: 'center', padding: isMobile ? '12px 16px' : '16px 24px', borderBottom: `1px solid ${C.border}`, transition: 'background 0.15s' }}>
										<div>
												<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isMobile ? 16 : 20 }}>{paymentLabel}</div>
										</div>
										<div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isMobile ? 16 : 20 }}>{currencyFormatter.format(Number(p.amount ?? 0))}</div>
										{!isMobile ? (
											<div>
												<span style={{ borderRadius: 999, padding: '2px 10px', fontSize: 11, ...methodStyles }}>{p.payment_method === 'cash' ? 'Cash' : 'Razorpay'}</span>
											</div>
										) : null}
										{!isMobile ? <div style={{ color: C.textSecondary }}>{dateFormatter.format(new Date(p.paid_at ?? p.created_at))}</div> : null}
									</div>
								);
							})
						)}
					</div>
				</section>
			</div>
		</div>
	);
}
