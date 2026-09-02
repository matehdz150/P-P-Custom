"use client";

import type { DesignerProductTemplate } from "@/lib/api/products";
import type { Tarifa } from "@/lib/api/envios";
import type { ArchivoDeLado } from "@/lib/pedido/borrador";

/**
 * "Tu pedido": lo que se está a punto de mandar.
 *
 * Enseña la prenda diseñada, no la foto de catálogo: lo que alguien confirma
 * es SU playera, y una foto genérica del producto haría dudar de que el
 * diseño se haya guardado.
 *
 * El precio de aquí es informativo. El que vale lo calcula la Lambda leyendo
 * el producto de la tabla, porque este viaja por el navegador y no se puede
 * creer nada de lo que pase por ahí.
 */
export function Resumen({
	producto,
	fotoProducto,
	archivos,
	colorPrenda,
	lados,
	cantidades,
	piezas,
	total,
	envio,
	cotizando,
}: {
	producto: DesignerProductTemplate;
	/** La foto de catálogo de la prenda, tal como la publicó el taller. */
	fotoProducto: string | null;
	/** Lo exportado de cada lado: el arte y la prenda con el diseño encima. */
	archivos: ArchivoDeLado[];
	colorPrenda: string | null;
	lados: string[];
	cantidades: Record<string, number>;
	piezas: number;
	total: number;
	/** La tarifa elegida, `"recoger"` si no hay envío, o null si falta cotizar. */
	envio: Tarifa | "recoger" | null;
	cotizando: boolean;
}) {
	const base = producto.pricing?.basePrice ?? 0;
	const porLado = producto.pricing?.perSidePrice ?? 0;
	const ladosExtra = Math.max(0, lados.length - 1);
	const extra = ladosExtra * porLado;

	const tallasElegidas = Object.entries(cantidades).filter(([, n]) => n > 0);

	/* La prenda ya diseñada manda: es lo que la persona reconoce como "lo mío".
	   Si por lo que sea no se pudo renderizar, se cae a la foto de catálogo. */
	const principal = archivos.find((a) => a.miniaturaPrenda)?.miniaturaPrenda;

	return (
		<aside className="lg:sticky lg:top-8">
			<div className="rounded-xl border border-tinta/12 bg-hueso p-6">
				<h2 className="font-display text-[19px] font-bold uppercase tracking-[0.02em] text-tinta">
					Tu pedido
				</h2>

				{/* Tres cosas distintas y hay que poder comprobar las tres: la
				    prenda que se compra, cómo va a quedar con el diseño encima, y
				    el arte solo tal como se va a imprimir. */}
				<div className="pt-5">
					<figure className="m-0">
						<div className="flex h-[190px] items-center justify-center overflow-hidden rounded-lg bg-gris">
							{principal ? (
								/* La prenda ya diseñada. Es un data URL del lienzo. */
								// biome-ignore lint/performance/noImgElement: ver arriba
								<img
									src={principal}
									alt={`${producto.name ?? "La prenda"} con tu diseño`}
									className="max-h-full max-w-full object-contain"
								/>
							) : fotoProducto ? (
								/* Ruta /medios/… del mismo origen, servida por el rewrite. */
								// biome-ignore lint/performance/noImgElement: ver arriba
								<img
									src={fotoProducto}
									alt={producto.name ?? "La prenda"}
									className="max-h-full max-w-full object-contain"
								/>
							) : (
								<span className="text-[12px] text-tinta/40">Sin vista</span>
							)}
						</div>
						<figcaption className="pt-1.5 text-center text-[11px] uppercase tracking-[0.06em] text-tinta/50">
							{principal ? "Así va a quedar" : "La prenda"}
						</figcaption>
					</figure>

					<div className="grid grid-cols-2 gap-3 pt-3">
						{archivos.map((a) => (
							<figure key={a.lado} className="m-0">
								{/* Cuadros grises: el arte va con fondo transparente, y sobre
								    un fondo liso un diseño claro se vuelve invisible. */}
								<div
									className="flex h-[104px] items-center justify-center overflow-hidden rounded-lg border border-tinta/10"
									style={{
										backgroundImage:
											"linear-gradient(45deg,#e9e7e0 25%,transparent 25%,transparent 75%,#e9e7e0 75%),linear-gradient(45deg,#e9e7e0 25%,transparent 25%,transparent 75%,#e9e7e0 75%)",
										backgroundSize: "14px 14px",
										backgroundPosition: "0 0, 7px 7px",
										backgroundColor: "#fbfaf6",
									}}
								>
									{a.miniaturaArte ? (
										// biome-ignore lint/performance/noImgElement: data URL en memoria
										<img
											src={a.miniaturaArte}
											alt={`El diseño de ${producto.sideLabels?.[a.lado] ?? a.lado}`}
											className="max-h-[88%] max-w-[88%] object-contain"
										/>
									) : (
										<span className="text-[12px] text-tinta/40">Sin vista</span>
									)}
								</div>
								<figcaption className="pt-1.5 text-center text-[11px] uppercase tracking-[0.06em] text-tinta/50">
									{producto.sideLabels?.[a.lado] ?? a.lado}
								</figcaption>
							</figure>
						))}
					</div>
				</div>

				<div className="flex gap-4 pt-5">
					<div className="min-w-0 flex-1">
						<p className="font-display text-[15px] font-semibold leading-5 text-tinta">
							{producto.name ?? "Prenda personalizada"}
						</p>
						<p className="pt-1 text-[14px] text-tinta/70">
							${base.toLocaleString("es-MX")} c/u
						</p>

						<dl className="pt-2.5 text-[13px] leading-[21px] text-tinta/60">
							{colorPrenda && (
								<div className="flex gap-1.5">
									<dt>Color:</dt>
									<dd className="text-tinta/80">{colorPrenda}</dd>
								</div>
							)}
							<div className="flex gap-1.5">
								<dt>Impresión:</dt>
								<dd className="text-tinta/80">
									{lados.map((l) => producto.sideLabels?.[l] ?? l).join(" · ")}
								</dd>
							</div>
							{tallasElegidas.length > 0 && (
								<div className="flex gap-1.5">
									<dt>Tallas:</dt>
									<dd className="text-tinta/80">
										{tallasElegidas
											.map(([talla, n]) => `${talla}×${n}`)
											.join("  ")}
									</dd>
								</div>
							)}
						</dl>
					</div>
				</div>

				<div className="mt-6 space-y-2 border-t border-tinta/12 pt-5 text-[14px]">
					<Renglon
						etiqueta={`Prenda (${piezas} ${piezas === 1 ? "pieza" : "piezas"})`}
						valor={`$${(base * piezas).toLocaleString("es-MX")}`}
					/>

					{/* El primer lado va incluido en el precio base; sólo se cobran los
					    demás, y sólo si el taller les puso precio. */}
					{extra > 0 && (
						<Renglon
							etiqueta={`Impresión adicional (${ladosExtra} ${ladosExtra === 1 ? "lado" : "lados"})`}
							valor={`$${(extra * piezas).toLocaleString("es-MX")}`}
						/>
					)}

					{envio === "recoger" ? (
						<Renglon etiqueta="Envío" valor="Recoges con el taller" tenue />
					) : envio ? (
						<Renglon
							etiqueta={`Envío (${envio.paqueteria})`}
							valor={`$${envio.precio.toLocaleString("es-MX")}`}
						/>
					) : (
						<Renglon
							etiqueta="Envío"
							valor={cotizando ? "Cotizando…" : "Falta tu dirección"}
							tenue
						/>
					)}
				</div>

				<div className="mt-5 flex items-baseline justify-between border-t border-tinta/12 pt-5">
					<span className="font-display text-[16px] font-bold uppercase tracking-[0.02em] text-tinta">
						Total
					</span>
					<span className="font-display text-[24px] font-bold text-tinta">
						${total.toLocaleString("es-MX")}
					</span>
				</div>

				<p className="pt-2 text-[12px] leading-[18px] text-tinta/50">
					{envio && envio !== "recoger"
						? "El envío es el que cotiza la paquetería para tu código postal. El taller confirma el pedido antes de producir."
						: "Precio estimado. El taller lo confirma antes de producir."}
				</p>
			</div>
		</aside>
	);
}

function Renglon({
	etiqueta,
	valor,
	tenue = false,
}: {
	etiqueta: string;
	valor: string;
	tenue?: boolean;
}) {
	return (
		<div className="flex items-baseline justify-between gap-4">
			<span className="text-tinta/65">{etiqueta}</span>
			<span className={tenue ? "text-tinta/55" : "font-semibold text-tinta"}>
				{valor}
			</span>
		</div>
	);
}
