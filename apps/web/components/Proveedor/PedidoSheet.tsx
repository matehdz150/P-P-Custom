"use client";

import { Check, Copy, Download, Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	cambiarEstadoPedido,
	type EstadoPedido,
	ETIQUETA_ESTADO,
	type Pedido,
	siguientesDe,
} from "@/lib/api/pedidos";
import { EnvioDelPedido } from "./EnvioDelPedido";

/**
 * La ficha completa de un pedido, para el taller.
 *
 * Es la pantalla desde la que se produce: aquí están los archivos que van a
 * máquina, a quién se le entrega y por dónde va. Por eso el arte manda —va
 * arriba y ocupa el espacio— y por eso se puede expandir a pantalla completa:
 * revisar un diseño en una columna de 400px no es revisarlo.
 *
 * Los datos NO se piden aquí: vienen del pedido que ya tiene el panel. Una
 * segunda llamada para lo mismo sería otra petición y otro estado que
 * mantener sincronizado.
 */

const TONO: Record<EstadoPedido, string> = {
	nuevo: "bg-lima text-tinta",
	produccion: "bg-lavanda text-tinta",
	listo: "border-[1.5px] border-tinta/25 text-tinta",
	enviado: "bg-tinta text-lima",
	entregado: "bg-tinta/10 text-tinta/70",
	cancelado: "bg-tinta/5 text-tinta/45 line-through",
};

const FECHA_LARGA = new Intl.DateTimeFormat("es-MX", {
	day: "numeric",
	month: "long",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

/** Cuadros: el arte es transparente y sobre un fondo liso se pierde. */
const CUADROS = {
	backgroundImage:
		"linear-gradient(45deg,#e6e4dc 25%,transparent 25%,transparent 75%,#e6e4dc 75%),linear-gradient(45deg,#e6e4dc 25%,transparent 25%,transparent 75%,#e6e4dc 75%)",
	backgroundSize: "16px 16px",
	backgroundPosition: "0 0, 8px 8px",
	backgroundColor: "#faf9f5",
};

export function PedidoSheet({
	pedido,
	abierto,
	onCerrar,
	onCambio,
}: {
	pedido: Pedido | null;
	abierto: boolean;
	onCerrar: () => void;
	onCambio: () => Promise<void>;
}) {
	const [expandido, setExpandido] = useState(false);
	const [moviendo, setMoviendo] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!pedido) return null;

	const siguiente = siguientesDe(pedido).filter((e) => e !== "cancelado")[0];

	async function mover(destino: EstadoPedido) {
		if (!pedido || moviendo) return;
		setMoviendo(true);
		setError(null);

		try {
			await cambiarEstadoPedido(pedido.id, destino);
			await onCambio();
		} catch (e) {
			setError(e instanceof Error ? e.message : "No se pudo mover el pedido");
		} finally {
			setMoviendo(false);
		}
	}

	const artes = pedido.lineas.flatMap((l) =>
		l.arte.map((a) => ({ ...a, lineaId: l.id, producto: l.producto })),
	);

	return (
		<Sheet
			open={abierto}
			onOpenChange={(v) => {
				if (!v) {
					// Se vuelve al ancho normal al cerrar: si no, el siguiente pedido
					// se abre a pantalla completa sin que nadie lo haya pedido.
					setExpandido(false);
					setError(null);
					onCerrar();
				}
			}}
		>
			<SheetContent
				side="right"
				className={`gap-0 overflow-y-auto border-tinta/12 bg-hueso p-0 ${
					expandido ? "w-screen max-w-none" : "w-full sm:max-w-[620px]"
				}`}
			>
				{/* ── Cabecera ───────────────────────────────────────────────── */}
				<div className="sticky top-0 z-10 border-b border-tinta/12 bg-hueso px-6 pt-6 pb-5">
					<button
						type="button"
						onClick={() => setExpandido((v) => !v)}
						aria-label={
							expandido ? "Volver al ancho normal" : "Ver a pantalla completa"
						}
						className="absolute top-4 right-12 rounded-md p-1.5 text-tinta/50 transition-colors hover:bg-tinta/8 hover:text-tinta"
					>
						{expandido ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
					</button>

					<div className="flex items-center gap-3">
						<SheetTitle className="font-mono text-[26px] font-semibold tracking-[-0.02em] text-tinta">
							#{pedido.folio}
						</SheetTitle>
						<span
							className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${TONO[pedido.estado]}`}
						>
							{ETIQUETA_ESTADO[pedido.estado]}
						</span>
					</div>

					<SheetDescription className="pt-1 text-[14px] text-tinta/60">
						{pedido.piezas} {pedido.piezas === 1 ? "pieza" : "piezas"} ·{" "}
						{FECHA_LARGA.format(new Date(pedido.createdAt))}
					</SheetDescription>
				</div>

				{/* Expandido: dos columnas. El arte necesita ancho y los datos no. */}
				<div
					className={
						expandido
							? "grid gap-10 px-6 py-7 lg:grid-cols-[1.25fr_1fr] lg:gap-14"
							: "px-6 py-7"
					}
				>
					<div className="space-y-9">
						<Seccion titulo="Archivos de producción">
							{/* Una tarjeta por lado, a lo ancho: cada una ya trae dos
							    imágenes dentro —dónde va y qué se imprime— y partirlas en
							    columnas las haría ilegibles justo donde hay que mirar con
							    cuidado. */}
							{artes.length === 0 ? (
								<p className="text-[14px] leading-[22px] text-tinta/55">
									Este pedido todavía no tiene arte subido. Si acaba de entrar,
									dale un momento; si sigue así, escríbenos con el folio.
								</p>
							) : (
								<div className="grid gap-4">
									{artes.map((a) => (
										<Arte
											key={`${a.lineaId}-${a.lado}`}
											ruta={a.ruta}
											colocacion={a.colocacion}
											prenda={a.prenda}
											lado={a.lado}
											folio={pedido.folio}
											sangradoCm={a.sangradoCm}
											anchoCm={a.anchoCm}
											altoCm={a.altoCm}
											dpi={a.dpi}
										/>
									))}
								</div>
							)}
						</Seccion>

						<Seccion titulo="Qué se produce">
							<div className="space-y-5">
								{pedido.lineas.map((l) => (
									<div
										key={l.id}
										className="rounded-lg border border-tinta/12 bg-white p-4"
									>
										<p className="font-display text-[15px] font-semibold text-tinta">
											{l.producto}
										</p>

										<dl className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 text-[13px]">
											<Dato
												etiqueta="Color"
												valor={
													l.colorPrenda
														? `${l.colorPrenda}${l.colorPrendaHex ? ` (${l.colorPrendaHex})` : ""}`
														: "—"
												}
											/>
											<Dato etiqueta="Clave" valor={l.sku ?? "—"} />
											<Dato
												etiqueta="Lados"
												valor={l.lados.join(" + ") || "—"}
											/>
											<Dato etiqueta="Piezas" valor={String(l.piezas)} />
											<Dato
												etiqueta="Importe"
												valor={`$${l.importe.toLocaleString("es-MX")}`}
											/>
										</dl>

										<div className="pt-3">
											<p className="pb-1.5 text-[11px] uppercase tracking-[0.06em] text-tinta/45">
												Tallas
											</p>
											<div className="flex flex-wrap gap-1.5">
												{l.tallas.map((t) => (
													<span
														key={t.size}
														className="rounded-md bg-gris px-2.5 py-1 font-mono text-[13px] text-tinta"
													>
														{t.size} × {t.piezas}
													</span>
												))}
											</div>
										</div>
									</div>
								))}

								<div className="flex items-baseline justify-between border-t border-tinta/12 pt-4">
									<span className="text-[14px] text-tinta/65">Total</span>
									<span className="font-display text-[20px] font-bold text-tinta">
										${pedido.total.toLocaleString("es-MX")}
									</span>
								</div>
							</div>
						</Seccion>
					</div>

					<div className="space-y-9">
						<Seccion titulo="Contacto">
							<dl className="space-y-2.5 text-[14px]">
								<Dato etiqueta="Nombre" valor={pedido.comprador.nombre} />
								<Dato
									etiqueta="Correo"
									valor={pedido.comprador.email}
									enlace={`mailto:${pedido.comprador.email}`}
								/>
								{pedido.comprador.whatsapp && (
									<Dato
										etiqueta="WhatsApp"
										valor={pedido.comprador.whatsapp}
										enlace={`https://wa.me/${pedido.comprador.whatsapp.replace(/\D/g, "")}`}
									/>
								)}
							</dl>

							{pedido.comprador.notas && (
								<div className="mt-4 rounded-lg border border-tinta/12 bg-gris p-3.5">
									<p className="pb-1 text-[11px] uppercase tracking-[0.06em] text-tinta/45">
										Nota del cliente
									</p>
									<p className="text-[14px] leading-[22px] text-tinta">
										{pedido.comprador.notas}
									</p>
								</div>
							)}
						</Seccion>

						<Seccion titulo="Entrega">
							<Entrega entrega={pedido.entrega} />
						</Seccion>

						<Seccion titulo="Envío">
							<EnvioDelPedido pedido={pedido} onCambio={onCambio} />
						</Seccion>

						<Seccion titulo="Historial">
							<ol className="space-y-3.5">
								{pedido.bitacora.map((paso, i) => (
									<li
										key={`${paso.estado}-${paso.en}`}
										className="flex gap-3 text-[13px]"
									>
										<span
											className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
												i === pedido.bitacora.length - 1
													? "bg-tinta"
													: "bg-tinta/25"
											}`}
										/>
										<div className="min-w-0">
											<p className="font-semibold text-tinta">
												{ETIQUETA_ESTADO[paso.estado as EstadoPedido] ??
													paso.estado}
												<span className="pl-2 font-normal text-tinta/45">
													{paso.por}
												</span>
											</p>
											<p className="text-tinta/55">
												{FECHA_LARGA.format(new Date(paso.en))}
											</p>
											{paso.nota && (
												<p className="pt-0.5 text-tinta/70">{paso.nota}</p>
											)}
										</div>
									</li>
								))}
							</ol>
						</Seccion>
					</div>
				</div>

				{/* ── Acción ─────────────────────────────────────────────────── */}
				<div className="sticky bottom-0 border-t border-tinta/12 bg-hueso px-6 py-4">
					{error && (
						<p role="alert" className="pb-2.5 text-[13px] text-[#c0392b]">
							{error}
						</p>
					)}

					{siguiente ? (
						<button
							type="button"
							onClick={() => mover(siguiente)}
							disabled={moviendo}
							className="flex h-12 w-full items-center justify-center rounded-lg bg-tinta text-[15px] font-semibold text-lima disabled:opacity-50"
						>
							{moviendo
								? "Moviendo…"
								: `Marcar como ${ETIQUETA_ESTADO[siguiente].toLowerCase()}`}
						</button>
					) : (
						<p className="text-center text-[14px] text-tinta/50">
							Este pedido ya no se mueve.
						</p>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}

/**
 * Un archivo de arte, con su descarga.
 *
 * El `download` funciona porque `/medios/...` se sirve desde nuestro propio
 * origen —el rewrite de `next.config.ts` en desarrollo, CloudFront después—.
 * Desde el origen de S3 el navegador ignoraría el atributo y abriría el PNG
 * en una pestaña, que es justo lo que no quiere quien va a producir.
 */
function Arte({
	ruta,
	colocacion,
	prenda,
	lado,
	folio,
	sangradoCm,
	anchoCm,
	altoCm,
	dpi,
	anchoPx,
	altoPx,
	anchoRealCm,
	altoRealCm,
}: {
	ruta: string;
	colocacion?: string | null;
	/** La prenda REAL con el diseño. Casi nunca existe todavía. */
	prenda?: string | null;
	lado: string;
	folio: string;
	/** Cuánto desborda el archivo por lado, si el taller lo declaró. */
	sangradoCm?: number;
	anchoCm?: number;
	altoCm?: number;
	dpi?: number;
	anchoPx?: number;
	altoPx?: number;
	anchoRealCm?: number;
	altoRealCm?: number;
}) {
	/**
	 * El archivo puede no estar. `subirArchivos` tolera a propósito que una
	 * subida falle —el pedido ya existe y vale más avisar que fingir que no
	 * ocurrió—, así que el taller puede abrir un pedido cuyo arte nunca llegó a
	 * S3. Sin esto se vería un icono de imagen rota y un botón de descarga que
	 * baja una página de error, que es peor que decirlo.
	 */
	const [falta, setFalta] = useState(false);
	const [sinColocacion, setSinColocacion] = useState(false);

	/* La prenda real APARECE SOLA si el archivo está, y no ocupa sitio si no.
	   La ruta se escribe siempre en la línea del pedido —comprobar en el
	   servidor si existe costaría una llamada a S3 por lado y por pedido—, así
	   que aquí se pide y se enseña la casilla sólo cuando carga. Hoy casi
	   ningún producto tiene fotos de prenda: reservarle un hueco vacío en cada
	   tarjeta sería peor que el reflujo de cuando sí llega. */
	const [hayPrenda, setHayPrenda] = useState(false);

	/* Medio centímetro de margen: por debajo es redondeo, por encima es que la
	   plantilla y los centímetros declarados no dicen lo mismo. */
	const desviado =
		!!anchoCm &&
		!!altoCm &&
		!!anchoRealCm &&
		!!altoRealCm &&
		(Math.abs(anchoCm - anchoRealCm) > 0.5 ||
			Math.abs(altoCm - altoRealCm) > 0.5);

	return (
		<figure className="m-0 overflow-hidden rounded-lg border border-tinta/12">
			<div
				className={
					hayPrenda ? "grid grid-cols-2 md:grid-cols-3" : "grid grid-cols-2"
				}
			>
				{/* Izquierda: dónde va. Derecha: qué se imprime. En ese orden
				    porque colocar mal es el error caro: el arte se vuelve a mandar,
				    una prenda estampada torcida se tira. La tercera, cuando la hay,
				    es la prenda de verdad: no sirve para producir, sirve para saber
				    qué esperaba quien pidió. */}
				<div className="flex h-[190px] items-center justify-center border-r border-tinta/12 bg-gris p-3">
					{colocacion && !sinColocacion ? (
						// biome-ignore lint/performance/noImgElement: ruta /medios/… del mismo origen servida por el rewrite.
						<img
							src={colocacion}
							alt={`Colocación en ${lado}`}
							onError={() => setSinColocacion(true)}
							className="max-h-full max-w-full object-contain"
						/>
					) : (
						<span className="px-3 text-center text-[12px] leading-[18px] text-tinta/45">
							Sin referencia de colocación
						</span>
					)}
				</div>

				<div
					className="flex h-[190px] items-center justify-center p-3"
					style={CUADROS}
				>
					{falta ? (
						<p className="px-3 text-center text-[13px] leading-[20px] text-tinta/50">
							No encontramos este archivo.
							<br />
							Escríbenos con el folio #{folio}.
						</p>
					) : (
						// biome-ignore lint/performance/noImgElement: PNG con transparencia servido por el rewrite; next/image no aporta nada y obliga a declarar el origen.
						<img
							src={ruta}
							alt={`Arte de ${lado}`}
							onError={() => setFalta(true)}
							className="max-h-full max-w-full object-contain"
						/>
					)}
				</div>

				<div
					className={`${
						hayPrenda ? "flex" : "hidden"
					} col-span-2 h-[190px] items-center justify-center border-t border-tinta/12 bg-gris p-3 md:col-span-1 md:border-l md:border-t-0`}
				>
					{prenda && (
						// biome-ignore lint/performance/noImgElement: ruta /medios/… del mismo origen servida por el rewrite.
						<img
							src={prenda}
							alt={`${lado} sobre la prenda`}
							onLoad={() => setHayPrenda(true)}
							onError={() => setHayPrenda(false)}
							className="max-h-full max-w-full object-contain"
						/>
					)}
				</div>
			</div>

			<figcaption className="border-t border-tinta/12 bg-white px-3 py-2.5">
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0">
						<p className="text-[13px] font-semibold text-tinta">{lado}</p>

						{/* La medida IMPRESA, calculada de los píxeles del archivo y su
						    resolución. No la declarada: son distintas cuando el área del
						    lienzo no tiene la proporción de los centímetros del producto,
						    y lo que sale de la máquina es esta. */}
						<p className="pt-0.5 font-mono text-[12px] text-tinta/70">
							{anchoRealCm && altoRealCm
								? `${anchoRealCm} × ${altoRealCm} cm`
								: anchoCm && altoCm
									? `${anchoCm} × ${altoCm} cm (declarado)`
									: "Medidas no registradas"}
							{dpi ? ` · ${dpi} dpi` : ""}
						</p>

						{anchoPx && altoPx && (
							<p className="font-mono text-[11px] text-tinta/40">
								{anchoPx} × {altoPx} px
							</p>
						)}

						{/* El archivo mide MÁS que el área a propósito, y hay que
						    decirlo: quien abre el PNG y lo mide se encuentra unos
						    milímetros de más, y sin esta línea parece un error. */}
						{!!sangradoCm && (
							<p className="pt-1 text-[11px] leading-[15px] text-tinta/55">
								Incluye {sangradoCm} cm de sangrado por lado: recorta al área al
								montarlo.
							</p>
						)}

						{/* Si lo declarado y lo real no cuadran, el taller tiene que
						    saberlo: es su plantilla la que no coincide con los
						    centímetros que puso, y se corrige en el producto. */}
						{desviado && (
							<p className="pt-1 text-[11px] leading-[15px] text-[#b8860b]">
								Declaraste {anchoCm} × {altoCm} cm. Revisa el área de la
								plantilla.
							</p>
						)}
					</div>

					{falta ? (
						<span className="text-[12px] text-tinta/40">Sin archivo</span>
					) : (
						<a
							href={ruta}
							download={`pedido-${folio}-${lado}.png`}
							className="flex shrink-0 items-center gap-1.5 rounded-md bg-tinta px-2.5 py-1.5 text-[12px] font-semibold text-lima"
						>
							<Download size={13} />
							Descargar
						</a>
					)}
				</div>
			</figcaption>
		</figure>
	);
}

function Entrega({ entrega }: { entrega: Pedido["entrega"] }) {
	const [copiado, setCopiado] = useState(false);

	// Los pedidos anteriores a que existiera el campo no lo traen. Decirlo es
	// mejor que enseñar una dirección vacía como si fuera la buena.
	if (!entrega) {
		return (
			<p className="text-[14px] leading-[22px] text-tinta/55">
				Este pedido es anterior a que se capturara la entrega. Acuérdalo con el
				cliente por los datos de contacto.
			</p>
		);
	}

	if (entrega.metodo === "recoger" || !entrega.direccion) {
		return (
			<p className="text-[14px] leading-[22px] text-tinta">
				<strong className="font-semibold">Recoge con el taller.</strong> Queda
				con el cliente el punto y la hora.
			</p>
		);
	}

	const d = entrega.direccion;
	const enTexto = [
		`${d.calle} ${d.numero}${d.interior ? ` int. ${d.interior}` : ""}`,
		d.colonia,
		`${d.ciudad}, ${d.estado} ${d.cp}`,
		d.referencias ? `Ref: ${d.referencias}` : null,
	]
		.filter(Boolean)
		.join("\n");

	async function copiar() {
		try {
			await navigator.clipboard.writeText(enTexto);
			setCopiado(true);
			setTimeout(() => setCopiado(false), 2000);
		} catch {
			// Sin portapapeles —contexto no seguro, permiso denegado— la dirección
			// sigue a la vista para copiarla a mano.
		}
	}

	return (
		<div className="rounded-lg border border-tinta/12 bg-white p-4">
			<p className="whitespace-pre-line text-[14px] leading-[23px] text-tinta">
				{enTexto}
			</p>
			<button
				type="button"
				onClick={copiar}
				className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-tinta/60 hover:text-tinta"
			>
				{copiado ? <Check size={13} /> : <Copy size={13} />}
				{copiado ? "Copiada" : "Copiar dirección"}
			</button>
		</div>
	);
}

function Seccion({
	titulo,
	children,
}: {
	titulo: string;
	children: React.ReactNode;
}) {
	return (
		<section>
			<h3 className="pb-3.5 font-display text-[12px] font-bold uppercase tracking-[0.08em] text-tinta/45">
				{titulo}
			</h3>
			{children}
		</section>
	);
}

function Dato({
	etiqueta,
	valor,
	enlace,
}: {
	etiqueta: string;
	valor: string;
	enlace?: string;
}) {
	return (
		<div className="min-w-0">
			<dt className="text-[11px] uppercase tracking-[0.06em] text-tinta/45">
				{etiqueta}
			</dt>
			<dd className="truncate text-tinta">
				{enlace ? (
					<a
						href={enlace}
						target="_blank"
						rel="noreferrer"
						className="underline underline-offset-2 hover:text-tinta/70"
					>
						{valor}
					</a>
				) : (
					valor
				)}
			</dd>
		</div>
	);
}
