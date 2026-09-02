"use client";

import type { ReactNode } from "react";

/**
 * Un paso del checkout.
 *
 * Sólo uno está abierto a la vez. Los ya resueltos se pliegan a una línea con
 * "Editar" y los que faltan quedan en gris: es lo que evita que la pantalla
 * sea un formulario de veinte campos donde nadie sabe qué le falta.
 *
 * El plegado es de presentación, no de datos: lo capturado sigue en el estado
 * de la página, así que abrir y cerrar pasos no pierde nada.
 */
export function Paso({
	numero,
	titulo,
	abierto,
	completado,
	resumen,
	onEditar,
	children,
}: {
	numero: number;
	titulo: string;
	abierto: boolean;
	completado: boolean;
	/** Lo que se ve cuando está plegado: lo que la persona ya decidió. */
	resumen?: ReactNode;
	onEditar: () => void;
	children: ReactNode;
}) {
	return (
		<section className="border-t border-tinta/12 py-7 first:border-t-0 first:pt-0">
			<div className="flex items-baseline justify-between gap-4">
				<h2
					className={`font-display text-[19px] font-bold uppercase tracking-[0.02em] md:text-[22px] ${
						abierto || completado ? "text-tinta" : "text-tinta/35"
					}`}
				>
					<span className="pr-2.5 text-tinta/40">{numero}</span>
					{titulo}
				</h2>

				{completado && !abierto && (
					<button
						type="button"
						onClick={onEditar}
						className="shrink-0 text-[13px] font-semibold text-tinta underline underline-offset-4"
					>
						Editar
					</button>
				)}
			</div>

			{abierto ? (
				<div className="pt-5">{children}</div>
			) : completado && resumen ? (
				<div className="pt-2 text-[14px] leading-[22px] text-tinta/65">
					{resumen}
				</div>
			) : null}
		</section>
	);
}
