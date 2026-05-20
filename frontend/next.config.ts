import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	
	// Disable automatic trailing slash redirects
	trailingSlash: false,

	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "res.cloudinary.com",
				pathname: "/**",
			},
		],
	},
};

export default nextConfig;