"use client";

import type { Tarifa } from "@/lib/api/envios";
import { destacadas } from "@/lib/api/envios";

/**
 * Elegir paquetería, sin convertirlo en una tabla.
 *
 * Skydropx devuelve hasta ocho servicios y entre el primero y el último hay
 * catorce veces de diferencia de precio. Enseñarlos todos vuelve ilegible una
 * decisión que en realidad tiene dos ejes: cuánto cuesta y cuánto tarda. Por
 * eso salen dos —la más barata y la más rápida— y el resto detrás de un
 * "ver todas" para quien de verdad quiera comparar.
 */
export function Envio({
	estado,
	tarifas,
	elegida,
	onElegir,
	verTodas,
	onVerTodas,
}: {
	estado: "inactivo" | "cotizando" | "listo" | "sin-envio" | "error";
	tarifas: Tarifa[];
	elegida: Tarifa | null;
	onElegir: (t: Tarifa) => void;
	verTodas: boolean;
	onVerTodas: () => void;
}) {
	if (estado === "inactivo") return null;

	if (estado === "sin-envio") {
		return (
			<Aviso
				titulo="Este taller no envía todavía"
				texto="Puedes recoger tu pedido con él: elige “Recoger con el taller” arriba y acuerdan punto y hora."
			/>
		);
	}

	if (estado === "error") {
		return (
			<Aviso
				titulo="No pudimos cotizar el envío ahora"
				texto="Revisa que el código postal esté bien. Si sigue fallando, puedes recoger con el taller."
			/>
		);
	}

	if (estado === "cotizando" && tarifas.length === 0) {
		return (
			<div className="flex items-center gap-3 rounded-lg border border-tinta/12 bg-gris px-4 py-3.5">
				<Girando />
				<span className="text-[14px] text-tinta/70">
					Buscando paqueterías para tu código postal…
				</span>
			</div>
		);
	}

	// Mientras siguen llegando se enseñan las que ya están: cinco segundos con
	// la pantalla vacía se sienten rotos, y con opciones se sienten rápidos.
	const visibles = verTodas ? tarifas : destacadas(tarifas);
	const etiquetas = etiquetar(tarifas);

	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-baseline justify-between gap-3">
				<span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-tinta/55">
					Cómo te lo mandamos
				</span>
				{estado === "cotizando" && (
					<span className="flex items-center gap-1.5 text-[12px] text-tinta/50">
						<Girando pequeno />
						buscando más
					</span>
				)}
			</div>

			{visibles.map((t) => (
				<button
					key={t.id}
					type="button"
					onClick={() => onElegir(t)}
					aria-pressed={elegida?.id === t.id}
					className={`flex items-center justify-between gap-4 rounded-lg px-4 py-3.5 text-left transition-colors ${
						elegida?.id === t.id
							? "border-[1.5px] border-tinta bg-hueso"
							: "border border-tinta/15 hover:border-tinta/40"
					}`}
				>
					<span className="flex min-w-0 flex-col gap-0.5">
						<span className="flex items-center gap-2">
							<span className="truncate text-[15px] font-semibold text-tinta">
								{t.paqueteria}
							</span>
							{etiquetas[t.id] && (
								<span className="shrink-0 rounded-full bg-lima px-2 py-0.5 text-[11px] font-semibold text-tinta">
									{etiquetas[t.id]}
								</span>
							)}
						</span>
						<span className="truncate text-[13px] text-tinta/60">
							{t.servicio}
							{t.dias !== null &&
								` · ${t.dias} ${t.dias === 1 ? "día hábil" : "días hábiles"}`}
						</span>
					</span>
					<span className="shrink-0 font-display text-[17px] font-bold text-tinta">
						${t.precio.toLocaleString("es-MX")}
					</span>
				</button>
			))}

			{!verTodas && tarifas.length > visibles.length && (
				<button
					type="button"
					onClick={onVerTodas}
					className="self-start text-[13px] font-semibold text-tinta underline underline-offset-2"
				>
					Ver las {tarifas.length} opciones
				</button>
			)}
		</div>
	);
}

/** "Más barata" y "Más rápida", sólo cuando son dos distintas. */
function etiquetar(tarifas: Tarifa[]): Record<string, string> {
	const dos = destacadas(tarifas);
	if (dos.length < 2) return {};
	return { [dos[0].id]: "Más barata", [dos[1].id]: "Más rápida" };
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
	return (
		<div className="rounded-lg border border-tinta/15 bg-gris p-4">
			<p className="font-display text-[14px] font-semibold text-tinta">
				{titulo}
			</p>
			<p className="pt-1 text-[13px] leading-[21px] text-tinta/65">{texto}</p>
		</div>
	);
}

function Girando({ pequeno = false }: { pequeno?: boolean }) {
	const n = pequeno ? 13 : 17;
	return (
		<svg
			width={n}
			height={n}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			className="shrink-0 animate-spin text-tinta/50"
		>
			<circle
				cx="12"
				cy="12"
				r="9"
				stroke="currentColor"
				strokeWidth="2.6"
				opacity="0.3"
			/>
			<path
				d="M21 12a9 9 0 0 0-9-9"
				stroke="currentColor"
				strokeWidth="2.6"
				strokeLinecap="round"
			/>
		</svg>
	);
}
