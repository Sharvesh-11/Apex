"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api';
import useAuthStore from '@/store/authStore';
import { siteConfig } from '@/lib/config';
import type { Plan, Subscription } from '@/types';

declare global {
  interface Window { Razorpay: any; }
}

type Member = {
  id: string;
  full_name: string;
  email: string;
};

const C = {
  bg:          '#050508',
  surface:     '#0d0d14',
  glass:       'rgba(255,255,255,0.04)',
  border:      'rgba(255,255,255,0.08)',
  primary:     '#7c3aed',
  primaryGlow: 'rgba(124,58,237,0.4)',
  accent:      '#a78bfa',
  gold:        '#f59e0b',
  green:       '#10b981',
  red:         '#ef4444',
  textPrimary:   '#f8fafc',
  textSecondary: '#64748b',
  textMuted:     '#334155',
};

export default function MemberPayPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [activeSub, setActiveSub] = useState<Subscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [plansData, memberData] = await Promise.all([
          get<Plan[]>('/plans/'),
          get<Member>('/members/me'),
        ]);
        setPlans(plansData ?? []);
        setMember(memberData);

        const subs = await get<Subscription[]>(`/subscriptions/member/${memberData.id}/`);
        const active = (subs ?? []).find(s => s.status === 'active') ?? null;
        setActiveSub(active);
        if (active) {
          const matchedPlan = (plansData ?? []).find(p => p.id === active.plan_id);
          setSelectedPlan(matchedPlan ?? null);
        }
      } catch (err) {
        setError('Failed to load plans. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handlePay = async () => {
    if (!selectedPlan) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await post<any>('/payments/razorpay/initiate', {
        plan_id: selectedPlan.id,
      });

      if (res.already_active) {
        router.push(`/member/dashboard?message=already_active&end_date=${res.end_date}`);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: res.amount * 100,
        currency: 'INR',
        name: siteConfig.brand.name,
        description: selectedPlan.name,
        order_id: res.razorpay_order_id,
        handler: async (response: any) => {
          try {
            await post('/payments/razorpay/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              subscription_id: res.subscription_id,
            });
            router.push('/member/dashboard?payment=success');
          } catch {
            setError('Payment verification failed. Contact support.');
          }
        },
        prefill: { email: user?.email ?? '' },
        theme: { color: C.primary },
        modal: {
          ondismiss: () => setIsProcessing(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to initiate payment. Please try again.');
      setIsProcessing(false);
    }
  };

  const daysLeft = activeSub
    ? Math.ceil((new Date(activeSub.end_date).getTime() - Date.now()) / 86400000)
    : null;

  const cycleLabel = (cycle: string) => {
    if (cycle === 'monthly') return '/ month';
    if (cycle === 'half_yearly') return '/ 6 months';
    if (cycle === 'annual') return '/ year';
    return '';
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .plan-card:hover { border-color: ${C.primary} !important; transform: translateY(-2px); }
        .pay-btn:hover { opacity: 0.9; box-shadow: 0 0 40px ${C.primaryGlow}; }
        .back-btn:hover { color: ${C.textPrimary} !important; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        backgroundColor: C.bg,
        fontFamily: "'DM Sans', sans-serif",
        color: C.textPrimary,
        paddingTop: 80,
        paddingBottom: 80,
      }}>
        {/* Background blob */}
        <div style={{
          position: 'fixed', top: '-10%', right: '-10%',
          width: 500, height: 500, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)`,
          pointerEvents: 'none', zIndex: 0,
        }} />

        <div style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: '0 24px',
          position: 'relative',
          zIndex: 1,
          animation: 'fadeInUp 0.5s ease forwards',
        }}>

          {/* Back button */}
          <button
            className="back-btn"
            onClick={() => router.push('/member/dashboard')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.textSecondary, fontSize: 13, marginBottom: 32,
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: "'DM Sans', sans-serif",
              transition: 'color 0.2s',
            }}
          >
            ← Back to Dashboard
          </button>

          {/* Title */}
          <div style={{ marginBottom: 40 }}>
            <h1 style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 56, lineHeight: 1, margin: 0,
              letterSpacing: '0.03em',
              background: `linear-gradient(135deg, #ffffff, ${C.accent})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {activeSub ? 'Renew Membership' : 'Join Now'}
            </h1>
            <p style={{ color: C.textSecondary, marginTop: 8, fontSize: 14 }}>
              {activeSub
                ? `Your current plan expires in ${daysLeft} days`
                : 'Choose a plan to get started'}
            </p>
          </div>

          {/* Current subscription warning */}
          {activeSub && daysLeft !== null && daysLeft < 30 && (
            <div style={{
              background: `rgba(245,158,11,0.1)`,
              border: `1px solid rgba(245,158,11,0.3)`,
              borderRadius: 12, padding: '16px 20px',
              marginBottom: 24, fontSize: 14,
              color: C.gold,
            }}>
              ⚠️ Your membership expires on {new Date(activeSub.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12, padding: '14px 20px',
              marginBottom: 24, fontSize: 14, color: C.red,
            }}>
              {error}
            </div>
          )}

          {/* Loading */}
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  height: 100, borderRadius: 16,
                  background: `linear-gradient(90deg, ${C.surface} 25%, rgba(124,58,237,0.08) 50%, ${C.surface} 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }} />
              ))}
            </div>
          ) : (
            <>
              {/* Plan cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
                {plans.map((plan, i) => {
                  const isSelected = selectedPlan?.id === plan.id;
                  return (
                    <div
                      key={plan.id}
                      className="plan-card"
                      onClick={() => setSelectedPlan(plan)}
                      style={{
                        background: isSelected
                          ? `linear-gradient(135deg, rgba(124,58,237,0.2), rgba(124,58,237,0.05))`
                          : C.glass,
                        border: `2px solid ${isSelected ? C.primary : C.border}`,
                        borderRadius: 16,
                        padding: '24px 28px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: isSelected ? `0 0 30px ${C.primaryGlow}` : 'none',
                        animation: `fadeInUp 0.5s ease ${i * 80}ms both`,
                      }}
                    >
                      <div>
                        {/* Popular badge */}
                        {i === 1 && (
                          <div style={{
                            display: 'inline-block',
                            background: `rgba(124,58,237,0.2)`,
                            border: `1px solid rgba(124,58,237,0.4)`,
                            borderRadius: 999, padding: '2px 10px',
                            fontSize: 10, letterSpacing: '0.15em',
                            color: C.accent, marginBottom: 10,
                            textTransform: 'uppercase',
                          }}>
                            Most Popular
                          </div>
                        )}
                        <div style={{
                          fontFamily: "'Bebas Neue', cursive",
                          fontSize: 24, letterSpacing: '0.05em',
                          color: C.textPrimary,
                        }}>
                          {plan.name}
                        </div>
                        <div style={{
                          fontSize: 12, color: C.textSecondary,
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                          marginTop: 4,
                        }}>
                          {plan.billing_cycle}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontFamily: "'Bebas Neue', cursive",
                          fontSize: 36, color: isSelected ? C.accent : C.textPrimary,
                          lineHeight: 1,
                        }}>
                          ₹{plan.price.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                          {cycleLabel(plan.billing_cycle)}
                        </div>
                      </div>

                      {/* Selected indicator */}
                      <div style={{
                        width: 20, height: 20,
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? C.primary : C.border}`,
                        background: isSelected ? C.primary : 'transparent',
                        marginLeft: 20,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.2s',
                      }}>
                        {isSelected && (
                          <div style={{
                            width: 8, height: 8,
                            borderRadius: '50%',
                            background: 'white',
                          }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pay button */}
              <button
                className="pay-btn"
                onClick={handlePay}
                disabled={!selectedPlan || isProcessing}
                style={{
                  width: '100%',
                  background: selectedPlan
                    ? `linear-gradient(135deg, ${C.primary}, #5b21b6)`
                    : C.surface,
                  border: 'none',
                  borderRadius: 14,
                  padding: '18px 32px',
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  color: selectedPlan ? 'white' : C.textMuted,
                  cursor: selectedPlan && !isProcessing ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  boxShadow: selectedPlan ? `0 0 30px ${C.primaryGlow}` : 'none',
                  letterSpacing: '0.02em',
                }}
              >
                {isProcessing
                  ? 'Opening Razorpay...'
                  : selectedPlan
                    ? `Pay ₹${selectedPlan.price.toLocaleString('en-IN')} via Razorpay`
                    : 'Select a plan to continue'}
              </button>

              {/* Trust note */}
              <p style={{
                textAlign: 'center',
                fontSize: 12,
                color: C.textMuted,
                marginTop: 16,
              }}>
                🔒 Secured by Razorpay · Cancel anytime
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}