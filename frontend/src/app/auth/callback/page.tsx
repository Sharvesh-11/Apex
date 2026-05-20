"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { post } from '@/lib/api';
import useAuthStore from '@/store/authStore';

type OAuthCallbackResponse = {
	access_token: string;
	role: 'gym_member' | 'gym_owner' | 'admin';
};

const ROLE_REDIRECTS: Record<OAuthCallbackResponse['role'], string> = {
	gym_member: '/member/dashboard',
	gym_owner: '/owner/dashboard',
	admin: '/admin/dashboard',
};

function CallbackContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const [status, setStatus] = useState<'loading' | 'error'>('loading');
	const [errorMessage, setErrorMessage] = useState('');

	useEffect(() => {
		const code = searchParams.get('code');

		if (!code) {
			setStatus('error');
			setErrorMessage('Authentication failed');
			return;
		}

		let cancelled = false;

		void (async () => {
			try {
				const response = await post<OAuthCallbackResponse>('/oauth/google/callback', { code });

				localStorage.setItem('apex_token', response.access_token);
				document.cookie = `apex_token=${response.access_token}; path=/; max-age=${60 * 60 * 24}`;

				useAuthStore.setState({
					token: response.access_token,
					role: response.role,
					isAuthenticated: true,
				});

				window.setTimeout(() => {
					if (cancelled) return;
					router.replace(ROLE_REDIRECTS[response.role]);
				}, 100);
			} catch {
				if (cancelled) return;
				setStatus('error');
				setErrorMessage('Authentication failed');
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [router, searchParams]);

	const retry = () => {
		router.replace('/login');
	};

	return (
		<div
			style={{
				minHeight: '100vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'radial-gradient(circle at top, rgba(124,58,237,0.18), transparent 45%), linear-gradient(180deg, #050508 0%, #090912 100%)',
				color: '#f1f5f9',
				padding: '24px',
			}}
		>
			<div
				style={{
					width: '100%',
					maxWidth: '420px',
					border: '1px solid rgba(255,255,255,0.08)',
					borderRadius: '24px',
					background: 'rgba(10,10,18,0.88)',
					backdropFilter: 'blur(18px)',
					boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
					padding: '40px 32px',
					textAlign: 'center',
				}}
			>
				{status === 'loading' ? (
					<>
						<div
							style={{
								width: '68px',
								height: '68px',
								borderRadius: '50%',
								margin: '0 auto 20px',
								border: '3px solid rgba(124,58,237,0.16)',
								borderTopColor: '#7c3aed',
								animation: 'spin 0.9s linear infinite',
							}}
						/>
						<div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '8px' }}>
							Completing sign in...
						</div>
						<div style={{ color: 'rgba(241,245,249,0.68)', fontSize: '14px' }}>
							Please wait while we finish setting up your account.
						</div>
					</>
				) : (
					<>
						<div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '8px' }}>
							{errorMessage}
						</div>
						<div style={{ color: 'rgba(241,245,249,0.68)', fontSize: '14px', marginBottom: '24px' }}>
							Something went wrong while completing Google sign in.
						</div>
						<button
							type="button"
							onClick={retry}
							style={{
								border: '1px solid rgba(124,58,237,0.28)',
								background: 'rgba(124,58,237,0.12)',
								color: '#a78bfa',
								padding: '12px 18px',
								borderRadius: '12px',
								fontSize: '14px',
								fontWeight: 600,
								cursor: 'pointer',
								width: '100%',
							}}
						>
							Return to login
						</button>
					</>
				)}
			</div>

			<style>{`
				@keyframes spin {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
				}
			`}</style>
		</div>
	);
}

export default function AuthCallbackPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<CallbackContent />
		</Suspense>
	);
}
