"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getPackageCategoryWithPackagesByName } from "@/lib/api/categories";
import Aparece from "./Aparece";

type Paquete = {
	id: string;
	nombre: string;
	descripcion: string;
	imagen: string | null;
	precioDesde: number | null;
};

interface PackagesSectionProps {
	title: string;
	description: string;
	href: string;
	/** Nombre de la categoría de paquetes en la API (p. ej. "eventos"). */
	categoryName: string;
	verTodos: string;
	limit?: number;
}

export default function PackagesSection({
	title,
	description,
	href,
	categoryName,
	verTodos,
	limit = 2,
}: PackagesSectionProps) {
	const [paquetes, setPaquetes] = useState<Paquete[]>([]);
	const [cargando, setCargando] = useState(true);

	useEffect(() => {
		let vigente = true;

		async function cargar() {
			setCargando(true);
			try {
				const categoria =
					await getPackageCategoryWithPackagesByName(categoryName);
				if (!vigente) return;

				setPaquetes(
					(categoria.packages ?? []).slice(0, limit).map((pkg) => ({
						id: pkg.id,
						nombre: pkg.name,
						descripcion: pkg.description ?? "",
						imagen: pkg.image ?? null,
						precioDesde: pkg.basePrice ?? null,
					})),
				);
			} finally {
				if (vigente) setCargando(false);
			}
		}

		cargar();
		return () => {
			vigente = false;
		};
	}, [categoryName, limit]);

	if (cargando || paquetes.length === 0) return null;

	return (
		<section className="px-5 pt-16 md:px-14 md:pt-24">
			<Aparece className="flex flex-col gap-3 border-b border-tinta/14 pb-[22px] md:flex-row md:items-end md:justify-between md:gap-12 md:pb-7">
				<h2 className="font-display text-[30px] font-extrabold leading-9 tracking-[-0.021em] text-tinta md:text-[40px] md:leading-[48px]">
					{title}
				</h2>
				<p className="text-[15px] leading-[26px] text-tinta/60 md:max-w-[380px] md:pb-1.5">
					{description}
				</p>
			</Aparece>

			<div className="grid grid-cols-1 gap-[26px] pt-[26px] md:grid-cols-2 md:gap-14 md:pt-10">
				{paquetes.map((p, i) => (
					<Aparece key={p.id} indice={i}>
					<Link
						href={`/package/${p.id}`}
						className="flex flex-col gap-3.5 md:gap-[22px]"
					>
						<div className="relative h-[280px] w-full overflow-hidden rounded-[24px] bg-lavanda md:h-[420px] md:rounded-[28px]">
							{p.imagen && (
								<Image
									src={p.imagen}
									alt={p.nombre}
									fill
									className="object-cover"
								/>
							)}
						</div>

						<div className="flex flex-col gap-1.5">
							<div className="flex items-baseline justify-between gap-3 md:gap-5">
								<span className="text-[21px] font-semibold tracking-[-0.5px] text-tinta md:text-2xl md:tracking-[-0.6px]">
									{p.nombre}
								</span>
								{p.precioDesde != null && (
									<span className="whitespace-nowrap text-[15px] text-tinta/70 md:text-base">
										desde ${p.precioDesde.toLocaleString("es-MX")}
									</span>
								)}
							</div>
							{p.descripcion && (
								<span className="text-sm leading-[23px] text-tinta/55 md:text-[15px]">
									{p.descripcion}
								</span>
							)}
						</div>
					</Link>
					</Aparece>
				))}
			</div>

			<Link
				href={href}
				className="mt-6 inline-flex items-center gap-2.5 text-[15px] font-semibold text-tinta hover:text-lima-oscuro md:mt-8 md:text-base"
			>
				{verTodos}
				<svg
					width="14"
					height="14"
					viewBox="0 0 14 14"
					fill="none"
					aria-hidden="true"
				>
					<path
						d="M5.833 10.5L9.333 7L5.833 3.5"
						stroke="currentColor"
						strokeWidth="1.7"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</Link>
		</section>
	);
}
