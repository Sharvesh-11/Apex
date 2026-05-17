"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Phone, Star, Check } from 'lucide-react';

import api, { post } from '@/lib/api';
import { siteConfig } from '@/lib/config';
import useAuthStore from '@/store/authStore';
import type { Plan } from '@/types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PricingSection() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Color constants (inline styles only)
  const C = {
    bg: '#050508',
    surface: '#0a0a12',
    glass: 'rgba(255,255,255,0.03)',
    border: 'rgba(255,255,255,0.07)',
    borderHover: 'rgba(124,58,237,0.6)',
    primary: '#7c3aed',
    primaryGlow: 'rgba(124,58,237,0.35)',
    accent: '#a78bfa',
    gold: '#f59e0b',
    textPrimary: '#f1f5f9',
    textSecondary: '#475569',
    textMuted: '#1e293b',
  } as const;

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // fetch plans (preserve existing logic)
  useEffect(() => {
    let mounted = true;

    void (async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await api.get<Plan[]>('/plans');
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

  // Load Razorpay script once on mount (preserve)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).Razorpay) return;

    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // keep script
    };
  }, []);

  const handleRazorpayInitiate = async (plan: Plan) => {
    // Not authenticated -> redirect to register with plan_id
    if (!user) {
      router.push(`/register?plan_id=${plan.id}`);
      return;
    }

    // Owners/admins cannot purchase plans
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

  // UI helpers
  const gridTemplateColumns = isMobile ? '1fr' : 'repeat(3, 1fr)';
  const popularIndex = Math.floor(plans.length / 2);

  // Skeleton card renderer
  const SkeletonCard = ({ index }: { index?: number }) => {
    const isMiddle = index === 1;
    return (
      <div style={{ height: isMiddle ? 460 : 420, borderRadius: 24, background: `linear-gradient(90deg, ${C.surface} 25%, rgba(124,58,237,0.06) 50%, ${C.surface} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite' }} />
    );
  };

  // Contact fallback
  const ContactFallback = ({ hasErrorProp }: { hasErrorProp: boolean }) => (
    <div style={{ textAlign: 'center', marginTop: 40, color: C.textSecondary }}>
      <div style={{ fontSize: 16 }}>{hasErrorProp ? 'Contact us for membership pricing' : 'Membership plans coming soon. Contact us to join.'}</div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
        <a href={`tel:${siteConfig.contact.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 999, border: `1px solid ${C.border}`, color: C.textSecondary, textDecoration: 'none' }}>
          <Phone />
          <span>{siteConfig.contact.phone}</span>
        </a>

        <a href={siteConfig.contact.whatsapp} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 999, border: 'none', background: C.primary, color: '#fff', textDecoration: 'none' }}>
          <ExternalLink />
          <span>WhatsApp</span>
        </a>
      </div>
    </div>
  );

  return (
    <section id="pricing" style={{ position: 'relative', overflow: 'hidden', backgroundColor: C.bg, padding: '120px 24px' }}>
      {/* CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatGlow { 0%,100% { box-shadow: 0 0 40px rgba(124,58,237,0.3), 0 0 80px rgba(124,58,237,0.1); } 50% { box-shadow: 0 0 60px rgba(124,58,237,0.5), 0 0 120px rgba(124,58,237,0.2); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes orbPulse { 0%,100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.15); opacity: 0.7; } }

        .pricing-card { transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease, border-color 0.3s ease; }
        .pricing-card:hover { transform: translateY(-8px) !important; }
        .pricing-card-normal:hover { box-shadow: 0 20px 60px rgba(124,58,237,0.2) !important; border-color: rgba(124,58,237,0.4) !important; }
        .join-btn { transition: all 0.25s ease; }
        .join-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .join-btn-outline:hover { background: rgba(124,58,237,0.15) !important; border-color: rgba(124,58,237,0.6) !important; color: #a78bfa !important; }
      `}</style>

      {/* Ambient orbs and center line */}
      <div style={{ position: 'absolute', top: '10%', left: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0, animation: 'orbPulse 6s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 65%)', pointerEvents: 'none', zIndex: 0, animation: 'orbPulse 8s ease-in-out infinite reverse' }} />
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.15), transparent)', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
        {/* Header */}
        <div style={{ maxWidth: 600, margin: '0 auto 80px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 999, padding: '8px 20px', fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.accent, marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: C.primary, boxShadow: `0 0 8px ${C.primary}` }} />
            <span>MEMBERSHIP TIERS</span>
          </div>

          <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 'clamp(52px, 8vw, 80px)', lineHeight: 0.95, letterSpacing: '0.03em', margin: '0 0 20px' }}>
            <span style={{ display: 'block', color: C.textSecondary, fontSize: '0.6em' }}>CHOOSE YOUR</span>
            <span style={{ display: 'block', background: `linear-gradient(135deg, #ffffff 0%, ${C.accent} 60%, ${C.primary} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>EVOLUTION</span>
          </h2>

          <p style={{ fontSize: 15, color: C.textSecondary, lineHeight: 1.7, fontWeight: 300, margin: 0 }}>
            Each tier unlocks a new stage of your transformation. Commit to the level that matches your ambition.
          </p>
        </div>

        {/* Plans grid */}
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns, gap: 24 }}>
          {isLoading ? (
            // skeletons
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ animation: 'fadeInUp 0.6s ease both', animationDelay: `${i * 120}ms` }}>
                <SkeletonCard index={i} />
              </div>
            ))
          ) : hasError || plans.length === 0 ? (
            <>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ animation: 'fadeInUp 0.6s ease both', animationDelay: `${i * 120}ms` }}>
                  <SkeletonCard index={i} />
                </div>
              ))}
              <ContactFallback hasErrorProp={hasError} />
            </>
          ) : (
            plans
              .slice()
              .sort((a, b) => Number(a.price) - Number(b.price))
              .map((plan, idx) => {
                const index = idx; // 0 cheapest, 1 mid, 2 expensive
                const isFeatured = index === 1;
                const billingLabel = plan.billing_cycle === 'monthly' ? '/mo' : plan.billing_cycle === 'quarterly' ? '/3 mo' : '/yr';

                const wrapperStyle: any = isFeatured
                  ? {
                      marginTop: isMobile ? 0 : -24,
                      position: 'relative',
                    }
                  : { position: 'relative' };

                const cardBaseStyle: any = isFeatured
                  ? {
                      background: 'linear-gradient(160deg, rgba(124,58,237,0.2) 0%, rgba(124,58,237,0.08) 40%, rgba(10,10,18,0.9) 100%)',
                      border: '2px solid rgba(124,58,237,0.5)',
                      borderRadius: 24,
                      padding: 48,
                      position: 'relative',
                      overflow: 'hidden',
                      animation: 'floatGlow 4s ease-in-out infinite',
                    }
                  : {
                      background: C.glass,
                      backdropFilter: 'blur(12px)',
                      border: `1px solid ${C.border}`,
                      borderRadius: 24,
                      padding: isFeatured ? '48px 36px' : '40px 32px',
                      position: 'relative',
                      overflow: 'hidden',
                    };

                const badge = isFeatured ? (
                  <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${C.primary}, #5b21b6)`, borderRadius: 999, padding: '6px 20px', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#fff', fontWeight: 700, boxShadow: `0 4px 20px ${C.primaryGlow}`, whiteSpace: 'nowrap', zIndex: 10 }}>
                    MOST POPULAR
                  </div>
                ) : null;

                const features: string[] =
                  plan.billing_cycle === 'monthly'
                    ? ['Full gym access', 'Locker room', 'Basic classes']
                    : plan.billing_cycle === 'quarterly'
                    ? ['Everything in Stage I', 'Priority booking', 'Progress tracking']
                    : ['Everything in Stage II', 'Personal trainer session', 'Exclusive events'];

                return (
                  <div key={plan.id} style={{ ...wrapperStyle, animation: 'fadeInUp 0.6s ease both', animationDelay: `${index * 120}ms` }}>
                    <div style={cardBaseStyle} className={`pricing-card ${isFeatured ? '' : 'pricing-card-normal'}`}>
                      {badge}

                      {/* decorative inner glow */}
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, background: 'radial-gradient(ellipse at 50% -20%, rgba(124,58,237,0.3) 0%, transparent 70%)', pointerEvents: 'none' }} />

                      {/* Top — Tier identity */}
                      <div>
                        <div style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: isFeatured ? C.accent : C.textSecondary, marginBottom: 12 }}>
                          {index === 0 ? 'STAGE I' : index === 1 ? 'STAGE II' : 'STAGE III'}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isFeatured ? 36 : 30, letterSpacing: '0.05em', color: C.textPrimary, lineHeight: 1, marginBottom: 8 }}>{plan.name}</div>

                          <div style={{ display: 'inline-block', background: isFeatured ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)', border: isFeatured ? '1px solid rgba(124,58,237,0.4)' : `1px solid ${C.border}`, borderRadius: 999, padding: '4px 12px', fontSize: 11, letterSpacing: '0.1em', color: isFeatured ? C.accent : C.textSecondary, textTransform: 'uppercase' }}>
                            {plan.billing_cycle[0].toUpperCase() + plan.billing_cycle.slice(1)}
                          </div>
                        </div>

                        {plan.description ? <div style={{ marginTop: 8, color: C.textSecondary }}>{plan.description}</div> : null}

                        {/* Divider */}
                        <div style={{ height: 1, margin: '28px 0', background: isFeatured ? 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), transparent)' : `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />

                        {/* Price */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, color: isFeatured ? C.accent : C.textSecondary, lineHeight: 1, marginBottom: 8 }}>₹</div>
                          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: isFeatured ? 80 : 64, lineHeight: 0.9, color: C.textPrimary, letterSpacing: '-0.02em' }}>{Number(plan.price).toLocaleString('en-IN')}</div>
                          <div style={{ marginLeft: 8, fontSize: 12, color: C.textSecondary, marginBottom: 12 }}>{billingLabel}</div>
                        </div>

                        {/* savings note */}
                        {plan.billing_cycle === 'quarterly' ? (
                          <div style={{ fontSize: 12, color: C.green, marginTop: 8 }}>Save vs monthly</div>
                        ) : plan.billing_cycle === 'annual' ? (
                          <div style={{ fontSize: 12, color: C.green, marginTop: 8 }}>Best value · 2 months free</div>
                        ) : null}

                        {/* Features */}
                        <div style={{ marginTop: 28, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {features.map((f, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: C.textSecondary }}>
                              <div style={{ width: 6, height: 6, borderRadius: 999, background: isFeatured ? C.primary : C.textMuted, boxShadow: isFeatured ? `0 0 8px ${C.primary}` : 'none', flexShrink: 0 }} />
                              <div>{f}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* CTA */}
                      <div>
                        {isFeatured ? (
                          <button
                            onClick={() => handleRazorpayInitiate(plan)}
                            disabled={processingPlanId === plan.id}
                            className="join-btn"
                            style={{ width: '100%', border: 'none', borderRadius: 12, padding: '16px 32px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase', background: `linear-gradient(135deg, ${C.primary} 0%, #5b21b6 100%)`, boxShadow: `0 8px 32px ${C.primaryGlow}` }}
                          >
                            {processingPlanId === plan.id ? 'Processing...' : 'BEGIN EVOLUTION →'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRazorpayInitiate(plan)}
                            disabled={processingPlanId === plan.id}
                            className="join-btn join-btn-outline"
                            style={{ width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 32px', fontSize: 14, color: C.textSecondary, cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                          >
                            {processingPlanId === plan.id ? 'Processing...' : 'SELECT PLAN →'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </section>
  );
}
