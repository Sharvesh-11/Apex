"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/authStore';
import { post } from '@/lib/api';
import { siteConfig, C } from '@/lib/config';

type CheckinResponse = {
	success: boolean;
	message?: string;
	member_name?: string;
	checked_in_at?: string;
	already_checked_in?: boolean;
	next_checkin_at?: string;
	current_streak?: number;
};

export default function CheckinLandingPage() {
	const router = useRouter();
	const initAuth = useAuthStore((s) => s.initAuth);

	const [status, setStatus] = useState<'loading' | 'checking_in' | 'success' | 'already_checked_in' | 'error' | 'not_logged_in'>('loading');
	const [message, setMessage] = useState('');
	const [memberName, setMemberName] = useState('');
	const [streak, setStreak] = useState<number>(0);
	const [nextCheckinAt, setNextCheckinAt] = useState('');

	useEffect(() => {
		let mounted = true;

		(async () => {
			setStatus('loading');
			try {
				await initAuth();
			} catch (err) {
				// initAuth handles invalid tokens; proceed to check user
			}

			const current = useAuthStore.getState().user;
			if (!current) {
				if (mounted) {
					setStatus('not_logged_in');
					try {
						window.localStorage.setItem('apex_checkin_redirect', '/checkin');
					} catch {}
				}
				return;
			}

			if (current.role !== 'gym_member') {
				if (mounted) {
					setStatus('error');
					setMessage('Only members can check in');
				}
				return;
			}

			if (mounted) setStatus('checking_in');

			try {
				const res = await post<CheckinResponse>('/attendance/checkin/', {});
				// post helper returns data
				if (!mounted) return;
				if ((res as any).already_checked_in) {
					setStatus('already_checked_in');
					setMessage(res.message ?? 'You have already checked in');
					setMemberName(res.member_name ?? 'Member');
					setNextCheckinAt(res.next_checkin_at ?? '');
					return;
				}

				if (res.success) {
					setStatus('success');
					setMemberName(res.member_name ?? '');
					setStreak(res.current_streak ?? 0);
					setMessage(res.message ?? 'Checked in');
					return;
				}

				setStatus('error');
				setMessage(res.message ?? 'Check-in failed');
			} catch (err: any) {
				// Axios error handling
				const resp = err?.response?.data;
				if (resp?.already_checked_in) {
					if (!mounted) return;
					setStatus('already_checked_in');
					setMessage(resp.message ?? 'Already checked in');
					setNextCheckinAt(resp.next_checkin_at ?? '');
					setMemberName(resp.member_name ?? 'Member');
					return;
				}

				if (!mounted) return;
				setStatus('error');
				setMessage(resp?.detail ?? resp?.message ?? 'Unable to complete check-in');
			}
		})();

		return () => {
			mounted = false;
		};
	}, [initAuth]);

	const formatTime = (iso?: string) => {
		if (!iso) return '';
		try {
			const dt = new Date(iso);
			return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(dt);
		} catch { return iso; }
	};

	return (
		<div style={{ minHeight: '100vh', backgroundColor: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", color: C.textPrimary, padding: 24 }}>
			<style>{`
			@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
			@keyframes spin { to { transform: rotate(360deg); } }
			`}</style>

			{/* Brand */}
			<div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 28, color: C.accent, letterSpacing: '0.1em', marginBottom: 48 }}>{siteConfig.brand.name}</div>

			{(status === 'loading' || status === 'checking_in') && (
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<div style={{ width: 64, height: 64, borderRadius: '50%', border: '3px solid rgba(124,58,237,0.2)', borderTop: `3px solid ${C.primary}`, animation: 'spin 0.8s linear infinite' }} />
					<div style={{ fontSize: 16, color: C.textSecondary, marginTop: 24 }}>{status === 'loading' ? 'Loading...' : 'Checking you in...'}</div>
				</div>
			)}

			{status === 'not_logged_in' && (
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', border: '2px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🔒</div>
					<h2 style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 36, marginTop: 20 }}>SCAN DETECTED</h2>
					<p style={{ color: C.textSecondary, marginTop: 8 }}>Sign in to mark your attendance</p>
					<button onClick={() => router.push('/login?redirect=/checkin')} style={{ marginTop: 24, background: C.primary, border: 'none', borderRadius: 12, padding: '14px 32px', fontSize: 14, color: '#fff', cursor: 'pointer', boxShadow: `0 0 24px ${C.primaryGlow}` }}>Sign In</button>
				</div>
			)}

			{status === 'success' && (
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: `2px solid ${C.green}`, boxShadow: '0 0 40px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>✓</div>
					<h2 style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 42, color: C.textPrimary, letterSpacing: '0.05em', marginTop: 28 }}>CHECK-IN SUCCESSFUL</h2>
					{memberName && <p style={{ fontSize: 20, color: C.accent, fontWeight: 600, margin: '8px 0 0' }}>{memberName}</p>}
					{message && <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 8 }}>{message}</p>}
					{streak > 0 && (
						<div style={{ marginTop: 28, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 16, padding: '20px 32px', textAlign: 'center' }}>
							<div style={{ fontSize: 32 }}>🔥</div>
							<div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 48, color: C.accent }}>{streak}</div>
							<div style={{ fontSize: 11, letterSpacing: '0.2em', color: C.textSecondary }}>DAY STREAK</div>
						</div>
					)}

					<button onClick={() => router.push('/member/dashboard')} style={{ marginTop: 32, background: C.primary, border: 'none', borderRadius: 12, padding: '14px 32px', fontSize: 14, color: '#fff', cursor: 'pointer', boxShadow: `0 0 24px ${C.primaryGlow}` }}>Go to Dashboard</button>
				</div>
			)}

			{status === 'already_checked_in' && (
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', border: `2px solid ${C.gold}`, boxShadow: '0 0 30px rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>⏰</div>
					<h2 style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 36, color: C.gold, marginTop: 20 }}>ALREADY CHECKED IN</h2>
					<p style={{ color: C.textSecondary, marginTop: 8 }}>You've already checked in today</p>
					{nextCheckinAt && <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 12 }}>Next check-in available at {formatTime(nextCheckinAt)}</p>}
					<button onClick={() => router.push('/member/dashboard')} style={{ marginTop: 24, background: C.primary, border: 'none', borderRadius: 12, padding: '14px 32px', fontSize: 14, color: '#fff', cursor: 'pointer', boxShadow: `0 0 24px ${C.primaryGlow}` }}>Go to Dashboard</button>
				</div>
			)}

			{status === 'error' && (
				<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
					<div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: `2px solid ${C.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>✕</div>
					<h2 style={{ fontFamily: 'Bebas Neue, cursive', fontSize: 36, color: C.red, marginTop: 20 }}>CHECK-IN FAILED</h2>
					<p style={{ color: C.textSecondary, marginTop: 8 }}>{message}</p>
					<div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
						<button onClick={() => window.location.reload()} style={{ background: C.primary, border: 'none', borderRadius: 12, padding: '12px 24px', color: '#fff', cursor: 'pointer', boxShadow: `0 0 24px ${C.primaryGlow}` }}>Try Again</button>
						<button onClick={() => router.push('/member/dashboard')} style={{ background: 'transparent', border: `1px solid ${C.border ?? 'rgba(255,255,255,0.08)'}`, borderRadius: 12, padding: '12px 24px', color: C.textSecondary, cursor: 'pointer' }}>Dashboard</button>
					</div>
				</div>
			)}

		</div>
	);
}
