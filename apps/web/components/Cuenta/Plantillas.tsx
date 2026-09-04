"use client";

import {
	CircleAlert,
	Layers,
	Pencil,
	Plus,
	Repeat2,
	ShoppingCart,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	catalogoRecordado,
	getCatalogo,
	type ProductoDeCatalogo,
	porIdDeProducto,
} from "@/lib/api/catalogo";
import {
	borrarPlantilla,
	cargarPlantillaAlCarrito,
	getMisPlantillas,
	type ItemDePlantilla,
	type Plantilla,
} from "@/lib/api/cuenta";
import { useCarrito } from "@/lib/carrito/useCarrito";
import ArmarPlantilla from "./ArmarPlantilla";
import { Elemento } from "./animaciones";
import ConfirmarBorrado from "./ConfirmarBorrado";
import { fecha } from "./Pedidos";
import { Aviso, Cargando } from "./piezas";

/**
 * Las plantillas: la receta de un pedido que se repite.
 *
 * QUÉ RESUELVE, y por qué no es "Repetir" con otro nombre. Repetir clona un
 * pedido pasado tal cual. Una plantilla guarda la COMBINACIÓN —el kit de
 * bienvenida: playera, tote y termo— y deja ajustar cantidades entre una vez y
 * otra. Y puede mezclar líneas de pedidos DISTINTOS, que es lo que repetir no
 * sabe hacer.
 *
 * CARGARLA DEVUELVE TRES MONTONES, y la pantalla los enseña separados a
 * propósito. Un ítem con arte va derecho al carrito; uno sin arte pasa por el
 * editor; uno cuyo producto se despublicó no va a ninguna parte. Meterlos en
 * un solo mensaje —"se agregaron 2 de 4"— dejaría a alguien sin saber qué le
 * falta hacer con los otros dos.
 */
export default function Plantillas() {
	const router = useRouter();
	const { agregarVarios } = useCarrito();

	/* `?nueva=1` y `?editar=<id>` en la URL y no sólo estado: diseñar un
	   producto sale de la pantalla, y al volver hay que aterrizar en el
	   constructor —y en el de la plantilla correcta—, no en la lista. Con esto
	   el editor puede devolver a un sitio concreto. */
	const [armando, setArmando] = useState<
		{ nueva: true } | { nueva: false; id: string } | null
	>(null);
	const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null);
	const [fallo, setFallo] = useState<string | null>(null);
	/** Cuál se está cargando. Sirve para bloquear sólo ESA tarjeta. */
	const [cargando, setCargando] = useState<string | null>(null);

	/* El catálogo, sólo para las fotos: una plantilla guardada desde un pedido
	   no lleva miniatura —el pedido no la tenía— y sin esto media tarjeta
	   saldría con huecos grises. */
	const [catalogo, setCatalogo] = useState<ProductoDeCatalogo[] | null>(
		catalogoRecordado,
	);
	useEffect(() => {
		getCatalogo()
			.then(setCatalogo)
			.catch(() => {});
	}, []);
	const porId = useMemo(() => porIdDeProducto(catalogo), [catalogo]);

	useEffect(() => {
		const url = new URLSearchParams(window.location.search);
		const editar = url.get("editar");

		if (editar) setArmando({ nueva: false, id: editar });
		else if (url.has("nueva")) setArmando({ nueva: true });
	}, []);

	useEffect(() => {
		getMisPlantillas()
			.then(setPlantillas)
			.catch(() => setFallo("No pudimos traer tus plantillas."));
	}, []);

	function salirDelConstructor() {
		setArmando(null);
		// Se limpia el `?nueva` / `?editar` para que recargar no reabra el
		// constructor con un borrador que ya se guardó.
		window.history.replaceState(null, "", "/cuenta?s=plantillas");
		getMisPlantillas()
			.then(setPlantillas)
			.catch(() => {});
	}

	if (armando?.nueva) {
		return <ArmarPlantilla plantilla={null} onSalir={salirDelConstructor} />;
	}

	if (fallo) return <Aviso texto={fallo} />;
	if (!plantillas) return <Cargando />;

	/* Editar espera a que la lista llegue: hace falta la plantilla entera, y
	   pedirla suelta por id sería una llamada más para lo mismo. Si el id no
	   está —se borró desde otra pestaña— se cae a la lista en vez de dejar una
	   pantalla en blanco. */
	if (armando && !armando.nueva) {
		const suya = plantillas.find((p) => p.id === armando.id);

		if (suya) {
			return <ArmarPlantilla plantilla={suya} onSalir={salirDelConstructor} />;
		}
	}

	/* La primera vez, el botón de crear va DENTRO del hueco y no flotando
	   encima: quien llega aquí sin plantillas necesita saber qué es esto antes
	   que un botón, y el botón tiene que estar donde acaba de leerlo. La otra
	   vía —guardarla desde un pedido— queda de salida secundaria, que es lo que
	   es: sólo sirve si ya se pidió algo. */
	if (plantillas.length === 0) {
		return (
			<div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-tinta/20 px-6 py-14 text-center">
				<span
					className="inline-flex size-12 items-center justify-center rounded-full bg-gris text-tinta/60"
					aria-hidden
				>
					<Layers className="size-6" />
				</span>
				<p className="font-display text-[19px] font-semibold tracking-[-0.02em] text-tinta">
					Todavía no tienes plantillas
				</p>
				<p className="max-w-[44ch] text-[15px] leading-[24px] text-tinta/60">
					Una plantilla guarda una combinación que repites —el kit de
					bienvenida, el set de graduación— para pedirla otra vez sin armarla de
					cero.
				</p>
				<button
					type="button"
					onClick={() => setArmando({ nueva: true })}
					className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-tinta px-6 text-[15px] font-semibold text-lima"
				>
					<Plus className="size-4.5" aria-hidden />
					Crear plantilla
				</button>
				<Link
					href="/cuenta?s=pedidos"
					className="text-[14px] font-semibold text-tinta/60 underline underline-offset-4 hover:text-tinta"
				>
					O guárdala desde un pedido que ya hiciste
				</Link>
			</div>
		);
	}

	async function cargar(plantilla: Plantilla) {
		setCargando(plantilla.id);

		try {
			const { articulos, porDisenar, perdidos } =
				await cargarPlantillaAlCarrito(plantilla.id);

			if (articulos.length > 0) {
				agregarVarios(
					articulos.map((a) => ({
						...a,
						proveedorNombre: a.proveedorNombre ?? null,
						// El id y la hora los pone el navegador: identifican la línea
						// DENTRO de este carrito y no significan nada en el servidor.
						id: crypto.randomUUID(),
						agregadoEn: Date.now(),
					})),
				);
			}

			/* Un aviso por montón, no uno resumido. Cada uno pide algo distinto
			   de quien lo lee, y "2 de 4" no dice qué hacer con los otros dos. */
			if (articulos.length > 0) {
				toast.success(
					`${articulos.length} ${articulos.length === 1 ? "producto" : "productos"} al carrito`,
				);
			}

			/* Los dos avisos llevan el atajo a editarla: es lo que hay que hacer
			   en ambos casos —ponerle diseño al que no tiene, quitar el que ya no
			   se publica— y decirlo sin dar el camino obliga a buscarlo. */
			const irAEditarla = {
				label: "Editar",
				onClick: () => setArmando({ nueva: false, id: plantilla.id }),
			};

			if (porDisenar.length > 0) {
				toast(
					`${porDisenar.length} ${porDisenar.length === 1 ? "producto necesita" : "productos necesitan"} que le pongas el diseño`,
					{
						description: "Ábrelos desde la plantilla cuando quieras.",
						action: irAEditarla,
					},
				);
			}

			if (perdidos.length > 0) {
				toast.error(
					`${perdidos.length} ${perdidos.length === 1 ? "producto ya no se publica" : "productos ya no se publican"}`,
					{
						description: "Quítalos de la plantilla para que no estorben.",
						action: irAEditarla,
					},
				);
			}

			if (articulos.length === 0 && porDisenar.length === 0) {
				toast.error("Nada de esta plantilla se puede pedir ahora mismo.");
				return;
			}

			// Sólo se va al carrito si de verdad entró algo: llevar a un carrito
			// sin cambios haría dudar de si el botón funcionó.
			if (articulos.length > 0) router.push("/carrito");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "No pudimos cargar esa plantilla.",
			);
		} finally {
			setCargando(null);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-[13px] text-tinta/50">
					{plantillas.length}{" "}
					{plantillas.length === 1 ? "plantilla" : "plantillas"}
				</p>
				<BotonCrear onCrear={() => setArmando({ nueva: true })} />
			</div>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{plantillas.map((plantilla, i) => (
					<Elemento key={plantilla.id} indice={i}>
						<Tarjeta
							plantilla={plantilla}
							porId={porId}
							cargando={cargando === plantilla.id}
							bloqueada={cargando !== null}
							onCargar={() => cargar(plantilla)}
							onEditar={() => setArmando({ nueva: false, id: plantilla.id })}
							onBorrada={() =>
								setPlantillas((antes) =>
									(antes ?? []).filter((p) => p.id !== plantilla.id),
								)
							}
						/>
					</Elemento>
				))}
			</div>
		</div>
	);
}

function Tarjeta({
	plantilla,
	porId,
	cargando,
	bloqueada,
	onCargar,
	onEditar,
	onBorrada,
}: {
	plantilla: Plantilla;
	porId: Map<string, ProductoDeCatalogo>;
	cargando: boolean;
	bloqueada: boolean;
	onCargar: () => void;
	onEditar: () => void;
	onBorrada: () => void;
}) {
	const [confirmando, setConfirmando] = useState(false);

	const piezas = plantilla.items.reduce(
		(n, item) => n + item.tallas.reduce((s, t) => s + t.piezas, 0),
		0,
	);
	/* Cuántos van a pasar por el editor. Se dice ANTES de pulsar: enterarse
	   después de que medio kit necesita trabajo es la sorpresa que hace que la
	   función se sienta rota. */
	const sinArte = plantilla.items.filter(
		(item) => !item.origen && !item.itemId,
	).length;

	/** La suya si la tiene; si no, la del catálogo. */
	const fotoDe = (item: ItemDePlantilla) =>
		item.miniatura ?? porId.get(item.productoId)?.images[0]?.url ?? null;

	async function quitar(): Promise<string | null> {
		try {
			await borrarPlantilla(plantilla.id);
			onBorrada();
			return null;
		} catch {
			return "No pudimos borrar esa plantilla. Inténtalo otra vez.";
		}
	}

	return (
		<article
			aria-busy={cargando}
			className="flex flex-col gap-3.5 rounded-2xl border border-tinta/10 bg-white p-5"
		>
			<div className="flex items-start justify-between gap-3">
				<h3 className="min-w-0 flex-1 truncate font-display text-[17px] font-bold tracking-[-0.014em] text-tinta">
					{plantilla.nombre}
				</h3>

				{plantilla.vecesPedida > 0 && (
					<span
						title={`Pedida ${plantilla.vecesPedida} ${plantilla.vecesPedida === 1 ? "vez" : "veces"}`}
						className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gris px-2.5 py-1 text-[11px] font-semibold text-tinta"
					>
						<Repeat2 className="size-3" aria-hidden />
						{plantilla.vecesPedida}
					</span>
				)}
			</div>

			{/* SE VE LO QUE LLEVA, no se lee. Antes era una lista de cuatro
			    renglones de texto de 13px con el nombre del producto y su número
			    al lado: para reconocer "el kit de bienvenida" entre cinco
			    plantillas hay que ver la playera y el termo, no leerlos. */}
			<ul className="flex flex-wrap gap-2" aria-hidden>
				{plantilla.items.slice(0, 4).map((item, i) => (
					<li
						key={`${item.productoId}-${i}`}
						className="size-14 overflow-hidden rounded-xl border border-tinta/8 bg-gris"
					>
						{fotoDe(item) && (
							// biome-ignore lint/performance/noImgElement: export estático
							<img
								src={fotoDe(item) ?? undefined}
								alt=""
								loading="lazy"
								className="size-full object-contain p-0.5"
							/>
						)}
					</li>
				))}
				{plantilla.items.length > 4 && (
					<li className="flex size-14 items-center justify-center rounded-xl bg-gris text-[13px] font-semibold text-tinta/55">
						+{plantilla.items.length - 4}
					</li>
				)}
			</ul>

			<p className="text-[13px] text-tinta/60">
				<span className="font-semibold text-tinta">
					{plantilla.items.length}{" "}
					{plantilla.items.length === 1 ? "producto" : "productos"}
				</span>{" "}
				· {piezas} {piezas === 1 ? "pieza" : "piezas"}
				<span className="sr-only">
					: {plantilla.items.map((i) => i.nombre ?? "Producto").join(", ")}
				</span>
			</p>

			{sinArte > 0 && (
				<p className="flex items-start gap-2 rounded-xl bg-gris px-3 py-2 text-[12px] leading-[18px] text-tinta/65">
					<CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
					{sinArte === 1
						? "Un producto pasa por el editor: todavía no tiene diseño."
						: `${sinArte} productos pasan por el editor: todavía no tienen diseño.`}
				</p>
			)}

			<p className="text-[12px] text-tinta/45">
				{plantilla.ultimaVez
					? `Última vez: ${fecha(plantilla.ultimaVez)}`
					: `Creada el ${fecha(plantilla.creadaEn)}`}
			</p>

			<div className="mt-auto flex items-center gap-1 pt-1">
				<button
					type="button"
					onClick={onCargar}
					disabled={bloqueada}
					className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-tinta px-4 text-[14px] font-semibold text-lima disabled:cursor-not-allowed disabled:opacity-50"
				>
					{cargando ? (
						"Preparando…"
					) : (
						<>
							<ShoppingCart className="size-4" aria-hidden />
							Al carrito
						</>
					)}
				</button>

				{/* Editar abre la plantilla entera —nombre, productos y
				    cantidades— en vez de un cuadro para renombrar. Renombrar era
				    lo único que se podía cambiar, y era lo de menos: lo que se
				    ajusta entre un pedido y otro son las cantidades. */}
				<button
					type="button"
					onClick={onEditar}
					disabled={bloqueada}
					aria-label={`Editar ${plantilla.nombre}`}
					title="Editar"
					className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-tinta/55 hover:bg-gris hover:text-tinta disabled:opacity-40"
				>
					<Pencil className="size-4" aria-hidden />
				</button>

				<button
					type="button"
					onClick={() => setConfirmando(true)}
					disabled={bloqueada}
					aria-label={`Borrar ${plantilla.nombre}`}
					title="Borrar"
					className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-tinta/55 hover:bg-[rgba(192,57,43,0.1)] hover:text-[#c0392b] disabled:opacity-40"
				>
					<Trash2 className="size-4" aria-hidden />
				</button>
			</div>

			<ConfirmarBorrado
				abierto={confirmando}
				onAbrir={setConfirmando}
				nombre={plantilla.nombre}
				producto={`${plantilla.items.length} productos · ${piezas} piezas`}
				imagen={null}
				onConfirmar={quitar}
			/>
		</article>
	);
}

function BotonCrear({ onCrear }: { onCrear: () => void }) {
	return (
		<button
			type="button"
			onClick={onCrear}
			className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-tinta px-5 text-[14px] font-semibold text-lima"
		>
			<Plus className="size-4" aria-hidden />
			Crear plantilla
		</button>
	);
}
