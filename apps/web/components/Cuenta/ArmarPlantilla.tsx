"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	catalogoRecordado,
	getCatalogo,
	type ProductoDeCatalogo,
	porIdDeProducto,
} from "@/lib/api/catalogo";
import {
	crearPlantilla,
	guardarPlantilla,
	type Plantilla,
} from "@/lib/api/cuenta";
import {
	borrarBorradorDePlantilla,
	escribirBorradorDePlantilla,
	type ItemDeBorrador,
	leerBorradorDePlantilla,
	nuevaClave,
} from "@/lib/plantillas/borrador";
import ExplorarCatalogo from "./ExplorarCatalogo";
import { Pastilla, pesos } from "./Pedidos";
import { useCabeceraDelPanel } from "./pantalla";
import { Cargando } from "./piezas";

/**
 * Armar una plantilla: la misma pantalla para una nueva y para editar una
 * guardada.
 *
 * SON LA MISMA PANTALLA porque son la misma operación —esta lista de productos
 * con estas cantidades— y sólo cambian dos cosas: de dónde salen los productos
 * al abrir, y a qué llamada se manda al guardar. Dos pantallas gemelas se
 * habrían separado con el tiempo, que es justo lo que le pasó a las dos
 * tarjetas de producto antes de unirlas.
 *
 * DOS PANELES, Y EL CATÁLOGO NO SE CIERRA. Antes se abría en un cajón: elegir
 * un producto tapaba la plantilla y cerrarlo tapaba el catálogo, así que armar
 * un kit de cinco eran cinco viajes entre dos vistas que no se ven nunca
 * juntas — y ahí se perdía el hilo de lo que llevabas. Con el catálogo fijo a
 * la izquierda y la plantilla creciendo a la derecha, agregar es un clic y el
 * resultado se ve en el mismo movimiento.
 *
 * EN MÓVIL NO CABEN LOS DOS y se turnan con un conmutador que lleva la cuenta
 * de piezas. Apilarlos habría dejado el catálogo debajo de una lista que
 * crece, o sea cada vez más lejos justo cuando más se usa.
 *
 * DISEÑAR SIGUE SACANDO DE LA PANTALLA, y no hay forma de evitarlo: el editor
 * es un lienzo a página completa. Por eso lo que se lleva armado vive en un
 * borrador local (`lib/plantillas/borrador`) y se recupera al volver.
 *
 * UN ÍTEM PUEDE NO TENER DISEÑO, y es normal: se puede armar la lista entera y
 * diseñar después. La fila lo dice, y al cargarla en el carrito ese ítem pasa
 * por el editor en vez de bloquear los demás.
 */
export default function ArmarPlantilla({
	plantilla,
	onSalir,
}: {
	/** La que se edita. Nula: una nueva. */
	plantilla: Plantilla | null;
	onSalir: () => void;
}) {
	/* La cabecera del panel dice qué estás haciendo y por dónde se sale. Es la
	   del propio panel —misma tipografía, misma flecha que el detalle de un
	   pedido—, no una inventada aquí. */
	useCabeceraDelPanel(
		plantilla ? "Editar plantilla" : "Nueva plantilla",
		onSalir,
	);

	const plantillaId = plantilla?.id ?? null;
	const [nombre, setNombre] = useState("");
	const [items, setItems] = useState<ItemDeBorrador[]>([]);
	const [guardando, setGuardando] = useState(false);
	const [listo, setListo] = useState(false);
	const [eligiendo, setEligiendo] = useState(false);

	/* El catálogo, para lo que el borrador no guarda: qué tallas existen y a
	   cuánto sale la pieza. Un producto que ya no se publica no aparece aquí y
	   su fila se dibuja igual, sólo que sin poder añadirle tallas. */
	const [catalogo, setCatalogo] = useState<ProductoDeCatalogo[] | null>(
		catalogoRecordado,
	);
	useEffect(() => {
		getCatalogo()
			.then(setCatalogo)
			.catch(() => {});
	}, []);
	const porId = useMemo(() => porIdDeProducto(catalogo), [catalogo]);

	/* De dónde sale lo que se ve al abrir.

	   EL BORRADOR MANDA SOBRE LO GUARDADO, pero sólo si es de ESTA plantilla:
	   es lo que quedó del paso por el editor y perderlo sería tirar el diseño
	   que se acaba de hacer. Si es de otra —o de una nueva a medias— se ignora
	   y se siembra de lo guardado, que si no aparecerían aquí productos de una
	   plantilla distinta.

	   SIEMBRA UNA SOLA VEZ POR PLANTILLA, no cada vez que cambia el objeto: la
	   lista de arriba puede volver a pedirse y devolver otra referencia con los
	   mismos datos, y volver a sembrar tiraría lo que se lleve editado. */
	// biome-ignore lint/correctness/useExhaustiveDependencies: sembrar de nuevo borraría los cambios
	useEffect(() => {
		const b = leerBorradorDePlantilla();

		if (b.plantillaId === plantillaId && (b.items.length > 0 || b.nombre)) {
			setNombre(b.nombre);
			setItems(b.items);
			setListo(true);
			return;
		}

		const desdeLaGuardada: ItemDeBorrador[] = (plantilla?.items ?? []).map(
			(i) => ({
				clave: nuevaClave(),
				productoId: i.productoId,
				nombre: i.nombre,
				colorPrenda: i.colorPrenda,
				tallas: i.tallas,
				origen: i.origen,
				itemId: i.itemId ?? null,
				lados: i.lados ?? [],
				miniatura: i.miniatura ?? null,
			}),
		);

		setNombre(plantilla?.nombre ?? "");
		setItems(desdeLaGuardada);
		escribirBorradorDePlantilla({
			plantillaId,
			nombre: plantilla?.nombre ?? "",
			items: desdeLaGuardada,
		});
		setListo(true);
	}, [plantillaId]);

	/** Todo cambio va al borrador: el editor es una salida y puede pasar ya. */
	function actualizar(
		siguiente: Partial<{ nombre: string; items: ItemDeBorrador[] }>,
	) {
		const b = {
			plantillaId,
			nombre: siguiente.nombre ?? nombre,
			items: siguiente.items ?? items,
		};

		if (siguiente.nombre !== undefined) setNombre(siguiente.nombre);
		if (siguiente.items !== undefined) setItems(siguiente.items);

		escribirBorradorDePlantilla(b);
	}

	/**
	 * Un producto entra a la plantilla.
	 *
	 * EL CAJÓN SE CIERRA AL ELEGIR, y no se queda abierto para seguir eligiendo:
	 * ver la pieza caer en la lista es lo que explica qué acaba de pasar. Volver
	 * a abrirlo es un toque en el mismo botón, que queda justo debajo.
	 */
	function agregar(producto: ProductoDeCatalogo) {
		actualizar({
			items: [
				...items,
				{
					clave: nuevaClave(),
					productoId: producto.id,
					nombre: producto.name,
					colorPrenda: null,
					// Una pieza de la primera talla como punto de partida: se ajusta
					// en el panel, que es donde se ve el conjunto.
					tallas: [{ size: producto.sizes?.[0]?.size ?? "Única", piezas: 1 }],
					origen: null,
					itemId: null,
					lados: [],
					miniatura: producto.images[0]?.url ?? null,
				},
			],
		});

		setEligiendo(false);
	}

	if (!listo) return <Cargando />;

	const piezas = items.reduce(
		(n, i) => n + i.tallas.reduce((s, t) => s + t.piezas, 0),
		0,
	);
	const sinDisenar = items.filter((i) => !i.itemId && !i.origen).length;
	/* Sólo se avisa de cambios sin guardar si de verdad los hay: al abrir a
	   editar, el borrador es copia exacta de lo guardado y un aviso ahí sería
	   mentira, de las que enseñan a ignorar los avisos. */
	const hayCambios = plantilla
		? firma(nombre, items) !== firma(plantilla.nombre, plantilla.items)
		: false;

	async function guardar() {
		if (!nombre.trim()) {
			toast.error("Ponle un nombre para poder encontrarla");
			return;
		}
		if (items.length === 0) {
			// El servidor rechaza una plantilla vacía, así que quitarlo todo no es
			// una forma de borrarla: se dice dónde está el botón que sí.
			toast.error(
				plantilla
					? "Una plantilla no puede quedarse vacía"
					: "Agrega al menos un producto",
				plantilla
					? { description: "Si ya no la quieres, bórrala desde la lista." }
					: undefined,
			);
			return;
		}

		setGuardando(true);
		const contenido = {
			nombre: nombre.trim(),
			items: items.map((i) => ({
				productoId: i.productoId,
				origen: i.origen,
				colorPrenda: i.colorPrenda,
				tallas: i.tallas,
				nombre: i.nombre,
				itemId: i.itemId,
				lados: i.lados,
				miniatura: i.miniatura,
			})),
		};

		try {
			if (plantilla) {
				await guardarPlantilla(plantilla.id, contenido);
			} else {
				await crearPlantilla(contenido);
			}

			// El borrador se tira DESPUÉS de que la plantilla existe: al revés, un
			// fallo al guardar dejaría a alguien sin plantilla y sin borrador.
			borrarBorradorDePlantilla();
			toast.success(plantilla ? "Plantilla actualizada" : "Plantilla guardada");
			onSalir();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "No pudimos guardarla.",
			);
			setGuardando(false);
		}
	}

	return (
		<div className="flex max-w-[1020px] flex-col">
			{/* La misma línea de arriba que abren las demás secciones del panel.
			    Aquí carga con explicar qué es una plantilla, porque la palabra no
			    lo dice sola y ésta es la primera pantalla donde hace falta. */}
			<p className="-mt-3 pb-6 text-[15px] leading-[25px] text-tinta/65">
				Un paquete de productos con sus cantidades, guardado para volver a
				pedirlo sin armarlo de cero.
			</p>

			<div className="flex flex-col gap-6">
				<section className="flex flex-col gap-4 rounded-2xl border border-tinta/10 bg-white p-6">
					<div>
						<Titulo>Qué lleva</Titulo>
						<p className="pt-1 text-[14px] leading-[22px] text-tinta/60">
							{items.length === 0
								? "Elige del catálogo. Pueden ser de talleres distintos."
								: `${items.length} ${items.length === 1 ? "producto" : "productos"} · ${piezas} ${piezas === 1 ? "pieza" : "piezas"}`}
						</p>
					</div>

					{items.map((item, i) => (
						<Fila
							key={item.clave}
							item={item}
							producto={porId.get(item.productoId) ?? null}
							// Sólo cuando el catálogo ya llegó: mientras carga, el mapa
							// está vacío y todo parecería despublicado.
							noPublicado={!!catalogo && !porId.has(item.productoId)}
							onTallas={(tallas) =>
								actualizar({
									items: items.map((x, j) => (j === i ? { ...x, tallas } : x)),
								})
							}
							onQuitar={() =>
								actualizar({ items: items.filter((_, j) => j !== i) })
							}
						/>
					))}

					<button
						type="button"
						onClick={() => setEligiendo(true)}
						className="inline-flex h-[52px] items-center justify-center gap-2 self-start rounded-2xl border-[1.5px] border-tinta bg-transparent px-5 text-[15px] font-semibold text-tinta transition-colors hover:bg-tinta hover:text-lima"
					>
						<Plus className="size-4.5" aria-hidden />
						{items.length === 0 ? "Elegir productos" : "Agregar otro producto"}
					</button>

					{sinDisenar > 0 && (
						<p className="text-[13px] leading-[21px] text-tinta/55">
							{sinDisenar === 1
								? "Uno todavía sin diseño. Se lo puedes poner ahora o al pedirla."
								: `${sinDisenar} todavía sin diseño. Se los puedes poner ahora o al pedirla.`}
						</p>
					)}
				</section>

				<section className="flex flex-col gap-4 rounded-2xl border border-tinta/10 bg-white p-6">
					<Titulo>Cómo se llama</Titulo>

					<label className="flex flex-col gap-2">
						<span className="text-sm font-semibold text-tinta">Nombre</span>
						<input
							value={nombre}
							onChange={(e) => actualizar({ nombre: e.target.value })}
							placeholder="Kit de bienvenida"
							maxLength={60}
							className="h-[52px] max-w-[420px] rounded-2xl border-[1.5px] border-tinta/12 bg-white px-4 text-base text-tinta outline-none placeholder:text-tinta/45 focus:border-tinta/30 focus:shadow-[0_0_0_4px_rgba(43,40,18,0.04)]"
						/>
						<span className="text-[13px] leading-[21px] text-tinta/55">
							Es como la vas a encontrar el mes que viene.
						</span>
					</label>
				</section>
			</div>

			{/* El pie de las demás pantallas: el botón y, al lado, qué va a pasar.
			    Con la respuesta en el mismo sitio donde ya se está mirando. */}
			<div className="flex flex-wrap items-center gap-4 pt-[22px]">
				<button
					type="button"
					onClick={guardar}
					// Sin productos NO se apaga: un botón muerto no dice qué falta.
					// Pulsarlo sí.
					disabled={guardando}
					className="h-[52px] rounded-2xl bg-tinta px-[26px] text-[16px] font-semibold text-lima disabled:cursor-not-allowed disabled:bg-tinta/14 disabled:text-tinta/40"
				>
					{guardando
						? "Guardando…"
						: plantilla
							? "Guardar cambios"
							: "Guardar plantilla"}
				</button>

				<span className="text-[15px] text-tinta/55">
					{hayCambios
						? "Tienes cambios sin guardar."
						: "Nada se guarda hasta que lo confirmes."}
				</span>
			</div>

			{/* Montado siempre y abierto por `abierto`: desmontarlo al cerrar se
			    come la animación de salida del cajón. */}
			<ElegirDelCatalogo
				abierto={eligiendo}
				onCerrar={() => setEligiendo(false)}
				onElegir={agregar}
			/>
		</div>
	);
}

/** El mismo título de tarjeta que usan las demás secciones del panel. */
function Titulo({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
			{children}
		</h2>
	);
}

function ElegirDelCatalogo({
	abierto,
	onElegir,
	onCerrar,
}: {
	abierto: boolean;
	onElegir: (p: ProductoDeCatalogo) => void;
	onCerrar: () => void;
}) {
	return (
		<Drawer
			open={abierto}
			onOpenChange={(sigueAbierto) => {
				if (!sigueAbierto) onCerrar();
			}}
		>
			<DrawerContent className="max-h-[88vh] bg-hueso">
				<DrawerHeader className="shrink-0 border-b border-tinta/10 px-5 pb-3.5 md:text-left">
					<div className="mx-auto flex w-full max-w-[1100px] items-start justify-between gap-4">
						<div className="text-left">
							<DrawerTitle className="font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
								Elige un producto
							</DrawerTitle>
							<DrawerDescription className="pt-0.5 text-[13px] text-tinta/55">
								Se suma a la plantilla. El diseño y las cantidades se ponen
								después.
							</DrawerDescription>
						</div>

						<DrawerClose asChild>
							<button
								type="button"
								aria-label="Cerrar el catálogo"
								className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-tinta/55 hover:bg-gris hover:text-tinta"
							>
								<X className="size-5" aria-hidden />
							</button>
						</DrawerClose>
					</div>
				</DrawerHeader>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-5">
					<div className="mx-auto w-full max-w-[1100px]">
						<ExplorarCatalogo onElegir={onElegir} />
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

function firma(
	nombre: string,
	items: {
		productoId: string;
		itemId?: string | null;
		colorPrenda: string | null;
		tallas: { size: string; piezas: number }[];
	}[],
) {
	return JSON.stringify([
		nombre.trim(),
		items.map((i) => [i.productoId, i.itemId ?? null, i.colorPrenda, i.tallas]),
	]);
}

/**
 * Un producto de la plantilla: qué es, si tiene diseño y cuántas piezas.
 *
 * LAS TRES COSAS SE SEPARAN a propósito. Antes iban en una sola línea —el
 * estado del diseño era un enlace gris de 13px al lado del nombre— y lo que
 * hay que hacer con la fila no se leía: parecía el renglón de una tabla y no
 * algo con lo que trabajar.
 */
function Fila({
	item,
	producto,
	noPublicado,
	onTallas,
	onQuitar,
}: {
	item: ItemDeBorrador;
	/** El del catálogo, si sigue publicado. Da las tallas y el precio. */
	producto: ProductoDeCatalogo | null;
	/** El taller lo despublicó. Se dice aquí porque aquí es donde se quita. */
	noPublicado: boolean;
	onTallas: (tallas: { size: string; piezas: number }[]) => void;
	onQuitar: () => void;
}) {
	const conDiseno = !!item.itemId || !!item.origen;
	const piezas = item.tallas.reduce((s, t) => s + t.piezas, 0);
	const puestas = item.tallas.map((t) => t.size);
	const disponibles = (producto?.sizes ?? [])
		.map((s) => s.size)
		.filter((size) => !puestas.includes(size));

	function cambiar(indice: number, delta: number) {
		const siguiente = item.tallas[indice].piezas + delta;

		/* Bajar de una pieza quita la talla, pero sólo si queda otra: un producto
		   con cero piezas en la plantilla no significa nada, y dejar la fila sin
		   ninguna talla la volvería impedible. */
		if (siguiente < 1) {
			if (item.tallas.length > 1) {
				onTallas(item.tallas.filter((_, i) => i !== indice));
			}
			return;
		}

		onTallas(
			item.tallas.map((t, i) =>
				i === indice ? { ...t, piezas: siguiente } : t,
			),
		);
	}

	return (
		<article className="rounded-2xl border border-tinta/10 p-4">
			<div className="flex min-w-0 items-start gap-3">
				<div className="size-16 shrink-0 overflow-hidden rounded-xl bg-gris">
					{(item.miniatura ?? producto?.images[0]?.url) && (
						// biome-ignore lint/performance/noImgElement: export estático
						<img
							src={item.miniatura ?? producto?.images[0]?.url}
							alt=""
							className="size-full object-contain p-0.5"
						/>
					)}
				</div>

				<div className="min-w-0 flex-1">
					<p className="truncate text-[15px] font-semibold text-tinta">
						{item.nombre ?? "Producto"}
					</p>
					<p className="truncate pt-0.5 text-[12px] text-tinta/55">
						{producto?.basePrice
							? `desde ${pesos(producto.basePrice)} c/u`
							: (producto?.provider ?? "kustto")}
					</p>
				</div>

				<button
					type="button"
					onClick={onQuitar}
					aria-label={`Quitar ${item.nombre ?? "el producto"} de la plantilla`}
					className="-mr-1 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-tinta/45 hover:bg-[rgba(192,57,43,0.1)] hover:text-[#c0392b]"
				>
					<Trash2 className="size-4" aria-hidden />
				</button>
			</div>

			{/* El estado del diseño, con su acción pegada: es lo único de la fila
			    que puede faltar, así que se dice antes de que se pregunte. */}
			<div className="flex flex-wrap items-center gap-2 pt-2.5">
				{noPublicado ? (
					<Pastilla tono="rojo">Ya no se publica: quítalo</Pastilla>
				) : conDiseno ? (
					<>
						<Pastilla tono="lima">
							<Check className="mr-1 size-3.5" aria-hidden />
							Con diseño
						</Pastilla>
						<Link
							href={`/design/${encodeURIComponent(item.productoId)}?plantilla=${item.clave}`}
							className="text-[12px] font-semibold text-tinta/60 underline underline-offset-4 hover:text-tinta"
						>
							Cambiarlo
						</Link>
					</>
				) : (
					<Link
						href={`/design/${encodeURIComponent(item.productoId)}?plantilla=${item.clave}`}
						className="inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-tinta px-4 text-[13px] font-semibold text-tinta transition-colors hover:bg-tinta hover:text-lima"
					>
						<Pencil className="size-3.5" aria-hidden />
						Ponerle diseño
					</Link>
				)}
			</div>

			<div className="mt-3.5 border-t border-tinta/10 pt-3.5">
				<div className="flex items-baseline justify-between gap-3 pb-2">
					<p className="text-sm font-semibold text-tinta">Cantidades</p>
					<p className="shrink-0 text-[12px] tabular-nums text-tinta/50">
						{piezas} {piezas === 1 ? "pieza" : "piezas"}
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-1.5">
					{item.tallas.map((t, i) => (
						<div
							key={t.size}
							className="flex h-11 items-center overflow-hidden rounded-[10px] border-[1.5px] border-tinta/18 bg-white"
						>
							<span className="flex h-full min-w-11 items-center justify-center border-r-[1.5px] border-tinta/[0.12] bg-gris px-2 text-[13px] font-bold text-tinta">
								{t.size}
							</span>
							<button
								type="button"
								onClick={() => cambiar(i, -1)}
								aria-label={
									t.piezas === 1 && item.tallas.length > 1
										? `Quitar la talla ${t.size}`
										: `Quitar una talla ${t.size}`
								}
								className="h-full w-10 text-[18px] font-semibold text-tinta/60 hover:text-tinta"
							>
								−
							</button>
							<span className="min-w-[24px] text-center text-[13px] font-semibold tabular-nums text-tinta">
								{t.piezas}
							</span>
							<button
								type="button"
								onClick={() => cambiar(i, 1)}
								aria-label={`Agregar una talla ${t.size}`}
								className="h-full w-10 text-[18px] font-semibold text-tinta/60 hover:text-tinta"
							>
								+
							</button>
						</div>
					))}

					{/* SIN ESTO NO SE PODÍA PEDIR UN KIT. La fila nacía con una talla y
					    no había forma de añadir otra: cinco chicas y diez medianas, que
					    es la mitad de para qué sirve una plantilla, no cabían. */}
					{disponibles.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="inline-flex h-11 items-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-tinta/25 px-3.5 text-[13px] font-semibold text-tinta/70 hover:border-tinta/55 hover:text-tinta"
								>
									<Plus className="size-3.5" aria-hidden />
									Talla
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								{disponibles.map((size) => (
									<DropdownMenuItem
										key={size}
										onSelect={() =>
											onTallas([...item.tallas, { size, piezas: 1 }])
										}
									>
										{size}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>
		</article>
	);
}
