"use client";

import {
	ChevronDown,
	Grid2X2,
	LogOut,
	MoreHorizontal,
	Package,
	PanelLeft,
	Plus,
	Settings,
	ShoppingBag,
	UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
	const pathname = usePathname();
	const [sidebarOpen, setSidebarOpen] = useState(true);

	useEffect(() => {
		if (!loading && !provider) router.replace("/proveedor/login");
	}, [loading, provider, router]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center text-[#999]">
				Cargando…
			</div>
		);
	}
	if (!provider) return null;

	async function handleLogout() {
		await providerLogout();
		router.replace("/proveedor/login");
	}

	const workspaceName = provider.displayName || provider.name || "Mi proveedor";
	const pageTitle =
		pathname === "/proveedor"
			? "Mis productos"
			: pathname.includes("/productos/nuevo")
				? "Nuevo producto"
				: pathname.includes("/perfil")
					? "Perfil público"
					: pathname.includes("/paquetes/nuevo")
						? "Nuevo paquete"
						: pathname.includes("/paquetes")
							? "Mis paquetes"
							: pathname.includes("/pedidos")
								? "Pedidos"
								: "Proveedor";

	const SIDEBAR_W = 230;

	return (
		<div className="min-h-screen bg-white text-[#1a1a1a]">

			{/* ── SIDEBAR ── */}
			<aside
				style={{ width: sidebarOpen ? SIDEBAR_W : 0 }}
				className="fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-[#e8e8e8] bg-white lg:flex overflow-hidden transition-[width] duration-250 ease-in-out"
			>
				{/* Brand row */}
				<div className="flex h-[52px] shrink-0 items-center gap-2.5 px-4 border-b border-[#f0f0f0]">
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1a1a1a] text-white text-xs font-black">
						P
					</div>
					<span className="text-[14px] font-bold text-[#1a1a1a] tracking-tight">P&P Custom</span>
				</div>

				{/* Workspace row */}
				<div className="px-2 pt-2">
					<div className="flex items-center gap-2 rounded-md bg-[#f3f3f1] px-2.5 py-2 cursor-default">
						<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#2f3d1c] text-[9px] font-bold text-white">
							{workspaceName.slice(0, 1).toUpperCase()}
						</div>
						<span className="truncate text-[13px] font-semibold text-[#1a1a1a] flex-1">{workspaceName}</span>
					</div>
				</div>

				{/* Nav */}
				<nav className="mt-3 flex-1 overflow-y-auto px-2">
					<NavLink href="/proveedor" label="Mis productos" icon={Grid2X2} />
					<NavLink href="/proveedor/paquetes" label="Mis paquetes" icon={Package} />
					<NavLink href="/proveedor/pedidos" label="Pedidos" icon={ShoppingBag} />
					<NavLink href="/proveedor/perfil" label="Perfil público" icon={UserRound} />

					<div className="mt-4 mb-1 flex items-center justify-between px-2">
						<span className="text-[11px] font-semibold uppercase tracking-wider text-[#aaa]">Configuración</span>
					</div>
					<NavLink href="/proveedor/perfil" label="Ajustes" icon={Settings} />
				</nav>

				{/* Bottom */}
				<div className="shrink-0 px-2 pb-3 space-y-0.5">
					<button
						type="button"
						onClick={handleLogout}
						className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[#888] hover:bg-[#f5f5f4] hover:text-[#1a1a1a] transition-colors"
					>
						<LogOut className="h-3.5 w-3.5 shrink-0" />
						Cerrar sesión
					</button>
					<button
						type="button"
						className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[#888] hover:bg-[#f5f5f4] hover:text-[#1a1a1a] transition-colors"
					>
						<MoreHorizontal className="h-3.5 w-3.5 shrink-0" />
						Más opciones
					</button>
				</div>
			</aside>

			{/* ── HEADER ── */}
			<header
				style={{ left: sidebarOpen ? SIDEBAR_W : 0 }}
				className="fixed right-0 top-0 z-30 flex h-[52px] items-center justify-between border-b border-[#efefec] bg-white px-4 transition-[left] duration-250 ease-in-out"
			>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setSidebarOpen((v) => !v)}
						className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#f3f3f1] transition-colors"
						aria-label="Toggle sidebar"
					>
						<PanelLeft className="h-4 w-4 text-[#999]" />
					</button>

					{/* Brand en mobile */}
					<Link href="/proveedor" className="font-bold text-lg lg:hidden">
						P&P
					</Link>

					<h1 className="text-[14px] font-semibold text-[#1a1a1a]">{pageTitle}</h1>
				</div>

				<div className="hidden items-center gap-3 md:flex">
					<NewDropdown />
				</div>
			</header>

			{/* ── MAIN ── */}
			<main
				style={{ marginLeft: sidebarOpen ? SIDEBAR_W : 0, paddingTop: 52 }}
				className="min-h-screen transition-[margin] duration-250 ease-in-out"
			>
				{children}
			</main>
		</div>
	);
}

/* ── New dropdown ── */
function NewDropdown() {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleOutside(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", handleOutside);
		return () => document.removeEventListener("mousedown", handleOutside);
	}, []);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-1.5 rounded-md bg-[#1a1a1a] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#333] transition-colors"
			>
				<Plus className="h-3.5 w-3.5" />
				Nuevo
				<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open && (
				<div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-[#e8e8e8] bg-white py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)]">
					<Link
						href="/proveedor/productos/nuevo"
						onClick={() => setOpen(false)}
						className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#1a1a1a] hover:bg-[#f5f5f4] transition-colors"
					>
						<Grid2X2 className="h-3.5 w-3.5 text-[#888]" />
						Crear producto
					</Link>
					<Link
						href="/proveedor/paquetes/nuevo"
						onClick={() => setOpen(false)}
						className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#1a1a1a] hover:bg-[#f5f5f4] transition-colors"
					>
						<Package className="h-3.5 w-3.5 text-[#888]" />
						Crear paquete
					</Link>
				</div>
			)}
		</div>
	);
}

/* ── NavLink ── */
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
			className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
				active
					? "bg-[#f3f3f1] text-[#1a1a1a] font-semibold"
					: "text-[#555] hover:bg-[#f5f5f4] hover:text-[#1a1a1a]"
			}`}
		>
			<Icon className="h-3.5 w-3.5 shrink-0" />
			{label}
		</Link>
	);
}
