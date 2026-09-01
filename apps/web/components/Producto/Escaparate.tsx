"use client";

import Image from "next/image";
import { useState } from "react";
import type { Product } from "@/lib/api/products";
import { fichaTecnica, type Vista } from "./datos";
import Panel from "./Panel";

/**
 * El escaparate: la pieza a sangre sobre un bloque de color, con el nombre
 * corriendo POR DEBAJO de ella. Ese traslape es el diseño — el nombre va en
 * z-10, la prenda en z-20 — y depende de que la foto tenga transparencia.
 *
 * El panel de compra y la ficha del proveedor viven fuera del bloque de
 * color: en escritorio se posicionan encima, en móvil caen debajo. Van una
 * sola vez en el DOM para no duplicar el estado de los selectores.
 */
export default function Escaparate({
	product,
	vistas,
}: {
	product: Product;
	vistas: Vista[];
}) {
	const [activa, setActiva] = useState(0);
	const vista = vistas[activa];
	const ficha = fichaTecnica(product);

	return (
		<div className="relative">
			<section className="relative h-[520px] overflow-hidden bg-lavanda min-[768px]:h-[620px] min-[1280px]:h-[880px]">
				<h1 className="absolute left-5 top-[34px] z-10 max-w-[330px] font-display text-[52px] font-extrabold uppercase leading-[50px] tracking-[-0.031em] text-tinta min-[768px]:left-10 min-[768px]:top-14 min-[768px]:max-w-[520px] min-[768px]:text-[72px] min-[768px]:leading-[70px] min-[1280px]:left-14 min-[1280px]:top-[236px] min-[1280px]:max-w-[720px] min-[1280px]:text-[92px] min-[1280px]:leading-[90px] min-[1280px]:tracking-[-0.03em] min-[1400px]:top-[236px] min-[1400px]:max-w-[880px] min-[1400px]:text-[116px] min-[1400px]:leading-[112px]">
					{product.name}
				</h1>

				{vista && (
					<Image
						src={vista.src}
						alt={`${product.name} — ${vista.label}`}
						width={720}
						height={900}
						priority
						className="absolute bottom-0 left-24 z-20 h-[470px] w-auto max-w-none min-[768px]:left-1/2 min-[768px]:h-[560px] min-[768px]:-translate-x-1/2 min-[1280px]:left-[296px] min-[1280px]:h-[830px] min-[1280px]:translate-x-0"
					/>
				)}

				{vistas.length > 1 && (
					<div className="absolute bottom-[18px] left-5 z-30 flex items-center gap-2.5 min-[768px]:bottom-8 min-[768px]:left-10 min-[1280px]:bottom-12 min-[1280px]:left-14 min-[1280px]:gap-3">
						{vistas.map((v, i) => (
							<button
								key={v.key}
								type="button"
								onClick={() => setActiva(i)}
								aria-label={v.label}
								aria-pressed={i === activa}
								className={`flex h-[62px] w-[62px] items-center justify-center rounded-2xl min-[1280px]:h-21 min-[1280px]:w-21 min-[1280px]:rounded-[20px] ${
									i === activa
										? "border-[1.5px] border-tinta bg-hueso"
										: "bg-hueso/60"
								}`}
							>
								<Image
									src={v.src}
									alt=""
									width={200}
									height={250}
									className="max-h-[74%] w-auto max-w-[68%] object-contain"
								/>
							</button>
						))}
					</div>
				)}
			</section>

			{/* Ficha corta: en escritorio se mete dentro del escaparate. */}
			<div className="flex flex-col gap-2 px-5 pt-6 min-[1280px]:absolute min-[1280px]:left-14 min-[1280px]:top-[500px] min-[1280px]:z-10 min-[1280px]:w-[300px] min-[1280px]:gap-3.5 min-[1280px]:px-0 min-[1280px]:pt-0">
				{ficha && (
					<span className="text-sm font-semibold text-tinta md:text-[15px]">
						{product.production?.provider ?? product.provider?.displayName}
					</span>
				)}
				{product.description && (
					<p className="text-[15px] leading-[25px] text-tinta/70">
						{product.description}
					</p>
				)}
			</div>

			<Panel
				product={product}
				className="px-5 pt-6 min-[1280px]:absolute min-[1280px]:right-14 min-[1280px]:top-24 min-[1280px]:z-30 min-[1280px]:w-[404px] min-[1280px]:rounded-[28px] min-[1280px]:bg-hueso min-[1280px]:px-8 min-[1280px]:py-[30px] min-[1280px]:shadow-[0_24px_60px_rgba(43,40,18,0.16)]"
			/>
		</div>
	);
}
