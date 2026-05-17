"use client";

import { LogOut, Package, PlusCircle, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
	ProviderAuthProvider,
	useProviderAuth,
} from "@/Contexts/ProviderAuthContext";
import { providerLogout } from "@/lib/api/providers";

export default function ProviderLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const isLogin = pathname === "/proveedor/login";

	return (
		<ProviderAuthProvider>
			{isLogin ? children : <Shell>{children}</Shell>}
		</ProviderAuthProvider>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	const { provider, loading } = useProviderAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !provider) router.replace("/proveedor/login");
	}, [loading, provider, router]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center text-muted-foreground">
				Cargando…
			</div>
		);
	}
	if (!provider) return null;

	async function handleLogout() {
		await providerLogout();
		router.replace("/proveedor/login");
	}

	return (
		<div className="min-h-screen bg-muted/40">
			<aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background flex flex-col">
				<div className="h-16 flex items-center px-6 border-b">
					<span className="font-semibold text-lg">Proveedor</span>
				</div>

				<nav className="p-4 space-y-1 flex-1">
					<NavLink href="/proveedor" label="Mis productos" icon={Package} />
					<NavLink
						href="/proveedor/productos/nuevo"
						label="Nuevo producto"
						icon={PlusCircle}
					/>
					<NavLink
						href="/proveedor/perfil"
						label="Perfil público"
						icon={Settings}
					/>
				</nav>

				<div className="p-4 border-t">
					<p className="text-xs text-muted-foreground mb-2 truncate">
						{provider.name || provider.email}
					</p>
					<button
						type="button"
						onClick={handleLogout}
						className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
					>
						<LogOut className="w-4 h-4" />
						Cerrar sesión
					</button>
				</div>
			</aside>

			<main className="ml-64 min-h-screen p-6">{children}</main>
		</div>
	);
}

function NavLink({
	href,
	label,
	icon: Icon,
}: {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}) {
	const pathname = usePathname();
	const active = pathname === href;
	return (
		<Link
			href={href}
			className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
				active
					? "bg-[#fe6241]/10 text-[#fe6241] font-medium"
					: "text-muted-foreground hover:bg-muted hover:text-foreground"
			}`}
		>
			<Icon className="w-4 h-4" />
			{label}
		</Link>
	);
}
