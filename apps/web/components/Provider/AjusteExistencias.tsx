"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	moverExistencias,
	type OperacionExistencias,
	type ProductoDeTaller,
} from "@/lib/api/proveedores";

/**
 * Mover las existencias de una variante, con un paso de por medio.
 *
 * Antes eran casillas sueltas con un "Guardar" al final: se tecleaba un número
 * y se podía salir de la pantalla creyendo que había quedado. Aquí hay que
 * elegir QUÉ se hace, escribir CUÁNTO, ver el resultado antes de confirmar, y
 * al confirmar se guarda de inmediato y sale un toast. Es más lento a
 * propósito: el inventario es lo que decide qué se le promete al comprador.
 *
 * Las tres operaciones no son adorno. Agregar y quitar son movimientos —llegó
 * mercancía, se mermó— y por eso van como delta, que el servidor suma de forma
 * atómica y no se pisa con el descuento de un pedido. Corregir es un recuento
 * físico: escribe el número tal cual, porque "los conté y hay 14" no es una
 * diferencia, es un hecho.
 */

export type Variante = {
	producto: ProductoDeTaller;
	clave: string;
	color: string | null;
	talla: string;
	cantidad: number;
};

const OPERACIONES: {
	valor: OperacionExistencias;
	etiqueta: string;
	ayuda: string;
}[] = [
	{ valor: "agregar", etiqueta: "Agregar", ayuda: "Llegó mercancía" },
	{ valor: "quitar", etiqueta: "Quitar", ayuda: "Merma o uso aparte" },
	{ valor: "corregir", etiqueta: "Corregir", ayuda: "Los conté" },
];

export function AjusteExistencias({
	variante,
	onCerrar,
	onGuardado,
}: {
	variante: Variante | null;
	onCerrar: () => void;
	onGuardado: (producto: ProductoDeTaller) => void;
}) {
	const [operacion, setOperacion] = useState<OperacionExistencias>("agregar");
	const [cantidad, setCantidad] = useState("");
	const [guardando, setGuardando] = useState(false);

	// Cada variante abre el diálogo limpio. Sin esto, el número de la anterior
	// sigue puesto y se confirma un movimiento que nadie quiso.
	//
	// `guardando` se reinicia AQUÍ y no sólo al terminar de guardar: cuando el
	// guardado sale bien se cierra el diálogo, pero el componente no se
	// desmonta —devuelve null—, así que un `true` que no se limpie sobrevive y
	// el siguiente ajuste abre con el botón bloqueado en "Guardando…" para
	// siempre. Funciona la primera vez y se rompe la segunda.
	useEffect(() => {
		if (variante) {
			setOperacion("agregar");
			setCantidad("");
			setGuardando(false);
		}
	}, [variante]);

	if (!variante) return null;

	const n = Number(cantidad);
	const valida = cantidad !== "" && Number.isFinite(n) && Number.isInteger(n);
	const listo =
		valida && (operacion === "corregir" ? n >= 0 : n > 0) && !guardando;

	const resultado =
		operacion === "corregir"
			? n
			: operacion === "quitar"
				? variante.cantidad - n
				: variante.cantidad + n;

	const nombre = variante.color
		? `${variante.color} · ${variante.talla}`
		: variante.talla;

	async function confirmar() {
		if (!listo || !variante) return;
		setGuardando(true);

		try {
			const producto = await moverExistencias(variante.producto.id, {
				clave: variante.clave,
				operacion,
				cantidad: n,
			});

			// El número del toast sale de la RESPUESTA, no de lo que calculamos
			// aquí: si un pedido descontó mientras tanto, lo que vale es lo que
			// quedó en la base. Decir otra cosa sería mentir con confianza.
			const quedaron = Number(
				(producto.existencias ?? {})[variante.clave] ?? 0,
			);

			toast.success(`${nombre} · ${variante.producto.name}`, {
				description:
					quedaron < 0
						? `Quedó en ${quedaron}: te faltan ${Math.abs(quedaron)} por comprar.`
						: `Ahora tienes ${quedaron}.`,
			});

			onGuardado(producto);
			onCerrar();
		} catch (error) {
			toast.error("No se pudo actualizar", {
				description:
					error instanceof Error
						? error.message
						: "Inténtalo otra vez en un momento.",
			});
			setGuardando(false);
		}
	}

	return (
		<Dialog open onOpenChange={(abierto) => !abierto && !guardando && onCerrar()}>
			<DialogContent className="font-brand gap-0 rounded-xl border-tinta/12 bg-white p-0 sm:max-w-[420px]">
				<DialogHeader className="gap-1.5 border-b border-tinta/12 px-6 py-5 text-left">
					<DialogTitle className="font-display text-[20px] font-semibold leading-7 tracking-[-0.028em] text-tinta">
						Ajustar existencias
					</DialogTitle>
					<DialogDescription className="text-[14px] leading-[21px] text-tinta/65">
						{variante.producto.name} — <strong className="font-semibold text-tinta">{nombre}</strong>
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-5 px-6 py-5">
					<div className="flex items-baseline gap-2">
						<span className="text-[13px] text-tinta/60">Tienes ahora</span>
						<span className="font-mono text-[22px] font-semibold text-tinta">
							{variante.cantidad}
						</span>
					</div>

					<fieldset className="flex flex-col gap-2">
						<legend className="pb-2 text-[13px] font-semibold text-tinta">
							¿Qué pasó?
						</legend>
						<div className="grid grid-cols-3 gap-2">
							{OPERACIONES.map((o) => (
								<button
									key={o.valor}
									type="button"
									onClick={() => setOperacion(o.valor)}
									aria-pressed={operacion === o.valor}
									className={`flex flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
										operacion === o.valor
											? "border-[1.5px] border-tinta bg-hueso"
											: "border border-tinta/15 hover:border-tinta/35"
									}`}
								>
									<span className="text-[14px] font-semibold text-tinta">
										{o.etiqueta}
									</span>
									<span className="text-[11px] leading-tight text-tinta/55">
										{o.ayuda}
									</span>
								</button>
							))}
						</div>
					</fieldset>

					<label className="flex flex-col gap-2">
						<span className="text-[13px] font-semibold text-tinta">
							{operacion === "corregir" ? "¿Cuántas hay?" : "¿Cuántas?"}
						</span>
						<input
							type="number"
							inputMode="numeric"
							autoFocus
							min={operacion === "corregir" ? 0 : 1}
							value={cantidad}
							onChange={(e) => setCantidad(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && confirmar()}
							className="h-12 w-full rounded-lg border-[1.5px] border-tinta/18 bg-white px-3.5 text-center font-mono text-[18px] text-tinta outline-none focus:border-tinta focus:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]"
						/>
					</label>

					{/* La vista previa es la mitad del punto de este diálogo: se
					    confirma un resultado, no una operación abstracta. */}
					<div
						className={`flex items-center justify-between rounded-lg px-4 py-3 ${
							valida ? "bg-hueso" : "bg-gris"
						}`}
					>
						<span className="text-[13px] text-tinta/65">Quedará en</span>
						<span
							className={`font-mono text-[20px] font-semibold ${
								valida && resultado < 0 ? "text-[#c0392b]" : "text-tinta"
							}`}
						>
							{valida ? resultado : "—"}
						</span>
					</div>

					{valida && resultado < 0 && (
						<p className="-mt-2 text-[13px] leading-[20px] text-tinta/65">
							Queda en negativo. No es un error: significa que ya vendiste{" "}
							{Math.abs(resultado)} que tienes que comprar.
						</p>
					)}
				</div>

				<div className="flex items-center justify-end gap-2 border-t border-tinta/12 px-6 py-4">
					<button
						type="button"
						onClick={onCerrar}
						disabled={guardando}
						className="h-11 rounded-lg px-4 text-[15px] font-medium text-tinta/60 hover:text-tinta disabled:opacity-40"
					>
						Cancelar
					</button>
					<button
						type="button"
						onClick={confirmar}
						disabled={!listo}
						className="h-11 rounded-lg bg-tinta px-5 text-[15px] font-semibold text-lima disabled:bg-tinta/14 disabled:text-tinta/40"
					>
						{guardando ? "Guardando…" : "Confirmar"}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
