"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { siteConfig } from "@/lib/config";

export default function HeroSection() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  function splitHeadline(text: string) {
    if (!text) return [text, ""];

    const mid = Math.floor(text.length / 2);

    let left = text.lastIndexOf(" ", mid);

    if (left === -1) {
      left = text.indexOf(" ", mid);
    }

    if (left === -1) {
      return [text, ""];
    }

    const first = text.slice(0, left).trim();
    const second = text.slice(left).trim();

    return [first, second];
  }

  const [firstLine, secondLine] = splitHeadline(
    siteConfig.hero.headline || ""
  );

  return (
    <section
      id="hero"
      className="relative min-h-screen overflow-hidden"
    >
      {/* Background Image */}
      <div
        className="
          absolute
          inset-0
          bg-cover
          bg-[position:0%_center]
          sm:bg-[position:12%_center]
          scale-[1.03]
          blur-[3px]
          brightness-[0.38]
          saturate-[0.85]
        "
        style={{
          backgroundImage: `url(${siteConfig.hero.backgroundImage})`,
        }}
        aria-hidden
      />

      {/* Cinematic Overlay */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-b
          from-black/50
          via-[#070010]/55
          to-[#05010F]/90
        "
      />

      {/* Ambient Purple Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="
            absolute
            left-[-120px]
            top-[10%]
            h-[420px]
            w-[420px]
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
            h-[380px]
            w-[380px]
            rounded-full
            bg-purple-600/10
            blur-3xl
          "
        />
      </div>

      {/* Center Atmospheric Focus */}
      <div
        className="
          absolute
          left-1/2
          top-1/2
          h-[520px]
          w-[920px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-black/40
          blur-3xl
          opacity-90
          pointer-events-none
        "
        aria-hidden
      />

      {/* Hero Content */}
      <div
        className={`
          relative
          z-20
          flex
          min-h-screen
          flex-col
          items-center
          justify-center
          px-6
          text-center
          transition-all
          duration-700
          ease-out
          ${
            visible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0"
          }
        `}
      >
        <div className="relative max-w-6xl">
          {/* Headline */}
          <h1 className="font-clash uppercase leading-[0.88]">
            <span
              className="
                block
                text-4xl
                sm:text-4xl
                md:text-6xl
                lg:text-[5.5rem]
                font-medium
                tracking-[-0.05em]
                text-white/75
              "
            >
              {firstLine}
            </span>

            <span
              className="
                mt-3
                block
                bg-gradient-to-r
                from-[#F5EEFF]
                via-[#C084FC]
                to-[#7C3AED]
                bg-clip-text
                text-transparent
                text-5xl
                sm:text-6xl
                md:text-7xl
                lg:text-[7rem]
                font-black
                tracking-[-0.06em]
                drop-shadow-[0_10px_40px_rgba(139,92,246,0.35)]
              "
            >
              {secondLine}
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="
              mx-auto
              mt-8
              max-w-2xl
              text-lg
              leading-relaxed
              text-white/65
              md:text-xl
            "
          >
            {siteConfig.hero.subheadline}
          </p>

          {/* CTA */}
          <div className="mt-12 flex justify-center">
            <Link
              href={siteConfig.hero.ctaLink}
              className="
                group
                relative
                inline-flex
                items-center
                justify-center
                overflow-hidden
                rounded-full
                border
                border-purple-400/20
                bg-gradient-to-r
                from-[#7C3AED]
                via-[#8B5CF6]
                to-[#6D28D9]
                px-10
                py-4
                text-lg
                font-semibold
                text-white
                shadow-[0_10px_50px_rgba(139,92,246,0.35)]
                transition-all
                duration-300
                hover:-translate-y-1
                hover:scale-[1.02]
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

              <span className="relative z-10">
                {siteConfig.hero.ctaText}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <a
        href="#gallery"
        className="
          absolute
          bottom-8
          left-1/2
          z-30
          -translate-x-1/2
          text-white/50
          transition-all
          duration-300
          hover:text-white
          hover:translate-y-1
        "
      >
        <svg
          className="h-8 w-8 animate-bounce"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 5v14M5 12l7 7 7-7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </section>
  );
}