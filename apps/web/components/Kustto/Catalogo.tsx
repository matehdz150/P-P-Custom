"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Entrada } from "@/components/Animaciones/Entrada";
import { getCatalogo } from "@/lib/api/catalogo";

const PRODUCTOS = [
	{
		nombre: "Playera",
		termino: "playera",
		img: "/products/tshirt.png",
		href: "/catalogo?q=playera",
		/** La playera se ancla abajo: es una foto de cuerpo, no un producto suelto. */
		anclaAbajo: true,
		ancho: "w-[158px] md:w-[250px]",
	},
	{
		nombre: "Gorra",
		termino: "gorra",
		img: "/products/cap.png",
		href: "/catalogo?q=gorra",
		anclaAbajo: false,
		ancho: "w-[146px] md:w-[230px]",
	},
	{
		nombre: "Tote bag",
		termino: "tote",
		img: "/products/totebag.png",
		href: "/catalogo?q=tote",
		anclaAbajo: false,
		ancho: "w-[130px] md:w-[205px]",
	},
	{
		nombre: "Termo",
		termino: "termo",
		img: "/products/thermo2.png",
		href: "/catalogo?q=termo",
		anclaAbajo: false,
		ancho: "w-[158px] md:w-[250px]",
	},
];

/**
 * Las baldosas de producto de la portada.
 *
 * SE ESCONDEN LAS QUE NO LLEVAN A NADA. La lista es fija —son fotos cuidadas,
 * con su encuadre y su tamaño, que no salen del catálogo— pero sus enlaces sí
 * van a `/catalogo?q=…`, y dos de los cuatro términos no tienen ni un producto
 * publicado: quien pulsaba "Tote bag" desde la portada aterrizaba en una
 * búsqueda vacía.
 *
 * FALLA ABIERTO: si el catálogo no responde se enseñan las cuatro, como antes.
 * Vale más una baldosa de más que una portada a medio pintar.
 *
 * Cuando entren totes o termos de verdad, vuelven solas.
 */
function useDisponibles() {
	const [terminos, setTerminos] = useState<string[] | null>(null);

	useEffect(() => {
		getCatalogo()
			.then((productos) =>
				setTerminos(productos.map((p) => p.name.toLowerCase())),
			)
			.catch(() => setTerminos(null));
	}, []);

	return (termino: string) =>
		terminos === null || terminos.some((n) => n.includes(termino));
}

export default function Catalogo() {
	const hayDe = useDisponibles();
	const visibles = PRODUCTOS.filter((p) => hayDe(p.termino));

	return (
		<section className="bg-gris px-5 py-14 md:px-11 md:py-24">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-[26px] md:gap-11">
				<Entrada className="flex items-end justify-between gap-16">
					<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] text-tinta md:max-w-[700px] md:text-[40px] md:leading-[48px]">
						Empieza por lo que más se pide
					</h2>
					<Link
						href="/catalogo"
						className="hidden shrink-0 items-center gap-2 pb-1.5 text-base font-semibold text-tinta hover:text-lima-oscuro md:flex"
					>
						Ver catálogo completo
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
				</Entrada>

				<div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
					{visibles.map((p, i) => (
						<Entrada
							key={p.nombre}
							delay={i * 0.07}
							desplazamiento={20}
							className="h-full"
						>
							<Link href={p.href} className="group flex h-full flex-col gap-3">
								<div
									className={`flex h-[190px] justify-center overflow-hidden rounded-[24px] bg-white motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:shadow-[0_14px_30px_rgba(43,40,18,0.08)] md:h-[300px] md:rounded-[28px] ${
										p.anclaAbajo ? "items-end" : "items-center"
									}`}
								>
									<Image
										src={p.img}
										alt={`${p.nombre} personalizable`}
										width={280}
										height={340}
										className={`h-auto max-w-none object-contain ${p.ancho}`}
									/>
								</div>
								<div className="flex items-baseline justify-between gap-2">
									<span className="text-[15px] font-semibold text-tinta md:text-base">
										{p.nombre}
									</span>
									<span className="text-[13px] text-tinta/60 md:text-sm">
										<span className="md:hidden">[TU PRECIO]</span>
										<span className="hidden md:inline">desde [TU PRECIO]</span>
									</span>
								</div>
							</Link>
						</Entrada>
					))}
				</div>

				<Entrada desplazamiento={14} className="md:hidden">
					<Link
						href="/catalogo"
						className="flex h-[52px] items-center justify-center gap-2 rounded-full border-[1.5px] border-tinta text-base font-semibold text-tinta"
					>
						Ver catálogo completo
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
				</Entrada>
			</div>
		</section>
	);
}
