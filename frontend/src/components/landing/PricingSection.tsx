'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { siteConfig } from '@/lib/config';
import useAuthStore from '@/store/authStore';
import api from '@/lib/api';
import type { Plan } from '@/types';

declare global {
	interface Window {
		Razorpay: any;
	}
}

const C = {
	bg: '#050508',
	surface: '#0a0a12',
	glass: 'rgba(255,255,255,0.025)',
	border: 'rgba(255,255,255,0.06)',
	primary: '#7c3aed',
	primaryGlow: 'rgba(124,58,237,0.25)',
	accent: '#a78bfa',
	green: '#10b981',
	textPrimary: '#f1f5f9',
	textSecondary: '#475569',
	textMuted: '#1e293b',
};

export default function PricingSection() {
	const router = useRouter();
	const user = useAuthStore((s) => s.user);
	const role = useAuthStore((s) => s.role);

	const [plans, setPlans] = useState<Plan[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);
	const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const check = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
		check();
		window.addEventListener('resize', check);
		return () => window.removeEventListener('resize', check);
	}, []);

	// Fetch plans
	useEffect(() => {
		let mounted = true;

		void (async () => {
			setIsLoading(true);
			setHasError(false);

			try {
				const response = await api.get<Plan[]>('/plans/');
				if (!mounted) return;
				setPlans(response.data ?? []);
				setIsLoading(false);
			} catch (err) {
				console.error('Failed to load plans', err);
				if (!mounted) return;
				setHasError(true);
				setPlans([]);
				setIsLoading(false);
			}
		})();

		return () => {
			mounted = false;
		};
	}, []);

	// Load Razorpay script
	useEffect(() => {
		if (typeof window === 'undefined') return;
		if ((window as any).Razorpay) return;

		const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
		if (existing) return;

		const script = document.createElement('script');
		script.src = 'https://checkout.razorpay.com/v1/checkout.js';
		script.async = true;
		document.body.appendChild(script);
	}, []);

	const handleRazorpayInitiate = async (plan: Plan) => {
		if (!user) {
			router.push(`/register?plan_id=${plan.id}`);
			return;
		}

		if (role === 'gym_owner' || role === 'admin') {
			window.alert('Please log in as a member to purchase a plan');
			return;
		}

		setProcessingPlanId(plan.id);
		try {
			const initRes = await api.post('/payments/razorpay/initiate/', { plan_id: plan.id });
			const data = initRes.data ?? initRes;

			if (data.already_active) {
				router.push(`/member/dashboard?message=already_active&end_date=${data.end_date}`);
				return;
			}

			const options = {
				key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
				amount: (data.amount ?? 0) * 100,
				currency: 'INR',
				name: siteConfig.brand.name,
				description: data.plan_name,
				order_id: data.razorpay_order_id,
				handler: async function (paymentResponse: any) {
					try {
							await api.post('/payments/razorpay/verify/', {
							razorpay_order_id: paymentResponse.razorpay_order_id,
							razorpay_payment_id: paymentResponse.razorpay_payment_id,
							razorpay_signature: paymentResponse.razorpay_signature,
							subscription_id: data.subscription_id,
							payment_id: data.payment_id,
						});

						router.push('/member/dashboard?payment=success');
					} catch (err) {
						console.error('Razorpay verify failed', err);
					}
				},
				prefill: { email: user.email },
				theme: { color: siteConfig.theme.primaryColor },
			} as any;

			const rzp = new window.Razorpay(options);
			rzp.open();
		} catch (err) {
			console.error('Failed to initiate payment', err);
			window.alert('Failed to initiate payment. Please try again.');
		} finally {
			setProcessingPlanId(null);
		}
	};

	const gridTemplateColumns = isMobile ? '1fr' : 'repeat(3, 1fr)';

	return (
		<>
			<style>{`
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(28px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes softGlow {
	0%, 100% {
		box-shadow: 0 0 40px rgba(124,58,237,0.2), 0 0 80px rgba(124,58,237,0.08);
	}
	50% {
		box-shadow: 0 0 50px rgba(124,58,237,0.3), 0 0 100px rgba(124,58,237,0.12);
	}
}

@keyframes shimmer {
	0% {
		background-position: 200% 0;
	}
	100% {
		background-position: -200% 0;
	}
}

@keyframes orbDrift {
	0%, 100% {
		transform: translateY(0px) scale(1);
		opacity: 0.5;
	}
	50% {
		transform: translateY(-20px) scale(1.05);
		opacity: 0.8;
	}
}

.pricing-card {
	transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}

.pricing-card-normal:hover {
	transform: translateY(-4px) !important;
	box-shadow: 0 16px 48px rgba(124,58,237,0.15) !important;
	border-color: rgba(124,58,237,0.25) !important;
}

.pricing-card-featured {
	animation: softGlow 5s ease-in-out infinite;
}

.pricing-card-featured:hover {
	transform: translateY(-6px) !important;
}

.cta-btn {
	transition: all 0.25s ease;
}

.cta-btn:hover {
	transform: translateY(-2px);
	filter: brightness(1.08);
}

.cta-btn-outline:hover {
	background: rgba(124,58,237,0.08) !important;
	border-color: rgba(124,58,237,0.35) !important;
	color: #a78bfa !important;
}
			`}</style>

			<section
				id="pricing"
				style={{
					position: 'relative',
					overflow: 'hidden',
					backgroundColor: C.bg,
					padding: '120px 24px',
				}}
			>
				{/* Center top orb */}
				<div
					style={{
						position: 'absolute',
						top: '-5%',
						left: '50%',
						transform: 'translateX(-50%)',
						width: '700px',
						height: '400px',
						background: `radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 65%)`,
						animation: 'orbDrift 10s ease-in-out infinite',
						pointerEvents: 'none',
						zIndex: 0,
					}}
				/>

				{/* Bottom left orb */}
				<div
					style={{
						position: 'absolute',
						bottom: 0,
						left: '-5%',
						width: '400px',
						height: '400px',
						borderRadius: '50%',
						background: `radial-gradient(circle, rgba(124,58,237,0.05) 0%, transparent 65%)`,
						pointerEvents: 'none',
						zIndex: 0,
					}}
				/>

				{/* Content */}
				<div
					style={{
						position: 'relative',
						zIndex: 1,
						maxWidth: '1100px',
						margin: '0 auto',
					}}
				>
					{/* Header */}
					<div
						style={{
							textAlign: 'center',
							marginBottom: '80px',
						}}
					>
						{/* Eyebrow */}
						<div
							style={{
								display: 'inline-flex',
								alignItems: 'center',
								gap: '10px',
								background: `rgba(124,58,237,0.08)`,
								border: `1px solid rgba(124,58,237,0.2)`,
								borderRadius: '999px',
								padding: '8px 20px',
								fontSize: '11px',
								letterSpacing: '0.25em',
								textTransform: 'uppercase',
								color: C.accent,
								marginBottom: '24px',
							}}
						>
							<div
								style={{
									width: '6px',
									height: '6px',
									borderRadius: '50%',
									background: C.primary,
									boxShadow: `0 0 6px ${C.primary}`,
								}}
							/>
							<span>MEMBERSHIP TIERS</span>
						</div>

						{/* Heading */}
						<h2
							style={{
								fontFamily: "'Bebas Neue', cursive",
								fontSize: 'clamp(48px, 7vw, 72px)',
								lineHeight: 0.95,
								letterSpacing: '0.03em',
								margin: '0 0 20px',
								color: C.textPrimary,
							}}
						>
							<span
								style={{
									display: 'block',
									color: C.textSecondary,
									fontSize: '0.55em',
									marginBottom: '8px',
								}}
							>
								CHOOSE YOUR
							</span>
							<span
								style={{
									background: `linear-gradient(135deg, #ffffff 0%, ${C.accent} 70%)`,
									WebkitBackgroundClip: 'text',
									WebkitTextFillColor: 'transparent',
									display: 'block',
								}}
							>
								EVOLUTION
							</span>
						</h2>

						{/* Subtitle */}
						<p
							style={{
								fontSize: '15px',
								color: C.textSecondary,
								fontWeight: 300,
								lineHeight: 1.7,
								maxWidth: '520px',
								margin: '0 auto',
							}}
						>
							Select the tier that matches your commitment. <br /> Every plan includes full access to our facilities.
						</p>
					</div>

					{/* Cards grid */}
					<div
						style={{
							display: 'grid',
							gridTemplateColumns,
							gap: '20px',
							alignItems: 'center',
						}}
					>
						{isLoading
							? Array.from({ length: 3 }).map((_, i) => (
									<div key={i}>
										<div
											style={{
												height: i === 1 ? '420px' : '380px',
												borderRadius: '20px',
												background: `linear-gradient(90deg, ${C.surface} 25%, rgba(124,58,237,0.06) 50%, ${C.surface} 75%)`,
												backgroundSize: '200% 100%',
												animation: 'shimmer 1.8s infinite',
											}}
										/>
									</div>
							  ))
							: hasError || plans.length === 0
							? (
									<div
										style={{
											gridColumn: '1 / -1',
											textAlign: 'center',
											padding: '80px 24px',
										}}
									>
										<div
											style={{
												display: 'grid',
												gridTemplateColumns,
												gap: '20px',
												marginBottom: '40px',
											}}
										>
											{Array.from({ length: 3 }).map((_, i) => (
												<div key={i}>
													<div
														style={{
															height: i === 1 ? '420px' : '380px',
															borderRadius: '20px',
															background: `linear-gradient(90deg, ${C.surface} 25%, rgba(124,58,237,0.06) 50%, ${C.surface} 75%)`,
															backgroundSize: '200% 100%',
															animation: 'shimmer 1.8s infinite',
														}}
													/>
												</div>
											))}
										</div>
										<p
											style={{
												fontSize: '14px',
												color: C.textSecondary,
												margin: 0,
											}}
										>
											Contact us for membership options
										</p>
										<div
											style={{
												display: 'flex',
												gap: '12px',
												justifyContent: 'center',
												marginTop: '16px',
											}}
										>
											<a
												href={`tel:${siteConfig.contact.phone}`}
												style={{
													border: `1px solid ${C.border}`,
													borderRadius: '999px',
													padding: '12px 24px',
													color: C.textSecondary,
													textDecoration: 'none',
													fontSize: '13px',
													fontWeight: 500,
												}}
											>
												{siteConfig.contact.phone}
											</a>
											<a
												href={siteConfig.contact.whatsapp}
												target="_blank"
												rel="noreferrer"
												style={{
													background: C.primary,
													border: 'none',
													borderRadius: '999px',
													padding: '12px 24px',
													color: '#fff',
													textDecoration: 'none',
													fontSize: '13px',
													fontWeight: 500,
												}}
											>
												WhatsApp
											</a>
										</div>
									</div>
							  )
							: plans
									.slice()
									.sort((a, b) => Number(a.price) - Number(b.price))
									.map((plan, idx) => {
										const index = idx;
										const isFeatured = index === 1;
										const billingLabel =
											plan.billing_cycle === 'monthly' ? '/ mo' : plan.billing_cycle === 'quarterly' ? '/ 3 mo' : '/ yr';

										const stageLabel = index === 0 ? 'STAGE I' : index === 1 ? 'STAGE II' : 'STAGE III';
										const features: string[] =
											index === 0
												? ['Full gym access', 'Locker room included', 'Group classes']
												: index === 1
												? ['Everything in Stage I', 'Priority scheduling', 'Progress tracking']
												: ['Everything in Stage II', '1 trainer session/month', 'Exclusive member events'];

										return (
											<div
												key={plan.id}
												style={{
													position: 'relative',
													marginTop: isFeatured && !isMobile ? '-20px' : 0,
													animation: `fadeInUp 0.55s ease both`,
													animationDelay: `${index * 100}ms`,
												}}
											>
												{/* Recommended label */}
												{isFeatured && (
													<div
														style={{
															position: 'absolute',
															top: '-14px',
															left: '50%',
															transform: 'translateX(-50%)',
															background: `linear-gradient(135deg, ${C.primary}, #6d28d9)`,
															borderRadius: '999px',
															padding: '5px 18px',
															fontSize: '10px',
															letterSpacing: '0.2em',
															textTransform: 'uppercase',
															color: '#fff',
															fontWeight: 600,
															boxShadow: `0 4px 16px rgba(124,58,237,0.4)`,
															whiteSpace: 'nowrap',
															zIndex: 10,
														}}
													>
														RECOMMENDED
													</div>
												)}

												{/* Card */}
												<div
													className={`pricing-card ${isFeatured ? 'pricing-card-featured' : 'pricing-card-normal'}`}
													style={{
														background: isFeatured
															? `linear-gradient(160deg, rgba(124,58,237,0.14) 0%, rgba(124,58,237,0.05) 40%, rgba(10,10,18,0.95) 100%)`
															: C.glass,
														backdropFilter: isFeatured ? 'blur(12px)' : 'blur(8px)',
														border: isFeatured ? `1px solid rgba(124,58,237,0.35)` : `1px solid ${C.border}`,
														borderRadius: '20px',
														padding: isFeatured ? '44px 32px' : '36px 28px',
														position: 'relative',
														overflow: 'hidden',
													}}
												>
													{/* Inner glow */}
													{isFeatured && (
														<div
															style={{
																position: 'absolute',
																top: 0,
																left: 0,
																right: 0,
																height: '160px',
																background: `radial-gradient(ellipse at 50% -30%, rgba(124,58,237,0.2) 0%, transparent 70%)`,
																pointerEvents: 'none',
															}}
														/>
													)}

													{/* Stage label */}
													<div
														style={{
															fontSize: '10px',
															letterSpacing: '0.3em',
															textTransform: 'uppercase',
															color: isFeatured ? C.accent : C.textSecondary,
															marginBottom: '10px',
														}}
													>
														{stageLabel}
													</div>

													{/* Plan name */}
													<h3
														style={{
															fontFamily: "'Bebas Neue', cursive",
															fontSize: isFeatured ? '32px' : '26px',
															letterSpacing: '0.05em',
															color: C.textPrimary,
															lineHeight: 1,
															margin: '0 0 10px',
														}}
													>
														{plan.name}
													</h3>

													{/* Billing badge */}
													<div
														style={{
															display: 'inline-block',
															background: isFeatured ? `rgba(124,58,237,0.15)` : `rgba(255,255,255,0.04)`,
															border: isFeatured ? `1px solid rgba(124,58,237,0.3)` : `1px solid ${C.border}`,
															borderRadius: '999px',
															padding: '3px 12px',
															fontSize: '11px',
															letterSpacing: '0.08em',
															color: isFeatured ? C.accent : C.textSecondary,
															textTransform: 'uppercase',
														}}
													>
														{plan.billing_cycle}
													</div>

													{/* Divider */}
													<div
														style={{
															height: '1px',
															margin: '24px 0',
															background: isFeatured
																? `linear-gradient(90deg, transparent, rgba(124,58,237,0.3), transparent)`
																: `linear-gradient(90deg, transparent, ${C.border}, transparent)`,
														}}
													/>

													{/* Price row */}
													<div
														style={{
															display: 'flex',
															alignItems: 'flex-end',
															gap: '4px',
														}}
													>
														<div
															style={{
																fontFamily: "'Bebas Neue', cursive",
																fontSize: '24px',
																color: isFeatured ? C.accent : C.textSecondary,
																lineHeight: 1,
																paddingBottom: '10px',
															}}
														>
															₹
														</div>
														<div
															style={{
																fontFamily: "'Bebas Neue', cursive",
																fontSize: isFeatured ? '72px' : '58px',
																lineHeight: 0.9,
																color: C.textPrimary,
																letterSpacing: '-0.01em',
															}}
														>
															{Number(plan.price).toLocaleString('en-IN')}
														</div>
														<div
															style={{
																fontSize: '12px',
																color: C.textSecondary,
																paddingBottom: '12px',
																paddingLeft: '4px',
															}}
														>
															{billingLabel}
														</div>
													</div>

													{/* Savings note */}
													{plan.billing_cycle === 'quarterly' && (
														<div
															style={{
																fontSize: '12px',
																color: C.green,
																marginTop: '8px',
															}}
														>
															Save compared to monthly
														</div>
													)}
													{plan.billing_cycle === 'annual' && (
														<div
															style={{
																fontSize: '12px',
																color: C.green,
																marginTop: '8px',
															}}
														>
															2 months free · Best value
														</div>
													)}

													{/* Features */}
													<div
														style={{
															marginTop: '24px',
															marginBottom: '28px',
															display: 'flex',
															flexDirection: 'column',
															gap: '10px',
														}}
													>
														{features.map((feature, i) => (
															<div
																key={i}
																style={{
																	display: 'flex',
																	alignItems: 'center',
																	gap: '10px',
																	fontSize: '13px',
																	color: C.textSecondary,
																	fontWeight: 300,
																}}
															>
																<div
																	style={{
																		width: '5px',
																		height: '5px',
																		borderRadius: '50%',
																		background: isFeatured ? C.accent : C.textMuted,
																		boxShadow: isFeatured ? `0 0 6px rgba(167,139,250,0.4)` : 'none',
																		flexShrink: 0,
																	}}
																/>
																<span>{feature}</span>
															</div>
														))}
													</div>

													{/* CTA button */}
													{isFeatured ? (
														<button
															onClick={() => handleRazorpayInitiate(plan)}
															disabled={processingPlanId === plan.id}
															className="cta-btn"
															style={{
																width: '100%',
																padding: '15px 28px',
																background: `linear-gradient(135deg, ${C.primary}, #6d28d9)`,
																border: 'none',
																borderRadius: '10px',
																fontSize: '13px',
																fontWeight: 600,
																letterSpacing: '0.08em',
																textTransform: 'uppercase',
																color: '#fff',
																cursor: 'pointer',
																boxShadow: `0 6px 24px rgba(124,58,237,0.35)`,
															}}
														>
															{processingPlanId === plan.id ? 'Processing...' : 'Begin Your Evolution'}
														</button>
													) : (
														<button
															onClick={() => handleRazorpayInitiate(plan)}
															disabled={processingPlanId === plan.id}
															className="cta-btn cta-btn-outline"
															style={{
																width: '100%',
																padding: '15px 28px',
																background: 'transparent',
																border: `1px solid ${C.border}`,
																borderRadius: '10px',
																fontSize: '13px',
																fontWeight: 500,
																letterSpacing: '0.08em',
																textTransform: 'uppercase',
																color: C.textSecondary,
																cursor: 'pointer',
															}}
														>
															{processingPlanId === plan.id ? 'Processing...' : 'Select Plan'}
														</button>
													)}
												</div>
											</div>
										);
									})}
					</div>
				</div>
			</section>
		</>
	);
}
