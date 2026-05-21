'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import api from '@/lib/api';
import useAuthStore from '@/store/authStore';

type CheckinResponse = {
	success: boolean;
	message: string;
	member_name?: string;
	checked_in_at?: string;
	already_checked_in?: boolean;
};

type RouteParams = {
	gym_id?: string | string[];
};

export default function CheckinPage() {
	const params = useParams<RouteParams>();
	const router = useRouter();
	const user = useAuthStore((s) => s.user);

	const [status, setStatus] = useState<'loading' | 'success' | 'duplicate' | 'error'>('loading');
	const [message, setMessage] = useState('');
	const [memberName, setMemberName] = useState('');
	const [checkinTime, setCheckinTime] = useState('');

	useEffect(() => {
		const performCheckin = async () => {
			try {
				// Check for token
				const token = typeof window !== 'undefined' ? localStorage.getItem('apex_token') : null;

				if (!token) {
                  console.log('no token — saving redirect and going to login');
                  localStorage.setItem('apex_checkin_redirect', window.location.href);
                  router.replace('/login');
                  return;
				
				}

				// Call checkin endpoint
				const response = await api.post<CheckinResponse>('/attendance/checkin/', {});
				const data = response.data ?? response;

				if (data.already_checked_in) {
					setStatus('duplicate');
					setMessage(`You've already checked in today. See you again soon!`);
					setMemberName(data.member_name ?? 'Member');
				} else if (data.success) {
					setStatus('success');
					setMessage('Access Granted');
					setMemberName(data.member_name ?? 'Welcome');

					// Format time
					if (data.checked_in_at) {
						const time = new Date(data.checked_in_at);
						const formatter = new Intl.DateTimeFormat('en-IN', {
							hour: '2-digit',
							minute: '2-digit',
							second: '2-digit',
						});
						setCheckinTime(formatter.format(time));
					}
				} else {
					setStatus('error');
					setMessage(data.message || 'Check-in failed');
				}
			} catch (err) {
				console.error('Checkin error:', err);
				setStatus('error');
				setMessage('Unable to complete check-in. Please try again.');
			}
		};

		performCheckin();
	}, [router]);

	const bgColor = '#050508';
	const surfaceColor = 'rgba(255, 255, 255, 0.025)';
	const borderColor = 'rgba(255, 255, 255, 0.06)';
	const textPrimary = '#f1f5f9';
	const textSecondary = '#94a3b8';
	const primaryColor = '#7c3aed';
	const primaryGlow = 'rgba(124, 58, 237, 0.25)';
	const greenColor = '#10b981';
	const greenGlow = 'rgba(16, 185, 129, 0.3)';

	return (
		<>
			<style>{`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

@keyframes fadeInScale {
	from {
		opacity: 0;
		transform: scale(0.92);
	}
	to {
		opacity: 1;
		transform: scale(1);
	}
}

@keyframes successPulse {
	0%, 100% {
		box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
	}
	50% {
		box-shadow: 0 0 40px rgba(16, 185, 129, 0.5);
	}
}

@keyframes checkmarkDraw {
	0% {
		stroke-dashoffset: 50;
	}
	100% {
		stroke-dashoffset: 0;
	}
}

@keyframes float {
	0%, 100% {
		transform: translateY(0px);
	}
	50% {
		transform: translateY(-10px);
	}
}
			`}</style>

			<div
				style={{
					position: 'fixed',
					inset: 0,
					background: bgColor,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: '24px',
					overflow: 'auto',
				}}
			>
				{/* Background orbs */}
				<div
					style={{
						position: 'fixed',
						top: '-10%',
						left: '50%',
						transform: 'translateX(-50%)',
						width: '600px',
						height: '400px',
						borderRadius: '50%',
						background:
							status === 'success' || status === 'duplicate'
								? `radial-gradient(ellipse, ${greenGlow} 0%, transparent 65%)`
								: `radial-gradient(ellipse, ${primaryGlow} 0%, transparent 65%)`,
						pointerEvents: 'none',
						zIndex: 0,
					}}
				/>
				<div
					style={{
						position: 'fixed',
						bottom: '-5%',
						right: '-5%',
						width: '400px',
						height: '400px',
						borderRadius: '50%',
						background: `radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 65%)`,
						pointerEvents: 'none',
						zIndex: 0,
					}}
				/>

				{/* Content */}
				<div
					style={{
						position: 'relative',
						zIndex: 1,
						textAlign: 'center',
						maxWidth: '480px',
						width: '100%',
						animation: 'fadeInScale 0.6s ease out',
					}}
				>
					{status === 'loading' ? (
						<div
							style={{
								padding: '40px 24px',
							}}
						>
							<div
								style={{
									width: '80px',
									height: '80px',
									margin: '0 auto 24px',
									borderRadius: '50%',
									border: `3px solid ${borderColor}`,
									borderTopColor: primaryColor,
									animation: 'spin 1s linear infinite',
								}}
							/>
							<p
								style={{
									fontSize: '16px',
									color: textSecondary,
									margin: 0,
								}}
							>
								Verifying your access...
							</p>
						</div>
					) : status === 'success' ? (
						<div
							style={{
								padding: '40px 24px',
							}}
						>
							{/* Checkmark */}
							<div
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: '120px',
									height: '120px',
									borderRadius: '50%',
									background: `${greenGlow}20`,
									border: `2px solid ${greenColor}`,
									margin: '0 auto 32px',
									animation: 'successPulse 2s ease-in-out infinite',
								}}
							>
								<CheckCircle2
									style={{
										width: '64px',
										height: '64px',
										color: greenColor,
										strokeWidth: 1.5,
									}}
								/>
							</div>

							{/* Message */}
							<h1
								style={{
									fontFamily: "'Bebas Neue', cursive",
									fontSize: '48px',
									lineHeight: 1,
									letterSpacing: '0.05em',
									color: textPrimary,
									margin: '0 0 12px',
								}}
							>
								{message}
							</h1>

							{/* Member name */}
							<p
								style={{
									fontSize: '20px',
									color: textSecondary,
									margin: '0 0 8px',
									fontWeight: 500,
								}}
							>
								{memberName}
							</p>

							{/* Time */}
							{checkinTime && (
								<div
									style={{
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										gap: '8px',
										fontSize: '14px',
										color: textSecondary,
										margin: '0',
									}}
								>
									<Clock
										style={{
											width: '16px',
											height: '16px',
										}}
									/>
									<span>{checkinTime}</span>
								</div>
							)}

							{/* Subtext */}
							<p
								style={{
									fontSize: '13px',
									color: `${textSecondary}99`,
									margin: '24px 0 0',
									fontWeight: 300,
								}}
							>
								Enjoy your workout!
							</p>
						</div>
					) : status === 'duplicate' ? (
						<div
							style={{
								padding: '40px 24px',
							}}
						>
							{/* Info icon */}
							<div
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: '120px',
									height: '120px',
									borderRadius: '50%',
									background: `rgba(59, 130, 246, 0.1)`,
									border: `2px solid rgba(59, 130, 246, 0.5)`,
									margin: '0 auto 32px',
								}}
							>
								<AlertCircle
									style={{
										width: '64px',
										height: '64px',
										color: '#3b82f6',
										strokeWidth: 1.5,
									}}
								/>
							</div>

							{/* Message */}
							<h1
								style={{
									fontFamily: "'Bebas Neue', cursive",
									fontSize: '36px',
									lineHeight: 1,
									letterSpacing: '0.05em',
									color: textPrimary,
									margin: '0 0 12px',
								}}
							>
								Already Here
							</h1>

							{/* Member name */}
							<p
								style={{
									fontSize: '18px',
									color: textSecondary,
									margin: '0 0 24px',
									fontWeight: 500,
								}}
							>
								Welcome back, {memberName}!
							</p>

							{/* Subtext */}
							<p
								style={{
									fontSize: '13px',
									color: `${textSecondary}99`,
									margin: '0',
									fontWeight: 300,
									lineHeight: 1.5,
								}}
							>
								{message}
							</p>
						</div>
					) : (
						<div
							style={{
								padding: '40px 24px',
							}}
						>
							{/* Error icon */}
							<div
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									justifyContent: 'center',
									width: '120px',
									height: '120px',
									borderRadius: '50%',
									background: `rgba(239, 68, 68, 0.1)`,
									border: `2px solid rgba(239, 68, 68, 0.5)`,
									margin: '0 auto 32px',
								}}
							>
								<AlertCircle
									style={{
										width: '64px',
										height: '64px',
										color: '#ef4444',
										strokeWidth: 1.5,
									}}
								/>
							</div>

							{/* Message */}
							<h1
								style={{
									fontFamily: "'Bebas Neue', cursive",
									fontSize: '36px',
									lineHeight: 1,
									letterSpacing: '0.05em',
									color: textPrimary,
									margin: '0 0 24px',
								}}
							>
								Access Denied
							</h1>

							{/* Subtext */}
							<p
								style={{
									fontSize: '14px',
									color: textSecondary,
									margin: '0',
									fontWeight: 300,
									lineHeight: 1.6,
								}}
							>
								{message}
							</p>

							{/* Retry button */}
							<button
								type="button"
								onClick={() => window.location.reload()}
								style={{
									marginTop: '24px',
									padding: '12px 32px',
									background: primaryColor,
									color: textPrimary,
									border: 'none',
									borderRadius: '8px',
									fontSize: '13px',
									fontWeight: 600,
									letterSpacing: '0.08em',
									cursor: 'pointer',
									textTransform: 'uppercase',
									transition: 'all 0.2s ease',
								}}
								onMouseEnter={(e) => {
									(e.target as HTMLButtonElement).style.background = '#6d28d9';
									(e.target as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(124,58,237,0.3)';
								}}
								onMouseLeave={(e) => {
									(e.target as HTMLButtonElement).style.background = primaryColor;
									(e.target as HTMLButtonElement).style.boxShadow = 'none';
								}}
							>
								Try Again
							</button>
						</div>
					)}
				</div>
			</div>

			<style>{`
@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
			`}</style>
		</>
	);
}
