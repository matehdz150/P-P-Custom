"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import HeaderLogo from "./HeaderLogo";

export default function HeaderDesktopNav() {
	const [open, setOpen] = useState({
		como: false,
		business: false,
		soporte: false,
		ideas: false,
	});

	const toggle = (key: keyof typeof open) => {
		setOpen((prev) => {
			const isOpen = prev[key];
			const closedAll = {
				como: false,
				business: false,
				soporte: false,
				ideas: false,
			};
			return isOpen ? closedAll : { ...closedAll, [key]: true };
		});
	};

	return (
		<nav className="hidden md:flex items-center gap-8 whitespace-nowrap relative px-6">
			<HeaderLogo />

			{/* CATÁLOGO */}
			<Link href="/catalogo" className="text-md">
				Catálogo
			</Link>

			{/* CÓMO FUNCIONA */}
			<NavItem
				label="Cómo funciona"
				open={open.como}
				onClick={() => toggle("como")}
			>
				<DropdownSection
					title="¿Qué es?"
					desc="Explicación rápida del proceso."
				/>
				<DropdownSection
					title="Pasos para empezar"
					desc="Flujo básico para crear productos."
				/>
				<DropdownSection
					title="Preguntas frecuentes"
					desc="Todo lo esencial antes de comprar."
				/>
			</NavItem>

			{/* BUSINESS */}
			<NavItem
				label="Business"
				open={open.business}
				onClick={() => toggle("business")}
			>
				<DropdownSection
					title="Para emprendedores"
					desc="Crea un modelo de negocio rentable."
				/>
				<DropdownSection
					title="Casos de éxito"
					desc="Historias reales de nuestros usuarios."
				/>
			</NavItem>

			{/* SOPORTE */}
			<NavItem
				label="Soporte"
				open={open.soporte}
				onClick={() => toggle("soporte")}
			>
				<DropdownSection
					title="Centro de ayuda"
					desc="Tutoriales, guías y documentación."
				/>
				<DropdownSection
					title="Contacto"
					desc="Habla con el equipo de soporte."
				/>
			</NavItem>

			{/* IDEAS */}
			<NavItem
				label="Ideas e inspiración"
				open={open.ideas}
				onClick={() => toggle("ideas")}
			>
				<p className="text-sm">
					Galerías de diseños, casos reales y tendencias creativas.
				</p>
			</NavItem>
		</nav>
	);
}

/* Helper Components */

function NavItem({
	label,
	open,
	onClick,
	children,
}: {
	label: string;
	open: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<div className="relative">
			<button
				type="button"
				onClick={onClick}
				className="flex items-center gap-1 px-3 py-2 rounded-md hover:bg-neutral-100"
			>
				{label}
				<ChevronDown
					className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open && (
				<div className="absolute left-1/2 top-full z-50 mt-2 w-[260px] -translate-x-1/2 rounded-xl border bg-white p-4 shadow-lg">
					<div className="space-y-4">{children}</div>
				</div>
			)}
		</div>
	);
}

function DropdownSection({ title, desc }: { title: string; desc: string }) {
	return (
		<div>
			<h4 className="font-bold">{title}</h4>
			<p className="text-sm text-muted-foreground">{desc}</p>
		</div>
	);
}
