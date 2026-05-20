"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import api from '@/lib/api';
import { siteConfig } from '@/lib/config';

function getErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response
  ) {
    const data = error.response.data as { detail?: unknown; message?: unknown };

    if (typeof data.detail === 'string') {
      return data.detail;
    }

    if (typeof data.message === 'string') {
      return data.message;
    }
  }

  return 'Registration failed. Please try again.';
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get('plan_id');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/register', {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        role: 'gym_member',
      });

      setSuccessMessage('Account created! Redirecting...');

      window.setTimeout(() => {
        if (planId) {
          router.push(`/member/dashboard?plan_id=${planId}`);
        } else {
          router.push('/member/dashboard');
        }
      }, 2000);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);

    try {
      const response = await api.get<{ url?: string; redirect_url?: string }>('/auth/google/url/');
      const redirectUrl = response.data?.url ?? response.data?.redirect_url;

      if (!redirectUrl) {
        throw new Error('Missing Google sign in URL');
      }

      window.location.href = redirectUrl;
    } catch {
      setError('Google sign in failed. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  return (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
    {/* Background Image */}
    <div
      className="
        absolute
        inset-0
        bg-cover
        bg-no-repeat
        scale-[1.03]
        blur-[3px]
        brightness-[0.38]
        saturate-[0.9]

        bg-[position:72%_center]

        md:bg-center
      "
      style={{
        backgroundImage: `url('${siteConfig.hero.backgroundImage}')`,
      }}
    />

    {/* Cinematic Overlay */}
    <div
      className="
        absolute
        inset-0
        bg-gradient-to-b
        from-black/50
        via-[#05010F]/60
        to-[#05010F]/90
      "
    />

    {/* Purple Ambient Glow */}
    <div className="pointer-events-none absolute inset-0">
      <div
        className="
          absolute
          left-[-120px]
          top-[10%]
          h-[320px]
          w-[320px]
          rounded-full
          bg-purple-600/15
          blur-3xl
        "
      />

      <div
        className="
          absolute
          bottom-[5%]
          right-[-100px]
          h-[280px]
          w-[280px]
          rounded-full
          bg-violet-500/15
          blur-3xl
        "
      />
    </div>

    {/* Form Container */}
    <div className="relative z-20 w-full max-w-md px-6">
      <div
        className="
          rounded-[32px]
          border
          border-white/10
          bg-black/30
          p-8
          shadow-[0_10px_60px_rgba(0,0,0,0.55)]
          backdrop-blur-2xl
        "
      >
        {/* Logo + Heading */}
        <div className="mb-8 text-center">
          <h1
            className="
              font-clash
              text-4xl
              font-bold
              uppercase
              tracking-tight
              text-transparent
              bg-gradient-to-r
              from-purple-200
              via-violet-400
              to-purple-600
              bg-clip-text
            "
          >
            {siteConfig.brand.name}
          </h1>

          <p className="mt-3 text-sm text-white/60">
            Join the next generation of elite transformation.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
          noValidate
        >
          {error ? (
            <p className="text-sm text-red-400">
              {error}
            </p>
          ) : null}

          {successMessage ? (
            <p className="text-sm text-purple-300">
              {successMessage}
            </p>
          ) : null}

          {/* Inputs */}
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(event) =>
              setFullName(event.target.value)
            }
            className="
              w-full
              rounded-2xl
              border
              border-white/10
              bg-white/[0.04]
              px-4
              py-3
              text-white
              placeholder:text-white/35
              outline-none
              transition-all
              duration-300

              focus:border-purple-500/50
              focus:bg-white/[0.06]
              focus:shadow-[0_0_20px_rgba(139,92,246,0.15)]
            "
            required
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            className="
              w-full
              rounded-2xl
              border
              border-white/10
              bg-white/[0.04]
              px-4
              py-3
              text-white
              placeholder:text-white/35
              outline-none
              transition-all
              duration-300

              focus:border-purple-500/50
              focus:bg-white/[0.06]
              focus:shadow-[0_0_20px_rgba(139,92,246,0.15)]
            "
            required
          />

          <input
            type="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(event) =>
              setPhone(event.target.value)
            }
            className="
              w-full
              rounded-2xl
              border
              border-white/10
              bg-white/[0.04]
              px-4
              py-3
              text-white
              placeholder:text-white/35
              outline-none
              transition-all
              duration-300

              focus:border-purple-500/50
              focus:bg-white/[0.06]
              focus:shadow-[0_0_20px_rgba(139,92,246,0.15)]
            "
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            className="
              w-full
              rounded-2xl
              border
              border-white/10
              bg-white/[0.04]
              px-4
              py-3
              text-white
              placeholder:text-white/35
              outline-none
              transition-all
              duration-300

              focus:border-purple-500/50
              focus:bg-white/[0.06]
              focus:shadow-[0_0_20px_rgba(139,92,246,0.15)]
            "
            required
          />

          <input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            className="
              w-full
              rounded-2xl
              border
              border-white/10
              bg-white/[0.04]
              px-4
              py-3
              text-white
              placeholder:text-white/35
              outline-none
              transition-all
              duration-300

              focus:border-purple-500/50
              focus:bg-white/[0.06]
              focus:shadow-[0_0_20px_rgba(139,92,246,0.15)]
            "
            required
          />

          {/* Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="
              group
              relative
              mt-2
              flex
              w-full
              items-center
              justify-center
              overflow-hidden
              rounded-2xl
              border
              border-purple-400/20
              bg-gradient-to-r
              from-purple-600
              via-violet-500
              to-indigo-500
              px-6
              py-3.5
              font-semibold
              text-white
              shadow-[0_10px_40px_rgba(139,92,246,0.25)]
              transition-all
              duration-300

              hover:-translate-y-1
              hover:scale-[1.01]

              disabled:cursor-not-allowed
              disabled:opacity-70
            "
          >
            <span
              className="
                absolute
                inset-0
                opacity-0
                transition-opacity
                duration-300
                group-hover:opacity-100
                bg-gradient-to-r
                from-white/10
                to-transparent
              "
            />

            {isLoading ? (
              <svg
                className="relative z-10 h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />

                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : null}

            <span className="relative z-10">
              {isLoading
                ? "Creating account..."
                : "Create Account"}
            </span>
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading || isGoogleLoading}
          style={{
            width: '100%',
            padding: '13px 20px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            cursor: isLoading || isGoogleLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: '#f1f5f9',
            fontSize: 14,
            fontWeight: 500,
            transition: 'all 0.2s',
            opacity: isLoading || isGoogleLoading ? 0.7 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-white/45">
          Already have an account?{" "}
          <Link
            href="/login"
            className="
              text-purple-300
              transition-colors
              hover:text-white
            "
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterPageContent />
    </Suspense>
  );
}
