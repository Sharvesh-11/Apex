import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "res.cloudinary.com",
				pathname: "/**",
			},
		],
	},

	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${process.env.BACKEND_URL || "http://localhost:8000"}/api/:path*`,
			},
		];
	},
};

export default nextConfig;