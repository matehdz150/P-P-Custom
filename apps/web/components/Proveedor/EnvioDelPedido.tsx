"use client";

import { ExternalLink, Package, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	comprarGuia,
	type PaqueteMedido,
	type Pedido,
	refrescarGuia,
} from "@/lib/api/pedidos";

/**
 * El envío, desde el panel del taller.
 *
 * Es la única pantalla desde la que se compra una guía, y compra de verdad:
 * mueve dinero en la cuenta de la paquetería. De ahí salen casi todas las
 * decisiones de aquí.
 *
 * SE PIDEN LAS MEDIDAS REALES, NO SE REUSA LA COTIZACIÓN DEL CHECKOUT. Aquélla
 * salió de un peso estimado. La API vuelve a cotizar con lo que el taller
 * acaba de medir; si no, la paquetería repesa el paquete y factura la
 * diferencia semanas después.
 *
 * LA ETIQUETA NO ESTÁ LISTA AL COMPRAR. El envío nace sin etiqueta ni número
 * de rastreo y cada paquetería tarda lo suyo —con ampm fueron minutos—. Por
 * eso hay un sondeo con tope en vez de una espera dentro de la Lambda, que
 * habría muerto por timeout DESPUÉS de pagar el envío.
 */

/** Cada cuánto se vuelve a preguntar por la etiqueta. */
const CADA_MS = 5000;

/**
 * Cuántas veces. Ocho intentos son unos 40 segundos: pasado eso deja de
 * preguntar solo y ofrece el botón. Sondear indefinidamente con la pestaña
 * abierta gasta invocaciones para siempre si la paquetería se atoró.
 */
const INTENTOS_MAX = 8;

const CAMPOS: {
	clave: keyof PaqueteMedido;
	etiqueta: string;
	unidad: string;
}[] = [
	{ clave: "peso", etiqueta: "Peso", unidad: "kg" },
	{ clave: "largo", etiqueta: "Largo", unidad: "cm" },
	{ clave: "ancho", etiqueta: "Ancho", unidad: "cm" },
	{ clave: "alto", etiqueta: "Alto", unidad: "cm" },
];

export function EnvioDelPedido({
	pedido,
	onCambio,
}: {
	pedido: Pedido;
	onCambio: () => Promise<void>;
}) {
	const [medidas, setMedidas] = useState<Record<string, string>>({});
	const [comprando, setComprando] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const guia = pedido.guia;
	const envio = pedido.envio;

	/* Tres situaciones distintas y hay que separarlas: el envío murió (no va a
	   llegar nada, se puede reintentar), está en camino de generarse, o ya
	   está. Antes las dos primeras se veían igual y el panel esperaba una
	   etiqueta que nunca iba a existir. */
	const murio = guia?.estado === "error";
	const faltaEtiqueta = !!guia?.envioId && !guia.etiquetaUrl && !murio;

	/* ─── El sondeo de la etiqueta ──────────────────────────────────────── */

	const [buscando, setBuscando] = useState(false);
	const [seRindio, setSeRindio] = useState(false);
	const intentos = useRef(0);

	const comprobar = useCallback(async () => {
		if (!pedido.guia?.envioId) return;

		setBuscando(true);
		try {
			const r = await refrescarGuia(pedido.id);
			// Se recarga si hay etiqueta O si el envío murió: las dos son
			// novedades que cambian la pantalla. Sin esto un sondeo repintaría
			// la lista de pedidos sin motivo.
			if (r.lista || r.fallo) await onCambio();
		} catch {
			// Un sondeo que falla no es un error del pedido: la guía ya se compró.
		} finally {
			setBuscando(false);
		}
	}, [pedido.id, pedido.guia?.envioId, onCambio]);

	useEffect(() => {
		if (!faltaEtiqueta || seRindio) return;

		const t = setInterval(() => {
			intentos.current += 1;
			if (intentos.current > INTENTOS_MAX) {
				setSeRindio(true);
				return;
			}
			void comprobar();
		}, CADA_MS);

		return () => clearInterval(t);
	}, [faltaEtiqueta, seRindio, comprobar]);

	/* ─── Comprar ───────────────────────────────────────────────────────── */

	const completas = CAMPOS.every((c) => Number(medidas[c.clave]) > 0);

	async function comprar() {
		if (comprando || !completas) return;

		setError(null);
		setComprando(true);

		try {
			await comprarGuia(pedido.id, {
				peso: Number(medidas.peso),
				largo: Number(medidas.largo),
				ancho: Number(medidas.ancho),
				alto: Number(medidas.alto),
			});
			await onCambio();
		} catch (e) {
			const status = (e as { status?: number })?.status;

			// 409 es "ya tiene guía": alguien la compró desde otra pestaña. No es
			// un fallo que haya que enseñar como tal; se recarga y aparece.
			if (status === 409) {
				await onCambio();
			} else {
				setError(e instanceof Error ? e.message : "No pudimos comprar la guía");
			}
		} finally {
			setComprando(false);
		}
	}

	/* ─── Lo que se ve ──────────────────────────────────────────────────── */

	if (pedido.entrega?.metodo === "recoger") {
		return (
			<p className="text-[14px] leading-[22px] text-tinta/60">
				Este pedido lo recoge el cliente contigo: no lleva guía.
			</p>
		);
	}

	if (!envio?.tarifaId && !guia) {
		return (
			<p className="text-[14px] leading-[22px] text-tinta/60">
				Este pedido no trae envío cotizado.
			</p>
		);
	}

	return (
		<div className="space-y-4">
			{/* Lo que el cliente eligió y pagó. Va primero porque es lo que
			    condiciona todo: la guía se compra con ESA paquetería. */}
			{envio && (
				<div className="flex items-start justify-between gap-4 rounded-lg border border-tinta/12 bg-white p-4">
					<div className="min-w-0">
						<p className="flex items-center gap-1.5 text-[14px] font-semibold text-tinta">
							<Truck size={15} />
							{envio.paqueteria} · {envio.servicio}
						</p>
						<p className="pt-0.5 text-[13px] text-tinta/55">
							El cliente pagó ${Number(envio.precio).toLocaleString("es-MX")}
							{envio.diasEstimados ? ` · ${envio.diasEstimados} días` : ""}
						</p>
					</div>
				</div>
			)}

			{murio && guia ? <Murio guia={guia} /> : null}

			{!guia || murio ? (
				<Formulario
					medidas={medidas}
					setMedidas={setMedidas}
					completas={completas}
					comprando={comprando}
					onComprar={comprar}
				/>
			) : (
				<Comprada
					guia={guia}
					real={envio?.real ?? null}
					faltaEtiqueta={faltaEtiqueta}
					buscando={buscando}
					seRindio={seRindio}
					onComprobar={() => {
						setSeRindio(false);
						intentos.current = 0;
						void comprobar();
					}}
				/>
			)}

			{error && (
				<p role="alert" className="text-[13px] leading-[19px] text-[#c0392b]">
					{error}
				</p>
			)}
		</div>
	);
}

/**
 * El envío murió del lado de la paquetería.
 *
 * Se dice tal cual, con el motivo y con que el cobro se reembolsó, porque lo
 * contrario —"está tardando"— tuvo a un pedido esperando una etiqueta que no
 * iba a llegar nunca. Debajo reaparece el formulario: reintentar es lo único
 * que se puede hacer, y la API ya lo permite cuando el anterior falló.
 */
function Murio({ guia }: { guia: NonNullable<Pedido["guia"]> }) {
	return (
		<div className="rounded-lg border-[1.5px] border-[#c0392b]/35 bg-[#c0392b]/5 p-4">
			<p className="font-display text-[14px] font-semibold text-[#c0392b]">
				El envío falló y no se generó etiqueta
			</p>
			<p className="pt-1 text-[13px] leading-[20px] text-tinta/70">
				La paquetería lo rechazó. El cobro se reembolsó, así que puedes volver a
				intentarlo aquí abajo.
			</p>

			{guia.error && (
				<p className="mt-2.5 rounded-md bg-white px-2.5 py-2 font-mono text-[11px] leading-[16px] break-words text-tinta/60">
					{guia.error}
				</p>
			)}
		</div>
	);
}

function Formulario({
	medidas,
	setMedidas,
	completas,
	comprando,
	onComprar,
}: {
	medidas: Record<string, string>;
	setMedidas: (
		f: (m: Record<string, string>) => Record<string, string>,
	) => void;
	completas: boolean;
	comprando: boolean;
	onComprar: () => void;
}) {
	return (
		<div className="rounded-lg border border-tinta/12 bg-gris p-4">
			<p className="flex items-center gap-1.5 font-display text-[14px] font-semibold text-tinta">
				<Package size={15} />
				Mide el paquete ya armado
			</p>
			<p className="pt-1 text-[13px] leading-[20px] text-tinta/60">
				Con estas medidas se vuelve a cotizar y se compra la guía. Si el paquete
				pesa más de lo que se cobró, la diferencia queda a tu cargo.
			</p>

			<div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
				{CAMPOS.map((c) => (
					<label key={c.clave} className="flex flex-col gap-1.5">
						<span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-tinta/60">
							{c.etiqueta} <span className="text-tinta/40">({c.unidad})</span>
						</span>
						<input
							type="number"
							min={0}
							step="0.01"
							inputMode="decimal"
							value={medidas[c.clave] ?? ""}
							onChange={(e) =>
								setMedidas((m) => ({ ...m, [c.clave]: e.target.value }))
							}
							className="h-11 rounded-lg border-[1.5px] border-tinta/20 bg-white px-3 text-[15px] text-tinta outline-none focus:border-tinta"
						/>
					</label>
				))}
			</div>

			<button
				type="button"
				onClick={onComprar}
				disabled={!completas || comprando}
				className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-tinta text-[15px] font-semibold text-lima disabled:opacity-45"
			>
				{comprando ? "Comprando la guía…" : "Comprar guía"}
			</button>

			{comprando && (
				<p className="pt-2 text-center text-[12px] leading-[18px] text-tinta/50">
					Tarda unos segundos. No cierres esta ventana ni vuelvas a apretar: se
					compraría dos veces.
				</p>
			)}
		</div>
	);
}

function Comprada({
	guia,
	real,
	faltaEtiqueta,
	buscando,
	seRindio,
	onComprobar,
}: {
	guia: NonNullable<Pedido["guia"]>;
	real: NonNullable<Pedido["envio"]>["real"];
	faltaEtiqueta: boolean;
	buscando: boolean;
	seRindio: boolean;
	onComprobar: () => void;
}) {
	return (
		<div className="rounded-lg border border-tinta/12 bg-white p-4">
			{faltaEtiqueta ? (
				<>
					<p className="font-display text-[14px] font-semibold text-tinta">
						Guía comprada · generando la etiqueta
					</p>
					<p className="pt-1 text-[13px] leading-[20px] text-tinta/60">
						{seRindio
							? "La paquetería está tardando más de lo normal. La guía ya está pagada: vuelve a comprobar en un rato."
							: "La paquetería la está preparando. Aparece sola en cuanto esté."}
					</p>

					<button
						type="button"
						onClick={onComprobar}
						disabled={buscando}
						className="mt-3 flex h-10 items-center justify-center rounded-lg border-[1.5px] border-tinta/20 px-4 text-[13px] font-semibold text-tinta disabled:opacity-50"
					>
						{buscando ? "Comprobando…" : "Comprobar ahora"}
					</button>
				</>
			) : (
				<>
					<p className="font-display text-[14px] font-semibold text-tinta">
						Etiqueta lista
					</p>

					{guia.rastreo && (
						<p className="pt-1 font-mono text-[13px] text-tinta/70">
							{guia.rastreo}
						</p>
					)}

					<div className="flex flex-wrap gap-2.5 pt-3">
						{/* Se abre en otra pestaña y no se fuerza la descarga: la
						    etiqueta la sirve la paquetería desde SU dominio, y ahí el
						    navegador ignora el atributo `download`. Prometer "descargar"
						    y abrir una pestaña es peor que decirlo. */}
						<a
							href={guia.etiquetaUrl ?? "#"}
							target="_blank"
							rel="noreferrer"
							className="flex h-10 items-center gap-1.5 rounded-lg bg-tinta px-4 text-[13px] font-semibold text-lima"
						>
							Abrir etiqueta
							<ExternalLink size={13} />
						</a>

						{guia.rastreoUrl && (
							<a
								href={guia.rastreoUrl}
								target="_blank"
								rel="noreferrer"
								className="flex h-10 items-center gap-1.5 rounded-lg border-[1.5px] border-tinta/20 px-4 text-[13px] font-semibold text-tinta"
							>
								Ver rastreo
								<ExternalLink size={13} />
							</a>
						)}
					</div>
				</>
			)}

			{/* Lo que costó de verdad. Se enseña aunque no haya diferencia: un
			    cargo que aparece sólo cuando duele parece un castigo escondido. */}
			{real && (
				<dl className="mt-4 space-y-1 border-t border-tinta/12 pt-3 text-[13px]">
					<div className="flex justify-between gap-4">
						<dt className="text-tinta/55">Medido</dt>
						<dd className="font-mono text-tinta/80">
							{real.peso} kg · {real.largo}×{real.ancho}×{real.alto} cm
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-tinta/55">Costó</dt>
						<dd className="font-mono text-tinta/80">
							${Number(real.costo).toLocaleString("es-MX")}
						</dd>
					</div>
					{Number(real.diferencia) !== 0 && (
						<div className="flex justify-between gap-4">
							<dt className="text-tinta/55">
								{Number(real.diferencia) > 0 ? "A tu cargo" : "A favor"}
							</dt>
							<dd
								className={`font-mono font-semibold ${
									Number(real.diferencia) > 0 ? "text-[#c0392b]" : "text-tinta"
								}`}
							>
								${Math.abs(Number(real.diferencia)).toLocaleString("es-MX")}
							</dd>
						</div>
					)}
				</dl>
			)}
		</div>
	);
}
