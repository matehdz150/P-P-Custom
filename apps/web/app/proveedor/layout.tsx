"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PedidosProvider, usePedidos } from "@/Contexts/PedidosContext";
import {
	ProviderAuthProvider,
	useProviderAuth,
} from "@/Contexts/ProviderAuthContext";

export default function ProviderLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const isLogin = pathname === "/proveedor/login";

	return (
		<ProviderAuthProvider>
			{isLogin ? (
				children
			) : (
				<PedidosProvider>
					<Shell>{children}</Shell>
				</PedidosProvider>
			)}
		</ProviderAuthProvider>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	const { provider, loading, salir } = useProviderAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !provider) router.replace("/proveedor/login");
	}, [loading, provider, router]);

	if (loading) {
		return (
			<div className="font-brand flex min-h-screen items-center justify-center bg-white text-[15px] text-tinta/60">
				Cargando…
			</div>
		);
	}
	if (!provider) return null;

	function handleLogout() {
		// Cognito no tiene nada que revocar de nuestro lado: la sesión es el
		// token, y el token vive aquí. Borrarlo ES cerrar sesión.
		salir();
		router.replace("/proveedor/login");
	}

	return (
		<div className="font-brand flex min-h-screen bg-white text-tinta">
			<aside className="fixed left-0 top-0 z-40 flex h-screen w-[236px] flex-col justify-between border-r border-tinta/12 bg-white px-[18px] py-[26px]">
				<div className="flex flex-col gap-7">
					<Link
						href="/"
						className="pl-3 font-brand text-[26px] font-semibold leading-none tracking-[-0.05em] text-tinta"
					>
						kustto
					</Link>

					<nav className="flex flex-col gap-[3px]">
						<NavLink
							href="/proveedor"
							label="Pedidos"
							icon={<IconoPedidos />}
						/>
						<NavLink
							href="/proveedor/productos"
							label="Mis productos"
							icon={<IconoProductos />}
						/>
						<NavLink
							href="/proveedor/inventario"
							label="Inventario"
							icon={<IconoInventario />}
						/>
						<NavLink
							href="/proveedor/perfil"
							label="Perfil"
							icon={<IconoPerfil />}
						/>
					</nav>
				</div>

				<div className="flex flex-col gap-[3px] border-t border-tinta/12 pt-[18px]">
					<div className="flex flex-col gap-0.5 px-3 pb-3">
						<span className="truncate text-sm font-semibold text-tinta">
							{provider.displayName || provider.name || "Tu taller"}
						</span>
						<span className="truncate text-xs text-tinta/55">
							{provider.email}
						</span>
					</div>
					<button
						type="button"
						onClick={handleLogout}
						className="flex h-[42px] items-center gap-[11px] rounded-lg px-3 text-[15px] text-tinta/70 hover:bg-gris hover:text-tinta"
					>
						<IconoSalir />
						Salir
					</button>
				</div>
			</aside>

			<main className="ml-[236px] min-h-screen flex-1 px-10 py-[34px]">
				{children}
			</main>
		</div>
	);
}

function NavLink({
	href,
	label,
	icon,
}: {
	href: string;
	label: string;
	icon: React.ReactNode;
}) {
	const pathname = usePathname();
	const { nuevos } = usePedidos();
	const activo = pathname === href;

	// La insignia sólo vive en Pedidos y sólo cuando hay algo sin abrir.
	const insignia = href === "/proveedor" && nuevos > 0 ? nuevos : null;

	return (
		<Link
			href={href}
			aria-current={activo ? "page" : undefined}
			className={`flex h-[42px] items-center gap-[11px] rounded-lg px-3 text-[15px] ${
				activo
					? "bg-gris font-semibold text-tinta"
					: "text-tinta/70 hover:bg-gris hover:text-tinta"
			}`}
		>
			{icon}
			<span className="flex-1">{label}</span>
			{insignia !== null && (
				<>
					{/* El número entra al nombre accesible del enlace, no como
					    etiqueta suelta de un span sin rol. */}
					<span className="sr-only">, {insignia} sin abrir</span>
					<span
						aria-hidden="true"
						className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-lima px-1.5 text-xs font-semibold text-tinta"
					>
						{insignia}
					</span>
				</>
			)}
		</Link>
	);
}

function IconoPedidos() {
	return (
		<svg
			width="19"
			height="19"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M4.5 6.5h15M4.5 12h15M4.5 17.5h9"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function IconoProductos() {
	return (
		<svg
			width="19"
			height="19"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M12 3.4l7.6 4.2-7.6 4.2-7.6-4.2L12 3.4zM4.4 12l7.6 4.2 7.6-4.2M4.4 16.2l7.6 4.2 7.6-4.2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** Cajas apiladas: lo que hay en la bodega, no lo que se vende. */
function IconoInventario() {
	return (
		<svg
			width="19"
			height="19"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M3.6 8.4h16.8v11.2H3.6V8.4zM3.6 8.4l2-4h12.8l2 4M12 8.4v11.2M9.4 12.2h5.2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function IconoPerfil() {
	return (
		<svg
			width="19"
			height="19"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<circle
				cx="12"
				cy="8.4"
				r="3.4"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M5.4 19.2c0-3 2.9-5.2 6.6-5.2s6.6 2.2 6.6 5.2"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function IconoSalir() {
	return (
		<svg
			width="19"
			height="19"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
		>
			<path
				d="M14.5 16.5l4-4.5-4-4.5M18 12H9M11 4.5H6.5A1.5 1.5 0 005 6v12a1.5 1.5 0 001.5 1.5H11"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
