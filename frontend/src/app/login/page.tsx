"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import useAuthStore from "@/store/authStore";
import { siteConfig } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();

  const { login, role } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setIsLoading(true);
  try {
    await login(email, password);
    
    // Wait for store to fully update
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const currentRole = useAuthStore.getState().role;
    console.log('Login successful, role:', currentRole);

    // Check for checkin redirect first
    const checkinRedirect = localStorage.getItem('apex_checkin_redirect');
    if (checkinRedirect) {
      localStorage.removeItem('apex_checkin_redirect');
      router.push(checkinRedirect);
      return;
    }

    if (currentRole === 'gym_member') {
      router.push('/member/dashboard');
    } else if (currentRole === 'gym_owner') {
      router.push('/owner/dashboard');
    } else if (currentRole === 'admin') {
      router.push('/admin/dashboard');
    } else {
      console.warn('No role found after login, role was:', currentRole);
      router.push('/');
    }
  } catch (err) {
    setError('Login failed. Please check your credentials.');
  } finally {
    setIsLoading(false);
  }
};

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      const response = await api.get<{ url?: string; redirect_url?: string }>('/auth/google/url');
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      {/* Background Image */}
      <div
        className="
          absolute
          inset-0
          bg-cover
          bg-[position:78%_center]
          sm:bg-[position:70%_center]
          scale-[1.03]
          blur-[3px]
          brightness-[0.35]
          saturate-[0.85]
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
          via-[#070010]/60
          to-[#05010F]/95
        "
      />

      {/* Purple Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="
            absolute
            left-[-100px]
            top-[10%]
            h-[380px]
            w-[380px]
            rounded-full
            bg-violet-500/10
            blur-3xl
          "
        />

        <div
          className="
            absolute
            right-[-100px]
            bottom-[5%]
            h-[340px]
            w-[340px]
            rounded-full
            bg-purple-600/10
            blur-3xl
          "
        />
      </div>

      {/* Atmospheric Center Focus */}
      <div
        className="
          absolute
          left-1/2
          top-1/2
          h-[480px]
          w-[760px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-black/40
          blur-3xl
          opacity-90
          pointer-events-none
        "
      />

      {/* Login Card */}
      <div className="relative z-20 w-full max-w-md">
        <div
          className="
            rounded-[32px]
            border
            border-white/10
            bg-white/[0.03]
            p-8
            backdrop-blur-2xl
            shadow-[0_20px_80px_rgba(0,0,0,0.55)]
          "
        >
          {/* Logo + Brand */}
          <div className="mb-8 text-center">
            <h1
              className="
                font-clash
                text-4xl
                font-black
                uppercase
                tracking-[-0.05em]
                bg-gradient-to-r
                from-white
                via-purple-200
                to-violet-400
                bg-clip-text
                text-transparent
              "
            >
              {siteConfig.brand.name}
            </h1>

            <p className="mt-3 text-sm text-white/50 tracking-wide">
              {siteConfig.brand.tagline}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="
                  rounded-2xl
                  border
                  border-red-500/20
                  bg-red-500/10
                  px-4
                  py-3
                  text-sm
                  text-red-300
                "
              >
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="mb-2 block text-sm text-white/60">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="
                  w-full
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  px-4
                  py-3
                  text-white
                  outline-none
                  transition-all
                  duration-300
                  placeholder:text-white/30
                  focus:border-purple-400/40
                  focus:bg-white/[0.06]
                  focus:shadow-[0_0_30px_rgba(139,92,246,0.18)]
                "
                placeholder="Enter your email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-sm text-white/60">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="
                  w-full
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  px-4
                  py-3
                  text-white
                  outline-none
                  transition-all
                  duration-300
                  placeholder:text-white/30
                  focus:border-purple-400/40
                  focus:bg-white/[0.06]
                  focus:shadow-[0_0_30px_rgba(139,92,246,0.18)]
                "
                placeholder="Enter your password"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                group
                relative
                mt-4
                inline-flex
                w-full
                items-center
                justify-center
                overflow-hidden
                rounded-2xl
                bg-gradient-to-r
                from-[#7C3AED]
                via-[#8B5CF6]
                to-[#6D28D9]
                px-6
                py-3.5
                text-lg
                font-semibold
                text-white
                shadow-[0_10px_50px_rgba(139,92,246,0.35)]
                transition-all
                duration-300
                hover:-translate-y-1
                hover:scale-[1.01]
                disabled:opacity-60
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
              ) : (
                <span className="relative z-10">
                  Sign In
                </span>
              )}
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
        </div>
      </div>
    </div>
  );
}