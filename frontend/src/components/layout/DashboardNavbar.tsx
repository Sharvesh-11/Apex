"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { siteConfig } from "@/lib/config";
import useAuthStore from "@/store/authStore";

type Role = "gym_owner" | "gym_member" | "admin";

export default function DashboardNavbar({ role }: { role: Role }) {
	const router = useRouter();
	const user = useAuthStore((s) => s.user);
	const logout = useAuthStore((s) => s.logout);

	const handleLogout = () => {
		logout();
		router.push("/");
	};

	const roleLabel =
		role === "gym_owner"
			? "Owner Dashboard"
			: role === "gym_member"
			? "Member Portal"
			: "System Console";

	return (
		<header className="fixed left-0 right-0 top-0 z-40 border-b border-[rgba(139,92,246,0.12)] bg-[rgba(3,0,20,0.58)] px-4 backdrop-blur-[20px] md:px-6">
			<div className="mx-auto flex h-16 max-w-[1440px] items-center">
				<div className="flex items-center gap-4">
					<Link href="/" className="text-sm font-light tracking-[0.2em] text-[#FFFFFF]">
						{siteConfig.brand.name}
					</Link>
					<div className="hidden text-[10px] uppercase tracking-[0.2em] text-[#8E7CC3] md:block">
						platform control
					</div>
				</div>

				<div className="flex flex-1 justify-center">
					<div className="inline-flex items-center gap-2 rounded-full border border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.12)] px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-[#D8CCFF]">
						<span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-[pulse_2s_ease-in-out_infinite]" />
						{roleLabel}
					</div>
				</div>

				<div className="flex items-center gap-3">
					<Link href="/" className="hidden text-xs text-[#8E7CC3] transition-colors hover:text-[#D8CCFF] md:inline">
						Back to Site
					</Link>

					<div className="hidden h-5 w-px bg-[rgba(139,92,246,0.22)] md:block" />

					<div className="hidden max-w-[220px] truncate text-xs text-[#A995DE] sm:block">{user?.email}</div>

					<button
						onClick={handleLogout}
						className="inline-flex items-center justify-center rounded-xl border border-[rgba(139,92,246,0.2)] p-2 text-[#A995DE] transition-colors hover:text-red-300"
					>
						<LogOut className="h-4 w-4" />
					</button>
				</div>
			</div>
		</header>
	);
}

