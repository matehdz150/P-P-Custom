"use client";

import {
	ClipboardCheck,
	LayoutGrid,
	Package,
	SlidersHorizontal,
	Truck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminAuthProvider } from "@/Contexts/AdminAuthContext";
import { cn } from "@/lib/utils";
import Guardia from "./Guardia";

type AdminLayoutProps = {
	children: ReactNode;
};

const navItems = [
	{
		label: "Productos",
		href: "/admin/productos",
		icon: Package,
	},
	{
		label: "Paquetes",
		href: "/admin/paquetes",
		icon: Package,
	},
	{
		label: "Revisión",
		href: "/admin/revision",
		icon: ClipboardCheck,
	},
	{
		label: "Mockups",
		href: "/admin/mockups",
		icon: LayoutGrid,
	},
	{
		label: "Categorias",
		href: "/admin/categorias",
		icon: SlidersHorizontal,
	},
	{
		label: "Proveedores",
		href: "/admin/proveedores",
		icon: Truck,
	},
];

/**
 * El marco del backoffice.
 *
 * ES CLIENTE Y NO SERVIDOR desde que esto se publica: el sitio se exporta
 * estático y la sesión vive en el navegador, así que quien decide si se enseña
 * el panel tiene que estar del lado del navegador.
 *
 * EL GUARDIA NO ES LA SEGURIDAD, y conviene tenerlo claro al leer esto: lo que
 * de verdad cierra el backoffice es el autorizador JWT de `/admin/*` en la API
 * Gateway. Sin token no hay datos, se pinte lo que se pinte. Esto sólo evita
 * enseñar un panel vacío y mandar a entrar.
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
	return (
		<AdminAuthProvider>
			<Guardia>
				<Panel>{children}</Panel>
			</Guardia>
		</AdminAuthProvider>
	);
}

function Panel({ children }: AdminLayoutProps) {
	return (
		<div className="min-h-screen bg-muted/40">
			{/* SIDEBAR */}
			<aside
				className="
          fixed left-0 top-0 z-40
          h-screen w-64
          border-r bg-background
        "
			>
				{/* HEADER */}
				<div className="h-16 flex items-center px-6 border-b">
					<span className="font-semibold text-lg">Admin</span>
				</div>

				{/* NAV */}
				<nav className="p-4 space-y-1">
					{navItems.map((item) => {
						const Icon = item.icon;

						return (
							<Link
								key={item.href}
								href={item.href}
								className={cn(
									"flex items-center gap-3 rounded-md px-3 py-2 text-sm",
									"text-muted-foreground hover:bg-muted hover:text-foreground",
									"transition-colors",
								)}
							>
								<Icon className="w-4 h-4" />
								{item.label}
							</Link>
						);
					})}
				</nav>
			</aside>

			{/* CONTENT */}
			<main
				className="
          ml-64
          min-h-screen
          p-6
        "
			>
				{children}
			</main>
		</div>
	);
}
