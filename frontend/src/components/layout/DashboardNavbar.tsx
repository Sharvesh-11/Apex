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
			: "Admin Panel";

	return (
		<header className="fixed top-0 left-0 right-0 h-16 bg-surface border-b border-accent z-40 px-6 flex items-center">
			<div className="flex items-center gap-4">
				<Link href="/" className="text-primary font-bold">
					{siteConfig.brand.name}
				</Link>
			</div>

			<div className="flex-1 flex justify-center">
				<div className="hidden md:inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
					{roleLabel}
				</div>
			</div>

			<div className="flex items-center gap-4">
				<Link href="/" className="hidden md:inline text-textSecondary hover:text-textPrimary text-sm">
					&larr; Back to Site
				</Link>

				<div className="hidden md:block h-6 w-px bg-accent/40" />

				<div className="hidden sm:block text-xs text-textSecondary">{user?.email}</div>

				<button onClick={handleLogout} className="inline-flex items-center gap-2 text-textSecondary hover:text-red-400">
					<LogOut className="h-5 w-5" />
				</button>
			</div>
		</header>
	);
}

