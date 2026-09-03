"use client";

import { ArrowRight, Layers, PackageCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useDatosDelPanel } from "./datos";
import { Cargando } from "./piezas";

export default function Inicio() {
	const { pedidos, disenos } = useDatosDelPanel();
	if (!pedidos || !disenos) return <Cargando />;

	const activos = pedidos.filter(
		(pedido) => !["entregado", "cancelado"].includes(pedido.estado),
	).length;

	return (
		<div className="flex max-w-[1100px] flex-col gap-7">
			<div className="grid gap-3 sm:grid-cols-3">
				<Resumen Icono={PackageCheck} etiqueta="Pedidos activos" valor={activos} />
				<Resumen Icono={ShoppingBag} etiqueta="Pedidos totales" valor={pedidos.length} />
				<Resumen Icono={Layers} etiqueta="Diseños guardados" valor={disenos.length} />
			</div>

			<div className="grid gap-3 md:grid-cols-2">
				<Acceso
					titulo="Revisa tus pedidos"
					texto="Consulta avances, rastreo y detalles de producción."
					href="/cuenta?s=pedidos"
				/>
				<Acceso
					titulo="Crea algo nuevo"
					texto="Explora el catálogo y empieza un diseño."
					href="/cuenta?s=catalogo"
				/>
			</div>
		</div>
	);
}

function Resumen({ Icono, etiqueta, valor }: { Icono: typeof ShoppingBag; etiqueta: string; valor: number }) {
	return (
		<div className="rounded-2xl border border-tinta/8 bg-[#f7f7f6] p-5">
			<Icono className="size-5 text-tinta/45" aria-hidden />
			<p className="mt-5 font-display text-[28px] font-semibold text-tinta tabular-nums">{valor}</p>
			<p className="text-[13px] text-tinta/50">{etiqueta}</p>
		</div>
	);
}

function Acceso({ titulo, texto, href }: { titulo: string; texto: string; href: string }) {
	return (
		<Link href={href} className="group flex items-center justify-between gap-5 rounded-2xl border border-tinta/10 bg-white p-5 hover:bg-[#f7f7f6]">
			<div>
				<p className="text-[15px] font-semibold text-tinta">{titulo}</p>
				<p className="mt-1 text-[13px] text-tinta/50">{texto}</p>
			</div>
			<ArrowRight className="size-5 shrink-0 text-tinta/35 transition-transform group-hover:translate-x-0.5" aria-hidden />
		</Link>
	);
}
