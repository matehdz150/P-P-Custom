"use client";

import Link from "next/link";

/** Las piezas que repiten las cuatro secciones del panel. */

/** Claves fijas: con el índice, la lista se rehace entera en cada render. */
const ESQUELETOS = ["uno", "dos", "tres"];

export function Cargando() {
	return (
		<div className="flex flex-col gap-3">
			{ESQUELETOS.map((clave) => (
				<div
					key={clave}
					className="h-[88px] animate-pulse rounded-xl bg-gris"
				/>
			))}
		</div>
	);
}

export function Vacio({
	titulo,
	texto,
	accion,
}: {
	titulo: string;
	texto: string;
	accion?: { texto: string; href: string };
}) {
	return (
		<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-tinta/20 px-6 py-12 text-center">
			<p className="font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
				{titulo}
			</p>
			<p className="max-w-[38ch] text-[15px] leading-[24px] text-tinta/60">
				{texto}
			</p>
			{accion && (
				<Link
					href={accion.href}
					className="mt-3 inline-flex h-11 items-center rounded-full bg-tinta px-5 text-[15px] font-semibold text-lima"
				>
					{accion.texto}
				</Link>
			)}
		</div>
	);
}

export function Aviso({ texto }: { texto: string }) {
	return (
		<div
			role="alert"
			className="rounded-xl border border-[rgba(192,57,43,0.35)] bg-[rgba(192,57,43,0.07)] p-4 text-[15px] text-tinta"
		>
			{texto}
		</div>
	);
}
