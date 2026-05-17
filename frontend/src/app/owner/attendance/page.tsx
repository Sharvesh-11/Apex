"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { QRCode, generateDataURL } from 'react-qrcode-logo';

import * as apiClient from '@/lib/api';
import type { AttendanceLog as AttendanceLogType, Member } from '@/types';
import AttendanceLog from '@/components/owner/AttendanceLog';

type AttendanceRecord = AttendanceLogType & {
	member?: Pick<Member, 'id' | 'full_name' | 'email'>;
};

type FilterMethod = 'all' | 'qr' | 'pin';

const C = {
	bg: '#050508',
	surface: '#0a0a12',
	surfaceHover: '#0e0e18',
	glass: 'rgba(255,255,255,0.025)',
	border: 'rgba(255,255,255,0.06)',
	borderHover: 'rgba(124,58,237,0.35)',
	primary: '#7c3aed',
	primaryGlow: 'rgba(124,58,237,0.25)',
	primarySoft: 'rgba(124,58,237,0.08)',
	accent: '#a78bfa',
	green: '#10b981',
	textPrimary: '#f1f5f9',
	textSecondary: '#475569',
	textMuted: '#1e293b',
};

function getDateKey(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function OwnerAttendancePage() {
	const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
	const [members, setMembers] = useState<Member[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedMemberId, setSelectedMemberId] = useState('');
	const [selectedDate, setSelectedDate] = useState('');
	const [selectedMethod, setSelectedMethod] = useState<FilterMethod>('all');
	const [memberSearch, setMemberSearch] = useState('');
	const [gymQrUrl, setGymQrUrl] = useState('');
	const [gymQrLoading, setGymQrLoading] = useState(false);
	const [gymQrError, setGymQrError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const gymQrRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		let mounted = true;

		void (async () => {
			setLoading(true);
			setError(null);
			try {
				const [attendanceResponse, membersResponse] = await Promise.all([
					apiClient.get<AttendanceRecord[]>('/attendance/'),
					apiClient.get<Member[]>('/members/'),
				]);
				if (!mounted) return;
				setAttendance(attendanceResponse ?? []);
				setMembers(membersResponse ?? []);
			} catch {
				if (!mounted) return;
				setError('Failed to load attendance data');
			} finally {
				if (mounted) setLoading(false);
			}

			// Fetch gym QR URL separately
			try {
				setGymQrLoading(true);
				const gymQrResponse = await apiClient.get<{ checkin_url?: string; url?: string }>('/attendance/gym-qr/');
				if (mounted) {
					setGymQrUrl(gymQrResponse?.checkin_url ?? gymQrResponse?.url ?? '');
				}
			} catch {
				if (mounted) setGymQrError('Failed to load gym QR');
			} finally {
				if (mounted) setGymQrLoading(false);
			}
		})();

		return () => { mounted = false; };
	}, []);

	useEffect(() => {
		const check = () => setIsMobile(window.innerWidth < 768);
		check();
		window.addEventListener('resize', check);
		return () => window.removeEventListener('resize', check);
	}, []);

	const memberMap = useMemo(
		() => new Map(members.map((m) => [m.id, m])),
		[members],
	);

	const filteredAttendance = useMemo(() => {
		const search = memberSearch.trim().toLowerCase();
		return attendance.filter((entry) => {
			const member = entry.member ?? memberMap.get(entry.member_id);
			const entryDate = new Date(entry.checked_in_at);
			const matchesMember = !selectedMemberId || entry.member_id === selectedMemberId;
			const matchesMethod = selectedMethod === 'all' || entry.method === selectedMethod;
			const matchesDate = !selectedDate || getDateKey(entryDate) === selectedDate;
			const matchesSearch = !search
				|| (member?.full_name ?? '').toLowerCase().includes(search)
				|| (member?.email ?? '').toLowerCase().includes(search);
			return matchesMember && matchesMethod && matchesDate && matchesSearch;
		});
	}, [attendance, memberMap, memberSearch, selectedDate, selectedMemberId, selectedMethod]);

	const todayCheckIns = useMemo(() => {
		const todayKey = getDateKey(new Date());
		return attendance.filter((e) => getDateKey(new Date(e.checked_in_at)) === todayKey).length;
	}, [attendance]);

	const weekCheckIns = useMemo(() => {
		const now = new Date();
		const startOfWeek = new Date(now);
		const day = now.getDay();
		startOfWeek.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
		startOfWeek.setHours(0, 0, 0, 0);
		return attendance.filter((e) => new Date(e.checked_in_at) >= startOfWeek).length;
	}, [attendance]);

	const mostActiveMember = useMemo(() => {
		const startOfMonth = new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);
		const counts = new Map<string, number>();
		attendance.forEach((e) => {
			if (new Date(e.checked_in_at) >= startOfMonth) {
				counts.set(e.member_id, (counts.get(e.member_id) ?? 0) + 1);
			}
		});
		const winner = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
		if (!winner) return null;
		return { member: memberMap.get(winner[0]), count: winner[1] };
	}, [attendance, memberMap]);

	const downloadGymQr = async () => {
		if (!gymQrUrl) return;
		try {
			const wrapper = gymQrRef.current;
			if (wrapper) {
				const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
				if (canvas) {
					const link = document.createElement('a');
					link.href = canvas.toDataURL('image/png');
					link.download = 'apex-gym-checkin-qr.png';
					link.click();
					return;
				}
			}
			const dataUrl = await generateDataURL({
				value: gymQrUrl,
				size: 280,
				quietZone: 12,
				fgColor: '#FFFFFF',
				bgColor: '#0A0A0A',
			});
			const link = document.createElement('a');
			link.href = dataUrl;
			link.download = 'apex-gym-checkin-qr.png';
			link.click();
		} catch {
			// ignore
		}
	};

	const copyUrl = async () => {
		if (!gymQrUrl) return;
		try {
			await navigator.clipboard.writeText(gymQrUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// ignore
		}
	};

	return (
		<div
			style={{
				position: 'relative',
				minHeight: '100vh',
				backgroundColor: C.bg,
				fontFamily: "'DM Sans', sans-serif",
				color: C.textPrimary,
				overflow: 'hidden',
			}}
		>
			<style>
				{`
					@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

					@keyframes fadeInUp {
						from { opacity: 0; transform: translateY(16px); }
						to   { opacity: 1; transform: translateY(0); }
					}

					@keyframes orbDrift {
						0%, 100% { opacity: 0.4; transform: scale(1) translateY(0); }
						50%       { opacity: 0.65; transform: scale(1.06) translateY(-12px); }
					}

					@keyframes qrGlow {
						0%, 100% { box-shadow: 0 0 40px rgba(124,58,237,0.2), 0 0 80px rgba(124,58,237,0.08); }
						50%       { box-shadow: 0 0 55px rgba(124,58,237,0.32), 0 0 110px rgba(124,58,237,0.12); }
					}

					@keyframes shimmer {
						0%   { background-position: 200% 0; }
						100% { background-position: -200% 0; }
					}

					@keyframes pulse {
						0%, 100% { opacity: 1; }
						50% { opacity: 0.4; }
					}

					.stat-card {
						transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
					}
					.stat-card:hover {
						transform: translateY(-3px);
						box-shadow: 0 12px 40px rgba(124,58,237,0.15) !important;
						border-color: rgba(124,58,237,0.2) !important;
					}

					.filter-input:focus {
						outline: none;
						border-color: rgba(124,58,237,0.4) !important;
						box-shadow: 0 0 0 3px rgba(124,58,237,0.08) !important;
					}

					.method-btn-active {
						background: rgba(124,58,237,0.12) !important;
						color: #a78bfa !important;
						border-color: rgba(124,58,237,0.25) !important;
					}

					.copy-btn:hover {
						background: rgba(124,58,237,0.15) !important;
						color: #a78bfa !important;
					}

					.download-btn:hover {
						background: rgba(124,58,237,0.2) !important;
						box-shadow: 0 4px 20px rgba(124,58,237,0.2);
					}
				`}
			</style>

			{/* Ambient background orbs */}
			<div
				style={{
					position: 'absolute',
					top: '-5%',
					left: '-8%',
					width: 500,
					height: 500,
					borderRadius: '50%',
					background: 'radial-gradient(circle, rgba(124,58,237,0.09) 0%, transparent 65%)',
					animation: 'orbDrift 9s ease-in-out infinite',
					pointerEvents: 'none',
					zIndex: 0,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					bottom: '-5%',
					right: '-5%',
					width: 380,
					height: 380,
					borderRadius: '50%',
					background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 65%)',
					animation: 'orbDrift 12s ease-in-out infinite reverse',
					pointerEvents: 'none',
					zIndex: 0,
				}}
			/>

			{/* Content wrapper */}
			<div style={{ position: 'relative', zIndex: 1, padding: '32px', maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: 32 }}>
				{/* Page header */}
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', animation: 'fadeInUp 0.4s ease both' }}>
					<div>
						<h1
							style={{
								fontFamily: 'Bebas Neue, serif',
								fontSize: 40,
								letterSpacing: '0.04em',
								color: C.textPrimary,
								margin: 0,
								lineHeight: 1,
							}}
						>
							ATTENDANCE
						</h1>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
							<div
								style={{
									width: 6,
									height: 6,
									borderRadius: '50%',
									background: C.green,
									boxShadow: `0 0 6px ${C.green}`,
									animation: 'pulse 2.5s ease-in-out infinite',
								}}
							/>
							<span style={{ fontSize: 12, color: C.textSecondary, letterSpacing: '0.05em' }}>
								Attendance system operational
							</span>
						</div>
					</div>
				</div>

				{/* QR Centerpiece */}
				<div style={{ animation: 'fadeInUp 0.4s ease 80ms both', position: 'relative' }}>
					{/* Decorative glow */}
					<div
						style={{
							position: 'absolute',
							top: 0,
							right: 0,
							width: 250,
							height: 200,
							background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.2) 0%, transparent 65%)',
							pointerEvents: 'none',
							borderRadius: '20px',
						}}
					/>

					<div
						style={{
							position: 'relative',
							borderRadius: 20,
							border: `1px solid rgba(124,58,237,0.2)`,
							background: `linear-gradient(135deg, rgba(124,58,237,0.1) 0%, rgba(10,10,18,0.95) 40%, rgba(124,58,237,0.04) 100%)`,
							padding: 40,
							animation: 'qrGlow 6s ease-in-out infinite',
							overflow: 'hidden',
						}}
					>
						{/* Section label */}
						<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
							<span style={{ fontSize: 14, color: C.accent }}>⬡</span>
							<span
								style={{
									fontSize: 11,
									letterSpacing: '0.25em',
									textTransform: 'uppercase',
									color: C.accent,
									fontWeight: 600,
								}}
							>
								GYM ENTRANCE TERMINAL
							</span>
						</div>

						{/* Content layout */}
						<div style={{ display: 'flex', gap: 48, alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
							{/* LEFT — QR Display */}
							<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
								{/* QR Frame */}
								<div
									style={{
										position: 'relative',
										padding: 3,
										borderRadius: 16,
										background: `linear-gradient(135deg, rgba(124,58,237,0.5), rgba(124,58,237,0.1), rgba(124,58,237,0.4))`,
										boxShadow: `0 0 60px rgba(124,58,237,0.3), 0 20px 60px rgba(0,0,0,0.5)`,
									}}
								>
									{/* QR Inner */}
									<div
										id="gym-qr-code"
										ref={gymQrRef}
										style={{
											background: 'white',
											borderRadius: 14,
											padding: 16,
										}}
									>
										{gymQrLoading ? (
											<div
												style={{
													width: 200,
													height: 200,
													background: `linear-gradient(90deg, ${C.surface}, ${C.surfaceHover}, ${C.surface})`,
													backgroundSize: '200% 100%',
													animation: 'shimmer 2s infinite',
													borderRadius: 8,
												}}
											/>
										) : gymQrError && !gymQrUrl ? (
											<div
												style={{
													width: 200,
													height: 200,
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													fontSize: 13,
													color: '#ef4444',
													textAlign: 'center',
													padding: 16,
												}}
											>
												{gymQrError}
											</div>
										) : gymQrUrl ? (
											<QRCode value={gymQrUrl} size={200} bgColor="#ffffff" fgColor="#0d0d14" qrStyle="dots" />
										) : (
											<div
												style={{
													width: 200,
													height: 200,
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													fontSize: 13,
													color: C.textSecondary,
												}}
											>
												No URL configured
											</div>
										)}
									</div>
								</div>

								{/* Download button */}
								<button
									type="button"
									onClick={downloadGymQr}
									disabled={!gymQrUrl || gymQrLoading}
									className="download-btn"
									style={{
										marginTop: 16,
										width: '100%',
										background: 'rgba(124,58,237,0.12)',
										border: `1px solid rgba(124,58,237,0.25)`,
										borderRadius: 10,
										padding: '10px 20px',
										fontSize: 13,
										color: C.accent,
										cursor: gymQrUrl && !gymQrLoading ? 'pointer' : 'not-allowed',
										fontWeight: 500,
										transition: 'all 0.2s',
										opacity: !gymQrUrl || gymQrLoading ? 0.5 : 1,
									}}
								>
									↓ Download QR
								</button>
							</div>

							{/* RIGHT — Instructions + URL */}
							<div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
								<div
									style={{
										fontFamily: 'Bebas Neue, serif',
										fontSize: 28,
										color: C.textPrimary,
										letterSpacing: '0.04em',
										margin: 0,
									}}
								>
									SCAN TO CHECK IN
								</div>

								{/* Steps */}
								<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
									{[
										'Print this QR and place it at your gym entrance',
										'Members open their phone camera and scan',
										'They land on the check-in page automatically',
										'Attendance is recorded instantly — no hardware needed',
									].map((step, idx) => (
										<div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
											<div
												style={{
													width: 24,
													height: 24,
													borderRadius: '50%',
													background: 'rgba(124,58,237,0.12)',
													border: `1px solid rgba(124,58,237,0.25)`,
													display: 'flex',
													alignItems: 'center',
													justifyContent: 'center',
													fontSize: 11,
													color: C.accent,
													fontWeight: 600,
													flexShrink: 0,
													marginTop: 1,
												}}
											>
												{idx + 1}
											</div>
											<span style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.5, fontWeight: 300 }}>
												{step}
											</span>
										</div>
									))}
								</div>

								{/* URL Section */}
								<div style={{ marginTop: 24 }}>
									<div
										style={{
											fontSize: 10,
											letterSpacing: '0.2em',
											color: C.textMuted,
											textTransform: 'uppercase',
											marginBottom: 8,
										}}
									>
										CHECK-IN URL
									</div>
									<div style={{ display: 'flex', gap: 10 }}>
										<div
											style={{
												flex: 1,
												overflow: 'hidden',
												background: 'rgba(0,0,0,0.3)',
												border: `1px solid ${C.border}`,
												borderRadius: 8,
												padding: '10px 14px',
												fontFamily: 'monospace',
												fontSize: 12,
												color: C.textSecondary,
												whiteSpace: 'nowrap',
												textOverflow: 'ellipsis',
											}}
										>
											{gymQrUrl || '—'}
										</div>
										<button
											type="button"
											onClick={copyUrl}
											className="copy-btn"
											style={{
												background: C.glass,
												border: `1px solid ${C.border}`,
												borderRadius: 8,
												padding: '10px 16px',
												fontSize: 12,
												color: C.textSecondary,
												cursor: 'pointer',
												transition: 'all 0.2s',
												flexShrink: 0,
											}}
										>
											{copied ? '✓ Copied' : 'Copy'}
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Stats row */}
				<div style={{ animation: 'fadeInUp 0.4s ease 160ms both', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
					{[
						{ label: "TODAY'S CHECK-INS", value: todayCheckIns, supporting: 'members checked in today' },
						{ label: 'THIS WEEK', value: weekCheckIns, supporting: 'check-ins since Monday' },
						{
							label: 'MOST ACTIVE · THIS MONTH',
							value: mostActiveMember?.member?.full_name ?? '—',
							supporting: mostActiveMember ? `${mostActiveMember.count} check-ins this month` : 'No records yet',
							isName: true,
						},
					].map((card, idx) => (
						<div
							key={idx}
							className="stat-card"
							style={{
								background: C.glass,
								backdropFilter: 'blur(8px)',
								border: `1px solid ${C.border}`,
								borderRadius: 16,
								padding: '24px 28px',
								position: 'relative',
								overflow: 'hidden',
								cursor: 'default',
							}}
						>
							{/* Bottom accent line */}
							<div
								style={{
									position: 'absolute',
									bottom: 0,
									left: 0,
									right: 0,
									height: 2,
									background: 'linear-gradient(90deg, transparent, #7c3aed, transparent)',
									opacity: 0.4,
								}}
							/>
							<div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.textMuted, marginBottom: 12 }}>
								{card.label}
							</div>
							<div
								style={{
									fontFamily: card.isName ? 'DM Sans, sans-serif' : 'Bebas Neue, serif',
									fontSize: card.isName ? 24 : 48,
									lineHeight: 1,
									color: C.textPrimary,
									letterSpacing: '0.02em',
									fontWeight: card.isName ? 600 : 400,
								}}
							>
								{card.value}
							</div>
							<div style={{ fontSize: 12, color: C.textSecondary, marginTop: 6, fontWeight: 300 }}>
								{card.supporting}
							</div>
						</div>
					))}
				</div>

				{/* Filters section */}
				<div style={{ animation: 'fadeInUp 0.4s ease 240ms both', background: C.glass, backdropFilter: 'blur(8px)', border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
					{/* Input row */}
					<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
						{/* Search Input */}
						<div style={{ position: 'relative' }}>
							<Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: C.textSecondary, pointerEvents: 'none' }} />
							<input
								type="text"
								value={memberSearch}
								onChange={(e) => setMemberSearch(e.target.value)}
								placeholder="Search member..."
								className="filter-input"
								style={{
									width: '100%',
									background: 'rgba(0,0,0,0.3)',
									border: `1px solid ${C.border}`,
									borderRadius: 10,
									padding: '10px 14px 10px 40px',
									fontSize: 13,
									color: C.textPrimary,
									fontFamily: 'DM Sans',
									transition: 'border-color 0.2s, box-shadow 0.2s',
								}}
							/>
						</div>

						{/* Member Select */}
						<select
							value={selectedMemberId}
							onChange={(e) => setSelectedMemberId(e.target.value)}
							className="filter-input"
							style={{
								background: 'rgba(0,0,0,0.3)',
								border: `1px solid ${C.border}`,
								borderRadius: 10,
								padding: '10px 14px',
								fontSize: 13,
								color: C.textPrimary,
								fontFamily: 'DM Sans',
								transition: 'border-color 0.2s, box-shadow 0.2s',
							}}
						>
							<option value="">All members</option>
							{members.map((m) => (
								<option key={m.id} value={m.id}>{m.full_name}</option>
							))}
						</select>

						{/* Date Input */}
						<input
							type="date"
							value={selectedDate}
							onChange={(e) => setSelectedDate(e.target.value)}
							className="filter-input"
							style={{
								background: 'rgba(0,0,0,0.3)',
								border: `1px solid ${C.border}`,
								borderRadius: 10,
								padding: '10px 14px',
								fontSize: 13,
								color: C.textPrimary,
								fontFamily: 'DM Sans',
								transition: 'border-color 0.2s, box-shadow 0.2s',
							}}
						/>
					</div>

					{/* Method filter buttons */}
					<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						{(['all', 'qr', 'pin'] as const).map((method) => (
							<button
								key={method}
								type="button"
								onClick={() => setSelectedMethod(method)}
								className={selectedMethod === method ? 'method-btn-active' : ''}
								style={{
									background: selectedMethod === method ? 'rgba(124,58,237,0.12)' : 'transparent',
									border: `1px solid ${selectedMethod === method ? 'rgba(124,58,237,0.25)' : C.border}`,
									borderRadius: 8,
									padding: '8px 18px',
									fontSize: 12,
									letterSpacing: '0.08em',
									textTransform: 'uppercase',
									color: selectedMethod === method ? C.accent : C.textSecondary,
									cursor: 'pointer',
									transition: 'all 0.2s',
									fontWeight: selectedMethod === method ? 600 : 400,
								}}
							>
								{method}
							</button>
						))}
					</div>
				</div>

				{/* Error message */}
				{error && (
					<div style={{ animation: 'fadeInUp 0.4s ease 320ms both', background: C.glass, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 28px', color: C.textSecondary, fontSize: 14 }}>
						{error}
					</div>
				)}

				{/* Attendance log table */}
				<div style={{ animation: 'fadeInUp 0.4s ease 400ms both', background: C.glass, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
					<AttendanceLog logs={filteredAttendance} isLoading={loading} showMemberName={true} />
				</div>
			</div>
		</div>
	);
}