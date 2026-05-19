interface SiteConfig {
	
	brand: {
		name: string;
		tagline: string;
		logo: string;
	};
	theme: {
		primaryColor: string;
		primaryHover: string;
		accentColor: string;
		accentSoft: string;
		backgroundColor: string;
		backgroundGradient: string;
		surfaceColor: string;
		surfaceGlass: string;
		textPrimary: string;
		textSecondary: string;
		textMuted: string;
		successColor: string;
		warningColor: string;
		dangerColor: string;
		borderColor: string;
		shadowColor: string;
		fontFamily: string;
		borderRadius: string;
		transition: string;
	};
	hero: {
		headline: string;
		subheadline: string;
		ctaText: string;
		ctaLink: string;
		backgroundImage: string;
	};
	about: {
		title: string;
		description: string;
		features: string[];
	};
	contact: {
		address: string;
		phone: string;
		email: string;
		instagram: string;
		whatsapp: string;
	};
	seo: {
		title: string;
		description: string;
		keywords: string;
	};
}

export const siteConfig: SiteConfig = {
	brand: {
		name: "APEX",
		tagline: "Awaken Your True Potential.",
		logo: "/images/logo2.jpg",
	},

	theme: {
		primaryColor: "#8B5CF6",
		primaryHover: "#A78BFA",

		accentColor: "#C084FC",
		accentSoft: "#DDD6FE",

		backgroundColor: "#030014",

		backgroundGradient:
			"linear-gradient(135deg, #030014 0%, #090018 30%, #14002E 65%, #1A1040 100%)",

		surfaceColor: "rgba(16, 6, 35, 0.72)",

		surfaceGlass:
			"backdrop-filter: blur(24px); border: 1px solid rgba(139,92,246,0.16)",

		textPrimary: "#FFFFFF",
		textSecondary: "#D8CCFF",
		textMuted: "#8E7CC3",

		successColor: "#22C55E",
		warningColor: "#FACC15",
		dangerColor: "#EF4444",

		borderColor: "rgba(139,92,246,0.12)",

		shadowColor: "rgba(139,92,246,0.40)",

		fontFamily:
			"'Inter', 'SF Pro Display', 'Poppins', sans-serif",

		borderRadius: "24px",

		transition:
			"all 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
	},

	hero: {
		headline: "Rise Beyond Human Limits.",

		subheadline:
			"An elite training sanctuary built for individuals obsessed with strength, discipline, and evolution.",

		ctaText: "Awaken Now",

		ctaLink: "/login",

		backgroundImage: "/images/hero2-bg.jpg",
	},

	about: {
		title: "The Shadow Standard",

		description:
			"ARISE is not a commercial gym. It is a performance-driven environment engineered for relentless individuals pursuing physical dominance, mental resilience, and elite transformation.",

		features: [
			"24/7 Elite Access",
			"Private Coaching Systems",
			"Recovery & Performance Zones",
			"Advanced Body Analytics",
		],
	},

	contact: {
		address: "Indiranagar, Bengaluru",

		phone: "+91 98765 43210",

		email: "hello@arisefitness.com",

		instagram: "https://instagram.com/arisefitness",

		whatsapp: "https://wa.me/919876543210",
	},

	seo: {
		title:
			"APEX — Elite Luxury Fitness Experience in Bengaluru",

		description:
			"Train in a next-generation luxury fitness environment designed for serious transformation and elite performance.",

		keywords:
			"luxury gym Bengaluru, elite fitness, solo leveling aesthetic gym, premium fitness, arise fitness",
	},
};
export const C = {
	bg: siteConfig.theme.backgroundColor,
	background: siteConfig.theme.backgroundColor,
	backgroundGradient: siteConfig.theme.backgroundGradient,

	surface: siteConfig.theme.surfaceColor,
	glass: 'rgba(255,255,255,0.04)',
	glassMid: 'rgba(255,255,255,0.06)',

	primary: siteConfig.theme.primaryColor,
	primaryHover: siteConfig.theme.primaryHover,
	primaryGlow: siteConfig.theme.shadowColor,
	accent: siteConfig.theme.accentColor,
	accentSoft: siteConfig.theme.accentSoft,

	green: siteConfig.theme.successColor,
	gold: siteConfig.theme.warningColor,
	red: siteConfig.theme.dangerColor,

	textPrimary: siteConfig.theme.textPrimary,
	textSecondary: siteConfig.theme.textSecondary,
	textMuted: siteConfig.theme.textMuted,

	border: siteConfig.theme.borderColor,
	borderMid: 'rgba(139,92,246,0.20)',

	shadow: siteConfig.theme.shadowColor,
	radius: siteConfig.theme.borderRadius,
	transition: siteConfig.theme.transition,

	// Design system classes for admin UI
	SURFACE_CLASS: 'rounded-[24px] border border-[rgba(139,92,246,0.12)] bg-[rgba(16,6,35,0.72)] backdrop-blur-[24px]',
	FIELD_CLASS: 'w-full rounded-xl border border-[rgba(139,92,246,0.18)] bg-[rgba(3,0,20,0.6)] px-4 py-2 text-textPrimary outline-none focus:border-primary',
} as const;