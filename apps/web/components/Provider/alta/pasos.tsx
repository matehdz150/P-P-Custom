"use client";

import Image from "next/image";
import { Switch } from "@/components/ui/switch";
import type { ProductTemplate } from "@/lib/api/templates";
import type { EditableShape } from "@/lib/products/types";
import { Ayuda, Chip, Etiqueta, Numero, Texto } from "./campos";
import Fotos from "./Fotos";
import Previsualizacion from "./Previsualizacion";
import {
	type Alta,
	type Cifra,
	type Lado,
	tallasDe,
	variantesDe,
} from "./tipos";

type Props = {
	alta: Alta;
	set: <K extends keyof Alta>(k: K, v: Alta[K]) => void;
};

/* ── 1 · QUÉ PRODUCES ─────────────────────────────────────────────────── */

export function PasoPlantilla({
	plantillas,
	elegida,
	onElegir,
}: {
	plantillas: ProductTemplate[];
	elegida: string;
	onElegir: (t: ProductTemplate) => void;
}) {
	if (plantillas.length === 0) {
		return (
			<Ayuda>
				Todavía no hay plantillas disponibles. Escríbenos y te damos de alta la
				prenda que produces.
			</Ayuda>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
			{plantillas.map((t) => {
				const data = t.data ?? t;
				const primerLado = data.sides?.[0];
				const mockup = primerLado ? data.mockups?.[primerLado] : undefined;
				const activa = elegida === t.id;

				return (
					<button
						key={t.id}
						type="button"
						onClick={() => onElegir(t)}
						aria-pressed={activa}
						className={`flex flex-col gap-3.5 rounded-[10px] p-5 text-left ${
							activa
								? "border-[1.5px] border-tinta bg-hueso"
								: "border border-tinta/14 bg-white"
						}`}
					>
						<div className="flex h-[130px] items-center justify-center rounded-lg bg-gris">
							{mockup ? (
								<Image
									src={mockup}
									alt=""
									width={200}
									height={240}
									className="max-h-[84%] w-auto max-w-[70%] object-contain"
								/>
							) : null}
						</div>
						<div className="flex items-start justify-between gap-2.5">
							<div className="flex flex-col gap-[3px]">
								<span className="text-[15px] font-semibold text-tinta">
									{t.name ?? t.id}
								</span>
								<Ayuda>
									{(data.sides ?? [])
										.map((s: string) => data.sideLabels?.[s] ?? s)
										.join(" y ")}
								</Ayuda>
							</div>
							{activa && (
								<span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-lima text-tinta">
									<svg
										width="13"
										height="13"
										viewBox="0 0 24 24"
										fill="none"
										aria-hidden="true"
									>
										<path
											d="M5 12.6l4.8 4.8L19.5 7"
											stroke="currentColor"
											strokeWidth="3.4"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</span>
							)}
						</div>
					</button>
				);
			})}
		</div>
	);
}

/* ── 2 · PRESÉNTALO ───────────────────────────────────────────────────── */

export function PasoDatos({
	alta,
	set,
	categorias,
}: Props & { categorias: { id: string; name: string }[] }) {
	function alternarCategoria(id: string) {
		set(
			"categoryIds",
			alta.categoryIds.includes(id)
				? alta.categoryIds.filter((c) => c !== id)
				: [...alta.categoryIds, id],
		);
	}

	return (
		<div className="flex items-start gap-11">
			<div className="flex w-[460px] shrink-0 flex-col gap-5">
				<Texto
					etiqueta="¿Cómo se llama?"
					ayuda="Así aparece en el catálogo."
					valor={alta.name}
					onChange={(v) => set("name", v)}
					placeholder="Playera cuello redondo 180g"
				/>

				<label className="flex flex-col gap-[7px]">
					<Etiqueta>Descríbela en una línea</Etiqueta>
					<textarea
						value={alta.description}
						onChange={(e) => set("description", e.target.value)}
						rows={2}
						placeholder="Algodón 180 g, corte unisex. Aguanta lavadas sin encoger."
						className="w-full resize-none rounded-lg border-[1.5px] border-tinta/18 bg-white px-[15px] py-3.5 text-[15px] leading-6 text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta focus:shadow-[0_0_0_3px_rgba(174,255,110,0.55)]"
					/>
					<Ayuda>
						De qué está hecha y para qué sirve. Dos renglones bastan.
					</Ayuda>
				</label>

				{categorias.length > 0 && (
					<div className="flex flex-col gap-[9px]">
						<Etiqueta>¿Dónde va en el catálogo?</Etiqueta>
						<div className="flex flex-wrap gap-2">
							{categorias.map((c) => (
								<Chip
									key={c.id}
									activo={alta.categoryIds.includes(c.id)}
									onClick={() => alternarCategoria(c.id)}
								>
									{c.name}
								</Chip>
							))}
						</div>
					</div>
				)}

				<Texto
					etiqueta="Tu clave interna"
					opcional
					ayuda="Sólo para que la reconozcas en tus pedidos. El cliente no la ve."
					valor={alta.sku}
					onChange={(v) => set("sku", v)}
					placeholder="PLY-001"
				/>
			</div>

			<Fotos fotos={alta.images} onChange={(f) => set("images", f)} />
		</div>
	);
}

/* ── 3 · CÓMO SE IMPRIME ──────────────────────────────────────────────── */

export function PasoImpresion({
	alta,
	set,
	plantilla,
}: Props & { plantilla: ProductTemplate | null }) {
	const data = plantilla ? (plantilla.data ?? plantilla) : null;
	const sides: string[] = data?.sides ?? [];
	const labels: Record<string, string> = data?.sideLabels ?? {};

	function alternarLado(sideKey: string) {
		const existe = alta.printSides.some((s) => s.sideKey === sideKey);
		set(
			"printSides",
			existe
				? alta.printSides.filter((s) => s.sideKey !== sideKey)
				: [
						...alta.printSides,
						{ sideKey, widthCm: 28, heightCm: 35, dpi: 300 },
					],
		);
	}

	function editarLado(sideKey: string, campo: keyof Lado, valor: number | "") {
		set(
			"printSides",
			alta.printSides.map((s) =>
				s.sideKey === sideKey ? { ...s, [campo]: valor } : s,
			),
		);
	}

	// La previsualización enseña el primer lado activo: es el que el cliente ve
	// al abrir el editor.
	const activo = alta.printSides[0];
	const areas: EditableShape[] = activo
		? (data?.editableAreas?.[activo.sideKey] ?? [])
		: [];
	const mockup = activo ? data?.mockups?.[activo.sideKey] : undefined;

	return (
		<div className="flex items-start gap-11">
			<div className="flex w-[520px] shrink-0 flex-col gap-3.5">
				<Etiqueta>Lados</Etiqueta>

				{sides.map((sideKey) => {
					const lado = alta.printSides.find((s) => s.sideKey === sideKey);
					return (
						<div
							key={sideKey}
							className={`flex items-center gap-4 rounded-[10px] p-[16px_18px] ${
								lado
									? "border-[1.5px] border-tinta bg-hueso"
									: "border border-tinta/14"
							}`}
						>
							<button
								type="button"
								onClick={() => alternarLado(sideKey)}
								aria-pressed={!!lado}
								aria-label={labels[sideKey] ?? sideKey}
								className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md ${
									lado ? "bg-lima text-tinta" : "border-[1.5px] border-tinta/30"
								}`}
							>
								{lado && (
									<svg
										width="13"
										height="13"
										viewBox="0 0 24 24"
										fill="none"
										aria-hidden="true"
									>
										<path
											d="M5 12.6l4.8 4.8L19.5 7"
											stroke="currentColor"
											strokeWidth="3.4"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								)}
							</button>

							<span
								className={`w-[84px] text-[15px] font-semibold ${lado ? "text-tinta" : "text-tinta/60"}`}
							>
								{labels[sideKey] ?? sideKey}
							</span>

							{lado ? (
								<>
									<div className="flex items-center gap-2">
										<Numero
											valor={lado.widthCm}
											onChange={(v) => editarLado(sideKey, "widthCm", v)}
											ancho="w-[74px]"
										/>
										<Ayuda>×</Ayuda>
										<Numero
											valor={lado.heightCm}
											onChange={(v) => editarLado(sideKey, "heightCm", v)}
											ancho="w-[74px]"
										/>
										<Ayuda>cm</Ayuda>
									</div>
									<div className="ml-auto flex items-center gap-2">
										<span className="font-mono text-[11px] tracking-[0.7px] text-tinta/50">
											DPI
										</span>
										<Numero
											valor={lado.dpi}
											onChange={(v) => editarLado(sideKey, "dpi", v)}
											ancho="w-[74px]"
										/>
									</div>
								</>
							) : (
								<Ayuda>Actívalo si también imprimes de ese lado</Ayuda>
							)}
						</div>
					);
				})}

				<div className="flex flex-col gap-3.5 border-t border-tinta/12 pt-[18px]">
					<Etiqueta>Qué puede meter el cliente</Etiqueta>
					<div className="flex items-center gap-2.5">
						<Chip
							activo={alta.reglas.allowText}
							onClick={() =>
								set("reglas", {
									...alta.reglas,
									allowText: !alta.reglas.allowText,
								})
							}
						>
							Texto
						</Chip>
						<Chip
							activo={alta.reglas.allowImages}
							onClick={() =>
								set("reglas", {
									...alta.reglas,
									allowImages: !alta.reglas.allowImages,
								})
							}
						>
							Imágenes
						</Chip>
					</div>

					<div className="flex flex-col gap-2.5">
						<Limite
							etiqueta="Limitar cuántos diseños puede poner"
							ayuda="Apagado, el cliente pone los que quepan en el área."
							activo={alta.reglas.limitarDisenos}
							onActivar={(v) =>
								set("reglas", { ...alta.reglas, limitarDisenos: v })
							}
							valor={alta.reglas.maxDisenos}
							onValor={(v) => set("reglas", { ...alta.reglas, maxDisenos: v })}
							unidad="diseños como máximo"
						/>
						<Limite
							etiqueta="Limitar cuántas tintas puede usar"
							ayuda="En serigrafía cada tinta es una malla más. Enciéndelo si te sale caro."
							activo={alta.reglas.limitarTintas}
							onActivar={(v) =>
								set("reglas", { ...alta.reglas, limitarTintas: v })
							}
							valor={alta.reglas.maxTintas}
							onValor={(v) => set("reglas", { ...alta.reglas, maxTintas: v })}
							unidad="tintas por diseño"
						/>
					</div>

					<Ayuda>
						Lo que enciendas aquí lo respeta el editor: el cliente no va a poder
						pasarse.
					</Ayuda>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-3">
				<Etiqueta>Así lo va a ver el cliente</Etiqueta>
				<Previsualizacion
					mockupUrl={mockup}
					areas={areas}
					anchoCm={
						typeof activo?.widthCm === "number" ? activo.widthCm : undefined
					}
					altoCm={
						typeof activo?.heightCm === "number" ? activo.heightCm : undefined
					}
				/>
				<Ayuda>
					Es el mockup y el área reales de la plantilla, con la misma geometría
					del editor. El recuadro punteado es donde el cliente puede colocar.
				</Ayuda>
			</div>
		</div>
	);
}

/**
 * Un límite opcional: apagado no manda nada al API (sin tope), encendido
 * revela el campo. Por defecto van apagados — la mayoría de los talleres no
 * tiene un tope arbitrario, tiene uno real y sabe cuál es.
 */
function Limite({
	etiqueta,
	ayuda,
	activo,
	onActivar,
	valor,
	onValor,
	unidad,
}: {
	etiqueta: string;
	ayuda: string;
	activo: boolean;
	onActivar: (v: boolean) => void;
	valor: number | "";
	onValor: (v: number | "") => void;
	unidad: string;
}) {
	return (
		<div
			className={`flex flex-col gap-3 rounded-[10px] p-[14px_16px] ${
				activo
					? "border-[1.5px] border-tinta bg-hueso"
					: "border border-tinta/14"
			}`}
		>
			<div className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-0.5">
					<span className="text-sm font-semibold text-tinta">{etiqueta}</span>
					<Ayuda>{ayuda}</Ayuda>
				</div>
				<Switch
					checked={activo}
					onCheckedChange={onActivar}
					aria-label={etiqueta}
					className="mt-0.5 shrink-0 data-[state=checked]:bg-tinta"
				/>
			</div>

			{activo && (
				<div className="flex items-center gap-2.5">
					<Numero valor={valor} onChange={onValor} ancho="w-20" min={1} />
					<Ayuda>{unidad}</Ayuda>
				</div>
			)}
		</div>
	);
}

/* ── 4 · TALLAS Y COLORES ─────────────────────────────────────────────── */

export function PasoVariantes({ alta, set }: Props) {
	return (
		<div className="flex flex-col gap-11">
			<div className="flex items-start gap-11">
				<div className="flex w-[520px] shrink-0 flex-col gap-3.5">
					<div className="flex flex-col gap-1">
						<Etiqueta>Tallas</Etiqueta>
						<Ayuda>
							En pulgadas, con la prenda extendida. Las dos medidas son
							obligatorias: sin ellas la talla no se guarda.
						</Ayuda>
					</div>

					{alta.sizes.map((t, i) => (
						<div key={t.size || i} className="flex items-center gap-2.5">
							<input
								value={t.size}
								onChange={(e) =>
									set(
										"sizes",
										alta.sizes.map((s, j) =>
											j === i ? { ...s, size: e.target.value } : s,
										),
									)
								}
								placeholder="M"
								className="h-[50px] w-20 rounded-lg border-[1.5px] border-tinta/18 px-3 text-center font-mono text-[15px] text-tinta outline-none focus:border-tinta"
							/>
							<Numero
								valor={t.widthIn}
								onChange={(v) =>
									set(
										"sizes",
										alta.sizes.map((s, j) =>
											j === i ? { ...s, widthIn: v } : s,
										),
									)
								}
								ancho="w-[92px]"
							/>
							<Ayuda>ancho</Ayuda>
							<Numero
								valor={t.lengthIn}
								onChange={(v) =>
									set(
										"sizes",
										alta.sizes.map((s, j) =>
											j === i ? { ...s, lengthIn: v } : s,
										),
									)
								}
								ancho="w-[92px]"
							/>
							<Ayuda>largo</Ayuda>
							<button
								type="button"
								onClick={() =>
									set(
										"sizes",
										alta.sizes.filter((_, j) => j !== i),
									)
								}
								aria-label="Quitar talla"
								className="ml-auto text-tinta/50 hover:text-tinta"
							>
								<svg
									width="17"
									height="17"
									viewBox="0 0 24 24"
									fill="none"
									aria-hidden="true"
								>
									<path
										d="M6 6l12 12M18 6L6 18"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
									/>
								</svg>
							</button>
						</div>
					))}

					<button
						type="button"
						onClick={() =>
							set("sizes", [
								...alta.sizes,
								{ size: "", widthIn: "", lengthIn: "" },
							])
						}
						className="flex h-11 w-fit items-center gap-2 rounded-lg border-[1.5px] border-tinta/20 px-4 text-sm font-semibold text-tinta"
					>
						<svg
							width="15"
							height="15"
							viewBox="0 0 24 24"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M12 5v14M5 12h14"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
							/>
						</svg>
						Agregar talla
					</button>
				</div>

				<div className="flex flex-1 flex-col gap-3.5">
					<div className="flex flex-col gap-1">
						<Etiqueta>Colores</Etiqueta>
						<Ayuda>
							Los que realmente tienes en existencia. El cliente ve la prenda
							teñida de este color en el editor.
						</Ayuda>
					</div>

					{alta.colors.map((c, i) => (
						<div key={c.hex || i} className="flex items-center gap-2.5">
							<span
								className="h-[50px] w-[50px] shrink-0 rounded-lg border border-tinta/20"
								style={{ background: c.hex || "#ffffff" }}
							/>
							<input
								value={c.name}
								onChange={(e) =>
									set(
										"colors",
										alta.colors.map((x, j) =>
											j === i ? { ...x, name: e.target.value } : x,
										),
									)
								}
								placeholder="Negro"
								className="h-[50px] flex-1 rounded-lg border-[1.5px] border-tinta/18 px-[15px] text-[15px] text-tinta outline-none focus:border-tinta"
							/>
							<input
								value={c.hex}
								onChange={(e) =>
									set(
										"colors",
										alta.colors.map((x, j) =>
											j === i ? { ...x, hex: e.target.value } : x,
										),
									)
								}
								placeholder="#1a1a17"
								className="h-[50px] w-[120px] rounded-lg border-[1.5px] border-tinta/18 px-3 font-mono text-sm text-tinta outline-none focus:border-tinta"
							/>
							<button
								type="button"
								onClick={() =>
									set(
										"colors",
										alta.colors.filter((_, j) => j !== i),
									)
								}
								aria-label="Quitar color"
								className="text-tinta/50 hover:text-tinta"
							>
								<svg
									width="17"
									height="17"
									viewBox="0 0 24 24"
									fill="none"
									aria-hidden="true"
								>
									<path
										d="M6 6l12 12M18 6L6 18"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
									/>
								</svg>
							</button>
						</div>
					))}

					<button
						type="button"
						onClick={() =>
							set("colors", [...alta.colors, { name: "", hex: "" }])
						}
						className="flex h-11 w-fit items-center gap-2 rounded-lg border-[1.5px] border-tinta/20 px-4 text-sm font-semibold text-tinta"
					>
						<svg
							width="15"
							height="15"
							viewBox="0 0 24 24"
							fill="none"
							aria-hidden="true"
						>
							<path
								d="M12 5v14M5 12h14"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
							/>
						</svg>
						Agregar color
					</button>
				</div>
			</div>

			<Existencias alta={alta} set={set} />
			<Envio alta={alta} set={set} />
		</div>
	);
}

/**
 * Peso y caja: lo único que la paquetería necesita para cotizar.
 *
 * Va en el paso de variantes, debajo de las existencias, porque el peso se
 * indexa por talla y las tallas se capturan justo arriba. En un paso propio
 * habría que volver aquí cada vez que se añade una.
 *
 * EL PESO ES POR TALLA, NO POR VARIANTE. El color no cambia lo que pesa una
 * prenda. Por variante serían diez colores × seis tallas de casillas para
 * obtener seis números distintos, y lo que se consigue pidiendo sesenta es
 * que se rellenen a ojo.
 *
 * EN GRAMOS. Una playera pesa 150 g, no 0.15 kg. Pedirlo en kilos invita a
 * decimales mal puestos, y un 1.5 donde iba 0.15 multiplica por diez el costo
 * del envío sin que nadie lo note hasta la factura.
 */
function Envio({ alta, set }: Props) {
	const e = alta.envio;
	const tallas = tallasDe(alta);

	const ponPeso = (talla: string, v: Cifra) =>
		set("envio", { ...e, pesoPorTalla: { ...e.pesoPorTalla, [talla]: v } });

	const ponCaja = (lado: keyof typeof e.caja, v: Cifra) =>
		set("envio", { ...e, caja: { ...e.caja, [lado]: v } });

	return (
		<div className="flex flex-col gap-3.5 border-t border-tinta/12 pt-9">
			<div className="flex flex-col gap-1">
				<Etiqueta>Cuánto pesa cada talla</Etiqueta>
				<Ayuda>
					En gramos, la prenda sola. Con esto cotizamos el envío antes de que
					el cliente pague. Si lo dejas vacío, tus productos sólo se podrán
					recoger contigo.
				</Ayuda>
			</div>

			{tallas.length === 0 ? (
				<Ayuda>Captura al menos una talla arriba y aquí aparecen.</Ayuda>
			) : (
				<div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
					{tallas.map((t) => (
						<div key={t} className="flex items-center gap-2.5">
							<span className="min-w-0 flex-1 truncate font-mono text-[13px] text-tinta/70">
								{t}
							</span>
							<Numero
								valor={e.pesoPorTalla[t] ?? ""}
								onChange={(v) => ponPeso(t, v)}
								ancho="w-20"
								min={1}
							/>
							<span className="text-[12px] text-tinta/50">g</span>
						</div>
					))}
				</div>
			)}

			<div className="flex flex-col gap-1 pt-3">
				<Etiqueta>La caja de una pieza</Etiqueta>
				<Ayuda>
					En centímetros. Sirve para cotizar antes de que el paquete exista;
					las medidas reales las confirmas tú al terminar el pedido.
				</Ayuda>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				{(["largo", "ancho", "alto"] as const).map((lado) => (
					<div key={lado} className="flex items-center gap-2">
						<span className="text-[13px] capitalize text-tinta/70">{lado}</span>
						<Numero
							valor={e.caja[lado]}
							onChange={(v) => ponCaja(lado, v)}
							ancho="w-20"
							min={1}
						/>
						<span className="text-[12px] text-tinta/50">cm</span>
					</div>
				))}
			</div>
		</div>
	);
}

/**
 * Las existencias, dentro del paso de variantes y no en uno propio.
 *
 * Se cuenta por color × talla, así que sólo tiene sentido debajo de donde se
 * capturan. En un paso aparte, el taller tendría que acordarse de volver cada
 * vez que añade un color.
 *
 * NO hay interruptor de "llevo cuenta". Lo hubo, apagado por defecto, y con él
 * el aviso de "+N días" no se disparaba nunca: un taller con la bodega vacía
 * cotizaba el mismo plazo que uno lleno. El que compra el blanco por trabajo
 * también cuenta — sus existencias son cero y lo que falta es su lista de
 * compras. Lo que ese taller deja en cero es los DÍAS EXTRA, porque sus días
 * de producción ya incluyen ir a comprar; contarlos aparte le cotizaría la
 * compra dos veces al cliente.
 */
function Existencias({ alta, set }: Props) {
	const s = alta.stock;
	const variantes = variantesDe(alta);

	const poner = (clave: string, v: Cifra) =>
		set("stock", { ...s, porVariante: { ...s.porVariante, [clave]: v } });

	return (
		<div className="flex flex-col gap-3.5 border-t border-tinta/12 pt-9">
			<div className="flex flex-col gap-1">
				<Etiqueta>Cuántos blancos tienes ahora</Etiqueta>
				<Ayuda>
					Puedes vender sin existencias: al cliente se le avisa que tarda más y
					aquí verás cuántos te faltan comprar. Si compras la prenda por
					trabajo, déjalos en cero.
				</Ayuda>
			</div>

			{variantes.length === 0 ? (
				<Ayuda>
					Captura al menos una talla arriba y aquí aparecen las casillas.
				</Ayuda>
			) : (
				<div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
					{variantes.map((v) => (
						// div y no label: `Numero` monta su propio input sin id, así
						// que el label nunca llegó a estar asociado a nada.
						<div key={v.clave} className="flex items-center gap-2.5">
							<span className="min-w-0 flex-1 truncate font-mono text-[13px] text-tinta/70">
								{v.color ? `${v.color} · ${v.talla}` : v.talla}
							</span>
							<Numero
								valor={s.porVariante[v.clave] ?? ""}
								onChange={(n) => poner(v.clave, n)}
								ancho="w-20"
								// Puede estar en negativo si se vendió sin blanco: es lo
								// que hay que comprar, no un dato inválido.
								min={-99999}
							/>
						</div>
					))}
				</div>
			)}

			<div className="flex flex-col gap-1 pt-2">
				<Etiqueta>Días extra si no tienes el blanco</Etiqueta>
				<Ayuda>
					Lo que tardas en conseguirlo. Se suma a tus días normales y se le dice
					al cliente ANTES de que pague. Déjalo en cero si tus días de
					producción ya cuentan la compra.
				</Ayuda>
				<div className="pt-1.5">
					<Numero
						valor={s.diasExtraSinStock}
						onChange={(v) => set("stock", { ...s, diasExtraSinStock: v })}
						ancho="w-24"
					/>
				</div>
			</div>

			{/* El aviso SÍ sigue siendo opcional, y por eso conserva interruptor:
			    un producto que siempre está en cero —el del taller que compra por
			    trabajo— lo dispararía en cada carga del panel, y una alerta que
			    salta siempre no avisa de nada. */}
			<Limite
				etiqueta="Avísame cuando me queden pocos"
				ayuda="Sólo si guardas inventario. Te lo marcamos en tu panel."
				activo={s.minimoAlerta !== ""}
				onActivar={(v) => set("stock", { ...s, minimoAlerta: v ? 1 : "" })}
				valor={s.minimoAlerta}
				onValor={(v) => set("stock", { ...s, minimoAlerta: v })}
				unidad="o menos, avísame"
			/>
		</div>
	);
}

/* ── 5 · TU PRECIO ────────────────────────────────────────────────────── */

const EXTRAS: {
	campo: keyof Alta["pricing"];
	etiqueta: string;
	ayuda: string;
}[] = [
	{
		campo: "perSidePrice",
		etiqueta: "Por cada lado impreso",
		ayuda: "Lo que te cuesta abrir un segundo lado.",
	},
	{
		campo: "perDesignPrice",
		etiqueta: "Por cada diseño",
		ayuda: "Si el cliente pone dos diseños en la misma prenda.",
	},
	{
		campo: "perColorPrice",
		etiqueta: "Por cada tinta",
		ayuda: "En serigrafía, cada tinta es una malla más.",
	},
	{
		campo: "embroideryExtra",
		etiqueta: "Si lo quieren bordado",
		ayuda: "Déjalo en cero si no bordas.",
	},
];

export function PasoPrecio({ alta, set }: Props) {
	const p = alta.pricing;
	const base = typeof p.basePrice === "number" ? p.basePrice : 0;
	const porLado = typeof p.perSidePrice === "number" ? p.perSidePrice : 0;
	const porDiseno = typeof p.perDesignPrice === "number" ? p.perDesignPrice : 0;

	return (
		<div className="flex items-start gap-11">
			<div className="flex w-[460px] shrink-0 flex-col gap-5">
				<div className="flex flex-col gap-[7px]">
					<Etiqueta>Precio por pieza</Etiqueta>
					<div className="flex items-center gap-2.5">
						<span className="font-display text-2xl font-semibold text-tinta">
							$
						</span>
						<Numero
							valor={p.basePrice}
							onChange={(v) => set("pricing", { ...p, basePrice: v })}
							ancho="w-[140px]"
						/>
					</div>
					<Ayuda>La prenda lisa, sin nada impreso.</Ayuda>
				</div>

				<div className="flex flex-col gap-3.5 border-t border-tinta/12 pt-[18px]">
					<div className="flex flex-col gap-1">
						<Etiqueta>Lo que suma cada decisión del cliente</Etiqueta>
						<Ayuda>Todo por pieza. Deja en cero lo que no cobres.</Ayuda>
					</div>

					{EXTRAS.map((e) => (
						<div key={e.campo} className="flex items-center gap-3.5">
							<div className="flex flex-1 flex-col gap-0.5">
								<span className="text-sm font-medium text-tinta">
									{e.etiqueta}
								</span>
								<Ayuda>{e.ayuda}</Ayuda>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="text-[15px] text-tinta/60">+ $</span>
								<Numero
									valor={p[e.campo] as number | ""}
									onChange={(v) => set("pricing", { ...p, [e.campo]: v })}
									ancho="w-[92px]"
								/>
							</div>
						</div>
					))}
				</div>

				<div className="flex flex-col gap-[7px] border-t border-tinta/12 pt-[18px]">
					<Etiqueta>¿En cuántos días lo entregas?</Etiqueta>
					<div className="flex items-center gap-2.5">
						<Numero
							valor={alta.diasProduccion}
							onChange={(v) => set("diasProduccion", v)}
							ancho="w-24"
							min={1}
						/>
						<Ayuda>días hábiles desde que te llega el pedido</Ayuda>
					</div>
					<Ayuda>Pon el que sí aguantas en tu peor semana, no el ideal.</Ayuda>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-3 rounded-[10px] border border-tinta/14 bg-hueso p-6">
				<Etiqueta>Cómo lo va a ver el cliente</Etiqueta>
				<div className="flex flex-col">
					<Renglon k="La prenda" v={`$${base}`} fuerte />
					<Renglon k="30 piezas · 1 lado · 1 diseño" v="" />
					<div className="flex items-baseline justify-between gap-4 border-t-[1.5px] border-tinta pt-3.5">
						<span className="text-[15px] font-semibold text-tinta">
							Estimado
						</span>
						<span className="font-display text-2xl font-semibold tracking-[-0.032em] text-tinta">
							${((base + porLado + porDiseno) * 30).toLocaleString("es-MX")}
						</span>
					</div>
				</div>
				<Ayuda>
					Es la cuenta que ve el comprador en la ficha del producto: precio base
					más un lado más un diseño, por 30 piezas.
				</Ayuda>
			</div>
		</div>
	);
}

function Renglon({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
	return (
		<div className="flex items-baseline justify-between gap-4 border-b border-tinta/12 py-3">
			<span
				className={`text-[15px] ${fuerte ? "font-semibold text-tinta" : "text-tinta/70"}`}
			>
				{k}
			</span>
			<span className="font-mono text-[15px] text-tinta">{v}</span>
		</div>
	);
}

/* ── 6 · REVISAR ──────────────────────────────────────────────────────── */

export function PasoRevisar({
	alta,
	plantilla,
	categorias,
}: {
	alta: Alta;
	plantilla: ProductTemplate | null;
	categorias: { id: string; name: string }[];
}) {
	const data = plantilla ? (plantilla.data ?? plantilla) : null;
	const labels: Record<string, string> = data?.sideLabels ?? {};

	const lados = alta.printSides
		.map(
			(s) =>
				`${labels[s.sideKey] ?? s.sideKey} · ${s.widthCm} × ${s.heightCm} cm`,
		)
		.join("  ·  ");

	const filas: [string, string][] = [
		[
			"CATEGORÍA",
			categorias
				.filter((c) => alta.categoryIds.includes(c.id))
				.map((c) => c.name)
				.join(" · ") || "—",
		],
		["LADOS", lados || "—"],
		[
			"TINTAS MÁX.",
			alta.reglas.limitarTintas && alta.reglas.maxTintas
				? `${alta.reglas.maxTintas} por diseño`
				: "Sin límite",
		],
		[
			"DISEÑOS MÁX.",
			alta.reglas.limitarDisenos && alta.reglas.maxDisenos
				? `${alta.reglas.maxDisenos}`
				: "Sin límite",
		],
		[
			"TALLAS",
			alta.sizes
				.map((s) => s.size)
				.filter(Boolean)
				.join(" · ") || "—",
		],
		[
			"COLORES",
			alta.colors
				.map((c) => c.name)
				.filter(Boolean)
				.join(" · ") || "—",
		],
		[
			"PRECIO BASE",
			alta.pricing.basePrice ? `$${alta.pricing.basePrice}` : "—",
		],
		["PRODUCCIÓN", alta.diasProduccion ? `${alta.diasProduccion} días` : "—"],
		[
			"EXISTENCIAS",
			`${variantesDe(alta).reduce(
				(n, v) => n + (Number(alta.stock.porVariante[v.clave]) || 0),
				0,
			)} piezas en ${variantesDe(alta).length} variantes`,
		],
	];

	return (
		<div className="flex items-start gap-11">
			<div className="flex w-[340px] shrink-0 flex-col gap-3.5">
				<div className="flex h-[300px] items-center justify-center rounded-[10px] border border-tinta/14 bg-gris">
					{alta.images[0] ? (
						<Image
							src={alta.images[0].url}
							alt=""
							width={320}
							height={400}
							className="max-h-[84%] w-auto max-w-[70%] object-contain"
						/>
					) : (
						<Ayuda>Sin fotos</Ayuda>
					)}
				</div>
				<div className="flex flex-col gap-1">
					<span className="font-display text-xl font-semibold leading-[26px] tracking-[-0.032em] text-tinta">
						{alta.name || "Sin nombre"}
					</span>
					<Ayuda>{alta.description || "Sin descripción"}</Ayuda>
				</div>
			</div>

			<div className="grid flex-1 grid-cols-2 gap-x-11">
				{filas.map(([k, v], i) => (
					<div
						key={k}
						className={`flex items-baseline justify-between gap-5 border-t border-tinta/12 py-3.5 ${
							i % 2 === 0 ? "col-start-1" : "col-start-2"
						}`}
					>
						<span className="font-mono text-[11px] tracking-[0.7px] text-tinta/50">
							{k}
						</span>
						<span className="text-right text-[15px] font-semibold text-tinta">
							{v}
						</span>
					</div>
				))}

				<div className="col-span-2 mt-6 flex items-start gap-[11px] rounded-lg border border-tinta/20 bg-gris p-[15px_17px]">
					<svg
						width="19"
						height="19"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
						className="mt-px shrink-0"
					>
						<circle
							cx="12"
							cy="12"
							r="9"
							stroke="currentColor"
							strokeWidth="1.6"
						/>
						<path
							d="M12 7.6v5.2M12 16.2v.2"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
						/>
					</svg>
					<span className="text-sm leading-[22px] text-tinta">
						Al enviarlo lo revisamos y, una vez aprobado, entra al catálogo y
						cualquier cliente puede pedirlo. Los pedidos que genere te llegan a
						ti.
					</span>
				</div>
			</div>
		</div>
	);
}
