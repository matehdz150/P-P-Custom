"use client";

import { ChevronDown, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Header() {
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
		<header className="w-full border-b bg-white">
			<div className="mx-auto flex h-16 max-w-7xl items-center px-6">
				{/* LEFT — LOGO */}
				<div className="mr-8">
					<Link href="/">
						<Image src="/logo2.png" alt="P&P Custom" width={160} height={152} />
					</Link>
				</div>

				{/* CENTER — NAVIGATION */}
				<div className="hidden flex-1 justify-center md:flex">
					<nav className="flex items-center gap-8 whitespace-nowrap relative">
						{/* CATÁLOGO (sin dropdown) */}
						<Link href="/catalogo" className="text-md">
							Catálogo
						</Link>

						{/* CÓMO FUNCIONA */}
						<div className="relative">
							<button
								type="button"
								onClick={() => toggle("como")}
								className="flex items-center gap-1 px-3 py-2 rounded-md hover:bg-neutral-100"
							>
								Cómo funciona
								<ChevronDown
									className={`h-4 w-4 transition-transform ${
										open.como ? "rotate-180" : ""
									}`}
								/>
							</button>

							{open.como && (
								<div className="absolute left-1/2 top-full z-50 mt-2 w-[260px] -translate-x-1/2 rounded-xl border bg-white p-4 shadow-lg">
									<div className="space-y-4">
										<div>
											<h4 className="font-bold">¿Qué es?</h4>
											<p className="text-sm text-muted-foreground">
												Explicación rápida del proceso.
											</p>
										</div>

										<div>
											<h4 className="font-bold">Pasos para empezar</h4>
											<p className="text-sm text-muted-foreground">
												Flujo básico para crear productos.
											</p>
										</div>

										<div>
											<h4 className="font-bold">Preguntas frecuentes</h4>
											<p className="text-sm text-muted-foreground">
												Todo lo esencial antes de comprar.
											</p>
										</div>
									</div>
								</div>
							)}
						</div>

						{/* BUSINESS */}
						<div className="relative">
							<button
								type="button"
								onClick={() => toggle("business")}
								className="flex items-center gap-1 px-3 py-2 rounded-md hover:bg-neutral-100"
							>
								Business
								<ChevronDown
									className={`h-4 w-4 transition-transform ${
										open.business ? "rotate-180" : ""
									}`}
								/>
							</button>

							{open.business && (
								<div className="absolute left-1/2 top-full z-50 mt-2 w-[260px] -translate-x-1/2 rounded-xl border bg-white p-4 shadow-lg">
									<div className="space-y-4">
										<div>
											<h4 className="font-bold">Para emprendedores</h4>
											<p className="text-sm text-muted-foreground">
												Crea un modelo de negocio rentable.
											</p>
										</div>

										<div>
											<h4 className="font-bold">Casos de éxito</h4>
											<p className="text-sm text-muted-foreground">
												Historias reales de nuestros usuarios.
											</p>
										</div>
									</div>
								</div>
							)}
						</div>

						{/* SOPORTE */}
						<div className="relative">
							<button
								type="button"
								onClick={() => toggle("soporte")}
								className="flex items-center gap-1 px-3 py-2 rounded-md hover:bg-neutral-100"
							>
								Soporte
								<ChevronDown
									className={`h-4 w-4 transition-transform ${
										open.soporte ? "rotate-180" : ""
									}`}
								/>
							</button>

							{open.soporte && (
								<div className="absolute left-1/2 top-full z-50 mt-2 w-[260px] -translate-x-1/2 rounded-xl border bg-white p-4 shadow-lg">
									<div className="space-y-4">
										<div>
											<h4 className="font-bold">Centro de ayuda</h4>
											<p className="text-sm text-muted-foreground">
												Tutoriales, guías y documentación.
											</p>
										</div>

										<div>
											<h4 className="font-bold">Contacto</h4>
											<p className="text-sm text-muted-foreground">
												Habla con el equipo de soporte.
											</p>
										</div>
									</div>
								</div>
							)}
						</div>

						{/* IDEAS E INSPIRACIÓN */}
						<div className="relative">
							<button
								type="button"
								onClick={() => toggle("ideas")}
								className="flex items-center gap-1 px-3 py-2 rounded-md hover:bg-neutral-100"
							>
								Ideas e inspiración
								<ChevronDown
									className={`h-4 w-4 transition-transform ${
										open.ideas ? "rotate-180" : ""
									}`}
								/>
							</button>

							{open.ideas && (
								<div className="absolute left-1/2 top-full z-50 mt-2 w-[260px] -translate-x-1/2 rounded-xl border bg-white p-4 shadow-lg">
									<p className="text-sm">
										Galerías de diseños, casos reales y tendencias creativas.
									</p>
								</div>
							)}
						</div>
					</nav>
				</div>

				{/* RIGHT: AUTH BUTTONS */}
				<div className="ml-auto hidden items-center gap-4 whitespace-nowrap md:flex">
					<Link
						href="/login"
						className="rounded-sm border p-3 text-sm font-bold"
					>
						Iniciar sesión
					</Link>

					<Link
						href="/register"
						className="rounded-[0.2rem] bg-[#fe6241] p-3 text-sm font-bold text-black"
					>
						Registrarse
					</Link>
				</div>

				{/* MOBILE */}
				<div className="ml-auto md:hidden">
					<Sheet>
						<SheetTrigger>
							<Menu size={26} />
						</SheetTrigger>
						<SheetContent side="right" className="p-6">
							{/* después armamos el mobile menu */}
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	);
}
