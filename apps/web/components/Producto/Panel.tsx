"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/api/products";
import { pesos, porPieza } from "./datos";
import { Chevron, Palomita } from "./Iconos";

const CANTIDADES = [1, 10, 30, 50];

/**
 * Lo necesario para comprar. Ya no lleva título ni descripción: eso vive en
 * el escaparate. En escritorio se posiciona como tarjeta flotante desde
 * fuera, por eso recibe `className`.
 */
export default function Panel({
	product,
	className,
}: {
	product: Product;
	className?: string;
}) {
	const colores = product.colors ?? [];
	const tallas = product.sizes ?? [];

	const [color, setColor] = useState(0);
	const [talla, setTalla] = useState(0);
	const [cantidad, setCantidad] = useState(30);
	const [otra, setOtra] = useState("");

	const unitario = porPieza(product);
	const dias = product.production?.meta?.diasProduccion;

	const garantias = [
		"Sin mínimos",
		"Mockup antes de pagar",
		dias ? `Entrega en ${dias} días` : "Envío a todo México",
	];

	function elegirCantidad(n: number) {
		setCantidad(n);
		setOtra("");
	}

	function escribirOtra(valor: string) {
		setOtra(valor);
		const n = Number.parseInt(valor, 10);
		if (Number.isFinite(n) && n > 0) setCantidad(n);
	}

	return (
		<div className={`flex flex-col gap-[22px] md:gap-6 ${className ?? ""}`}>
			{product.pricing && (
				<div className="flex items-baseline gap-2.5 border-b-[1.5px] border-tinta pb-5 md:border-b-0 md:pb-0">
					<span className="font-display text-[38px] font-extrabold leading-none tracking-[-0.021em] text-tinta md:text-[44px]">
						{pesos(product.pricing.basePrice)}
					</span>
					<span className="text-sm text-tinta md:text-[15px]">
						por pieza · desde 1
					</span>
				</div>
			)}

			{colores.length > 0 && (
				<div className="flex flex-col gap-3">
					<div className="flex items-baseline justify-between gap-3">
						<span className="text-[15px] font-semibold text-tinta">Color</span>
						<span className="text-[13px] text-tinta md:text-sm">
							{colores[color]?.name}
						</span>
					</div>
					<div className="flex items-center gap-3">
						{colores.map((c, i) => (
							<button
								key={c.hex + c.name}
								type="button"
								onClick={() => setColor(i)}
								aria-label={c.name}
								aria-pressed={i === color}
								style={{ background: c.hex }}
								className={`h-[38px] w-[38px] rounded-full ${
									i === color
										? "shadow-[0_0_0_2px_var(--color-hueso),0_0_0_4px_var(--color-tinta)]"
										: ""
								}`}
							/>
						))}
					</div>
				</div>
			)}

			{tallas.length > 0 && (
				<div className="flex flex-col gap-3">
					<div className="flex items-baseline justify-between gap-3">
						<span className="text-[15px] font-semibold text-tinta">Talla</span>
						<a href="#medidas" className="text-[13px] text-tinta md:text-sm">
							Ver medidas
						</a>
					</div>
					<div className="flex items-center gap-2">
						{tallas.map((t, i) => (
							<Pastilla
								key={t.size}
								activo={i === talla}
								onClick={() => setTalla(i)}
								className="flex-1"
							>
								{t.size}
							</Pastilla>
						))}
					</div>
				</div>
			)}

			<div className="flex flex-col gap-3">
				<span className="text-[15px] font-semibold text-tinta">
					¿Cuántas piezas?
				</span>
				<div className="flex items-center gap-2">
					{CANTIDADES.map((n) => (
						<Pastilla
							key={n}
							activo={!otra && cantidad === n}
							onClick={() => elegirCantidad(n)}
							className="flex-1"
						>
							{n}
						</Pastilla>
					))}
					<input
						type="number"
						min={1}
						value={otra}
						onChange={(e) => escribirOtra(e.target.value)}
						placeholder="Otra"
						aria-label="Otra cantidad"
						className="h-[46px] w-[74px] shrink-0 rounded-full border-[1.5px] border-tinta/15 bg-transparent px-3 text-center text-[15px] font-medium text-tinta outline-none placeholder:text-tinta/60 focus:border-tinta"
					/>
				</div>
			</div>

			{unitario !== null && (
				<div className="flex items-baseline justify-between gap-4 border-t border-tinta/14 pt-[18px]">
					<div className="flex flex-col gap-1">
						<span className="text-sm text-tinta">
							{cantidad} {cantidad === 1 ? "pieza" : "piezas"} · 1 lado · 1
							diseño
						</span>
						<span className="text-xs text-tinta/60">
							Estimado. Se cierra en el editor.
						</span>
					</div>
					<span className="font-display text-[28px] font-extrabold leading-none tracking-[-0.021em] text-tinta md:text-[30px]">
						{pesos(unitario * cantidad)}
					</span>
				</div>
			)}

			<div className="flex flex-col gap-3.5">
				<Link
					href={`/design/${product.id}`}
					className="flex h-14 items-center justify-center gap-2.5 rounded-full bg-tinta text-[17px] font-semibold text-lima md:h-15"
				>
					Diseñar {esteProducto(product.name)}
					<Chevron className="md:h-4 md:w-4" />
				</Link>

				<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
					{garantias.map((g) => (
						<span
							key={g}
							className="flex items-center gap-[7px] text-[13px] font-medium text-tinta"
						>
							<Palomita />
							{g}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}

/** "Playera manga larga" → "esta playera": el botón nombra la pieza, no el SKU. */
function esteProducto(nombre: string) {
	const primera = nombre.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
	const femenino = /a$/.test(primera);
	return `${femenino ? "esta" : "este"} ${primera}`;
}

function Pastilla({
	activo,
	onClick,
	className,
	children,
}: {
	activo: boolean;
	onClick: () => void;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={activo}
			className={`flex h-[46px] items-center justify-center rounded-full px-3 text-[15px] ${
				activo
					? "bg-lima font-semibold text-tinta"
					: "border-[1.5px] border-tinta/15 font-medium text-tinta"
			} ${className ?? ""}`}
		>
			{children}
		</button>
	);
}
