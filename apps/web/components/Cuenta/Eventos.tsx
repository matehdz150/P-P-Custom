"use client";

import {
	CalendarClock,
	Camera,
	CircleCheckBig,
	Copy,
	Download,
	ImageOff,
	Loader2,
	Plus,
	Share2,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getCatalogo, type ProductoDeCatalogo } from "@/lib/api/catalogo";
import {
	actualizarEvento,
	cerrarEvento,
	configurarProductoDeEvento,
	crearEvento,
	type DatosDeEvento,
	type Evento,
	listarEventos,
	obtenerEvento,
	publicarEvento,
} from "@/lib/api/eventos";
import {
	MAXIMO_FOTO,
	subirFotoDeEvento,
	TIPOS_DE_FOTO,
} from "@/lib/eventos/foto";

const CAMPO =
	"h-12 w-full rounded-[10px] border-[1.5px] border-tinta/15 bg-white px-3.5 text-[14px] outline-none transition focus:border-tinta";

/** Las tres reglas del contrato, con el nombre que ve el organizador. */
const REGLAS: {
	valor: Evento["productos"][number]["personalizacion"];
	nombre: string;
}[] = [
	{ valor: "libre", nombre: "Editar todo" },
	{ valor: "bloqueada", nombre: "Agregar sobre el diseño base" },
	{ valor: "sin_personalizacion", nombre: "Sólo elegir talla y color" },
];

export default function Eventos() {
	const [eventos, setEventos] = useState<Evento[] | null>(null);
	const [actual, setActual] = useState<Evento | null>(null);
	const [editando, setEditando] = useState<Evento | null>(null);
	const [creando, setCreando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);
	const [productoConDisenoGuardado, setProductoConDisenoGuardado] = useState<
		string | null
	>(null);

	const cargar = async () => {
		try {
			setFallo(null);
			setEventos(await listarEventos());
		} catch (error) {
			setFallo(
				error instanceof Error
					? error.message
					: "No pudimos cargar tus eventos.",
			);
		}
	};

	useEffect(() => {
		listarEventos()
			.then(setEventos)
			.catch((error) =>
				setFallo(
					error instanceof Error
						? error.message
						: "No pudimos cargar tus eventos.",
				),
			);
		const parametros = new URLSearchParams(window.location.search);
		const editandoId = parametros.get("editar");
		const eventoId = parametros.get("evento");
		const productoGuardado =
			parametros.get("disenoBase") === "guardado"
				? (parametros.get("producto") ?? "")
				: null;
		if (editandoId) {
			obtenerEvento(editandoId)
				.then((evento) => {
					setEditando(evento);
					if (productoGuardado !== null) {
						setProductoConDisenoGuardado(productoGuardado);
						toast.success("Diseño base guardado");
					}
				})
				.catch(() => setFallo("No pudimos reabrir ese borrador."));
		} else if (eventoId) {
			obtenerEvento(eventoId)
				.then(setActual)
				.catch(() => setFallo("No pudimos abrir ese evento."));
		}
	}, []);

	const abrir = async (evento: Evento) => {
		try {
			setActual(await obtenerEvento(evento.id));
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "No pudimos abrir el evento.",
			);
		}
	};

	if (creando || editando) {
		return (
			<FormularioEvento
				evento={editando}
				productoConDisenoGuardado={productoConDisenoGuardado}
				onCancelar={() => {
					setCreando(false);
					setEditando(null);
				}}
				onGuardado={(evento) => {
					setCreando(false);
					setEditando(null);
					setEventos((previo) => [
						evento,
						...(previo ?? []).filter((e) => e.id !== evento.id),
					]);
					setActual({ ...evento, participaciones: [] });
				}}
			/>
		);
	}

	if (actual) {
		return (
			<DetalleEvento
				evento={actual}
				onVolver={() => {
					setActual(null);
					void cargar();
				}}
				onEditar={() => {
					setEditando(actual);
					setActual(null);
				}}
				onCambio={setActual}
			/>
		);
	}

	return (
		<div className="max-w-[1100px]">
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
				<p className="max-w-[58ch] text-[14px] leading-6 text-tinta/60">
					Crea una tienda temporal, comparte el enlace y recibe en un solo lugar
					los pedidos de todos tus invitados.
				</p>
				<button
					type="button"
					onClick={() => setCreando(true)}
					className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-tinta px-5 text-[14px] font-semibold text-lima"
				>
					<Plus className="size-4" aria-hidden /> Crear evento
				</button>
			</div>

			{fallo && (
				<p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
					{fallo}
				</p>
			)}
			{eventos === null && (
				<p className="py-14 text-sm text-tinta/50">Cargando eventos…</p>
			)}
			{eventos?.length === 0 && (
				<div className="mt-8 rounded-[20px] border border-dashed border-tinta/20 bg-hueso p-10 text-center">
					<CalendarClock className="mx-auto size-8 text-tinta/45" aria-hidden />
					<h2 className="pt-4 font-display text-[22px] font-semibold">
						Tu primer evento empieza aquí
					</h2>
					<p className="mx-auto max-w-[48ch] pt-2 text-sm leading-6 text-tinta/60">
						Elige los productos, marca una fecha límite y comparte el enlace con
						tu grupo.
					</p>
				</div>
			)}

			<div className="grid gap-5 pt-7 md:grid-cols-2">
				{eventos?.map((evento) => (
					<button
						key={evento.id}
						type="button"
						onClick={() => void abrir(evento)}
						className="overflow-hidden rounded-[20px] border border-tinta/10 bg-white text-left transition hover:border-tinta/30"
					>
						<Portada imagen={evento.imagen} className="h-[150px]">
							<span className="absolute left-3.5 top-3.5">
								<Estado
									estado={evento.estado}
									sobreFoto={Boolean(evento.imagen)}
								/>
							</span>
						</Portada>
						<div className="p-5">
							<p className="font-display text-[20px] font-semibold leading-tight">
								{evento.nombre}
							</p>
							<p className="pt-1.5 text-sm text-tinta/55">
								{evento.productos.length}{" "}
								{evento.productos.length === 1 ? "producto" : "productos"} ·{" "}
								{evento.estado === "borrador"
									? "sin publicar"
									: `cierra ${fecha(evento.cierraEn)}`}
							</p>
							{evento.estado === "borrador" && (
								<p className="mt-4 rounded-xl bg-gris px-3.5 py-3 text-xs leading-5 text-tinta/60">
									Nadie puede verlo hasta que lo publiques.
								</p>
							)}
						</div>
					</button>
				))}
			</div>
		</div>
	);
}

/**
 * La portada del evento, y el hueco cuando todavía no hay.
 *
 * EL DEGRADADO NO ES DECORACIÓN. Un evento sin foto y uno con foto tienen que
 * ocupar el mismo alto en la lista: si el hueco se encogiera, publicar una
 * foto movería de sitio todas las tarjetas de abajo.
 */
function Portada({
	imagen,
	className,
	children,
}: {
	imagen: string | null;
	className: string;
	children?: React.ReactNode;
}) {
	if (!imagen) {
		return (
			<div
				className={`relative grid place-items-center border-b border-dashed border-tinta/15 bg-gris ${className}`}
			>
				<div className="text-center">
					<ImageOff className="mx-auto size-6 text-tinta/35" aria-hidden />
					<p className="pt-2 text-xs font-semibold text-tinta/45">
						Sin foto todavía
					</p>
				</div>
				{children}
			</div>
		);
	}
	return (
		<div className={`relative overflow-hidden bg-tinta ${className}`}>
			{/* biome-ignore lint/performance/noImgElement: el export estático no
			    optimiza imágenes y `next/image` sólo añadiría envoltorio. */}
			<img src={imagen} alt="" className="size-full object-cover" />
			{children}
		</div>
	);
}

function FormularioEvento({
	evento,
	productoConDisenoGuardado,
	onCancelar,
	onGuardado,
}: {
	evento: Evento | null;
	productoConDisenoGuardado: string | null;
	onCancelar: () => void;
	onGuardado: (evento: Evento) => void;
}) {
	const router = useRouter();
	const formulario = useRef<HTMLFormElement>(null);
	/* Si crear el evento sí funcionó pero una llamada posterior falló, reintentar
	   debe actualizar ese borrador y no crear un segundo evento idéntico. */
	const eventoPersistido = useRef<Evento | null>(evento);
	const [catalogo, setCatalogo] = useState<ProductoDeCatalogo[]>([]);
	const [seleccion, setSeleccion] = useState<string[]>(
		evento?.productos.map((p) => p.productoId) ?? [],
	);
	/* Las reglas se guardan por producto DEL CATÁLOGO, no por renglón del
	   evento: al crear todavía no existen los renglones. */
	const [reglas, setReglas] = useState<Record<string, string>>(
		Object.fromEntries(
			(evento?.productos ?? []).map((p) => [p.productoId, p.personalizacion]),
		),
	);
	const [imagen, setImagen] = useState<string | null>(evento?.imagen ?? null);
	const [guardando, setGuardando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);
	const ahora = useMemo(() => new Date(), []);
	const [datos, setDatos] = useState({
		nombre: evento?.nombre ?? "",
		descripcion: evento?.descripcion ?? "",
		abreEn: paraCampo(evento ? new Date(evento.abreEn) : ahora),
		cierraEn: paraCampo(
			evento
				? new Date(evento.cierraEn)
				: new Date(ahora.getTime() + 7 * 86400000),
		),
		calle: evento?.direccion.calle ?? "",
		numero: evento?.direccion.numero ?? "",
		interior: evento?.direccion.interior ?? "",
		colonia: evento?.direccion.colonia ?? "",
		ciudad: evento?.direccion.ciudad ?? "",
		estado: evento?.direccion.estado ?? "",
		cp: evento?.direccion.cp ?? "",
		referencias: evento?.direccion.referencias ?? "",
	});

	useEffect(() => {
		getCatalogo()
			.then(setCatalogo)
			.catch(() => setFallo("No pudimos cargar el catálogo."));
	}, []);

	const cambiar = (campo: string, valor: string) =>
		setDatos((previo) => ({ ...previo, [campo]: valor }));

	const persistir = async () => {
		const cuerpo: DatosDeEvento = {
			nombre: datos.nombre,
			descripcion: datos.descripcion,
			imagen,
			abreEn: new Date(datos.abreEn).toISOString(),
			cierraEn: new Date(datos.cierraEn).toISOString(),
			productos: seleccion,
			direccion: {
				calle: datos.calle,
				numero: datos.numero,
				interior: datos.interior || null,
				colonia: datos.colonia,
				ciudad: datos.ciudad,
				estado: datos.estado,
				cp: datos.cp,
				referencias: datos.referencias || null,
			},
		};
		let guardado = eventoPersistido.current
			? await actualizarEvento(eventoPersistido.current.id, cuerpo)
			: await crearEvento(cuerpo);
		eventoPersistido.current = guardado;

		/* Las reglas van en una llamada aparte porque el contrato las fija por
		   renglón del evento, y los renglones no existen hasta que el evento
		   está guardado. Sólo se manda lo que cambió. */
		for (const producto of guardado.productos) {
			const querida = reglas[producto.productoId];
			if (!querida || querida === producto.personalizacion) continue;
			guardado = await configurarProductoDeEvento(guardado.id, producto.id, {
				personalizacion:
					querida as Evento["productos"][number]["personalizacion"],
			});
			eventoPersistido.current = guardado;
		}
		return guardado;
	};

	const guardar = async (e: React.FormEvent) => {
		e.preventDefault();
		setGuardando(true);
		setFallo(null);
		try {
			const guardado = await persistir();

			onGuardado(guardado);
			toast.success(
				evento ? "Evento actualizado" : "Evento guardado como borrador",
			);
		} catch (error) {
			setFallo(
				error instanceof Error
					? error.message
					: "No pudimos guardar el evento.",
			);
		} finally {
			setGuardando(false);
		}
	};

	/** Guarda primero el formulario completo. Así también funciona durante la
	 * creación, cuando todavía no existe un `eventoItemId`, y ningún cambio de
	 * fechas, portada o reglas se pierde al abandonar la página. */
	const disenarBase = async (productoId: string) => {
		if (!formulario.current?.reportValidity()) return;
		if (!seleccion.length) {
			setFallo("Elige al menos un producto antes de crear su diseño base.");
			return;
		}
		setGuardando(true);
		setFallo(null);
		try {
			const guardado = await persistir();
			const producto = guardado.productos.find(
				(item) => item.productoId === productoId,
			);
			if (!producto) throw new Error("Ese producto ya no pertenece al evento.");
			router.push(rutaParaDisenoBase(guardado, producto));
		} catch (error) {
			setFallo(
				error instanceof Error
					? error.message
					: "No pudimos guardar el borrador antes de abrir el diseñador.",
			);
			setGuardando(false);
		}
	};

	const elegidos = catalogo.filter((p) => seleccion.includes(p.id));
	const disponibles = catalogo.filter((p) => !seleccion.includes(p.id));

	return (
		<form ref={formulario} onSubmit={guardar} className="max-w-[1000px] pb-4">
			<button
				type="button"
				onClick={onCancelar}
				className="text-sm font-semibold underline underline-offset-4"
			>
				← Todos los eventos
			</button>

			<div className="pt-5">
				<h2 className="font-display text-[26px] font-semibold">
					{evento ? "Editar evento" : "Nuevo evento"}
				</h2>
				<p className="pt-1 text-sm text-tinta/55">
					Nada será público hasta que lo publiques.
				</p>
			</div>

			{productoConDisenoGuardado !== null && (
				<div
					role="status"
					className="mt-5 flex items-start gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-emerald-900"
				>
					<CircleCheckBig className="mt-0.5 size-5 shrink-0" aria-hidden />
					<div>
						<p className="text-sm font-semibold">Diseño base guardado</p>
						<p className="pt-0.5 text-[13px] leading-5 text-emerald-800">
							Ya está asociado al producto. Puedes continuar configurando y
							guardar el evento cuando termines.
						</p>
					</div>
				</div>
			)}

			<div className="space-y-5 pt-6">
				<Seccion
					titulo="Identidad"
					nota="Es lo primero que verá tu grupo al abrir el enlace."
				>
					<div className="grid gap-5 md:grid-cols-[360px_minmax(0,1fr)]">
						<SubidorDeFoto imagen={imagen} onCambio={setImagen} />
						<div className="space-y-4">
							<label className="block text-sm font-semibold">
								Nombre del evento
								<input
									className={`${CAMPO} mt-2`}
									value={datos.nombre}
									onChange={(e) => cambiar("nombre", e.target.value)}
									placeholder="Graduación generación 2026"
									maxLength={80}
									required
								/>
							</label>
							<label className="block text-sm font-semibold">
								Descripción
								<textarea
									className="mt-2 min-h-24 w-full rounded-[10px] border-[1.5px] border-tinta/15 p-3.5 text-sm outline-none focus:border-tinta"
									value={datos.descripcion}
									onChange={(e) => cambiar("descripcion", e.target.value)}
									maxLength={500}
									placeholder="Cuéntales qué van a pedir y para cuándo."
								/>
							</label>
						</div>
					</div>
				</Seccion>

				<Seccion
					titulo="Cuándo"
					nota="Fuera de esas fechas el enlace deja de aceptar pedidos."
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className="block text-sm font-semibold">
							Abre
							<input
								type="datetime-local"
								className={`${CAMPO} mt-2`}
								value={datos.abreEn}
								onChange={(e) => cambiar("abreEn", e.target.value)}
								required
							/>
						</label>
						<label className="block text-sm font-semibold">
							Cierra
							<input
								type="datetime-local"
								className={`${CAMPO} mt-2`}
								value={datos.cierraEn}
								onChange={(e) => cambiar("cierraEn", e.target.value)}
								required
							/>
						</label>
					</div>
				</Seccion>

				<Seccion
					titulo="Productos"
					nota="Hasta cinco, y todos del mismo taller."
					extra={
						<span className="rounded-full bg-tinta/7 px-3 py-1.5 text-xs font-semibold">
							{seleccion.length} de 5 elegidos
						</span>
					}
				>
					{elegidos.length > 0 && (
						<div className="space-y-3">
							{elegidos.map((producto) => {
								const renglon = evento?.productos.find(
									(p) => p.productoId === producto.id,
								);
								return (
									<div
										key={producto.id}
										className="flex flex-wrap items-center gap-4 rounded-[14px] border-[1.5px] border-tinta p-3.5"
									>
										<div className="size-[72px] shrink-0 overflow-hidden rounded-[10px] bg-hueso">
											{producto.images[0]?.url && (
												/* biome-ignore lint/performance/noImgElement: fotos del
												   catálogo, remotas y sin optimizar en el export. */
												<img
													src={producto.images[0].url}
													alt=""
													className="size-full object-contain"
												/>
											)}
										</div>
										<div className="min-w-0 flex-1">
											<p className="font-display text-[17px] font-semibold">
												{producto.name}
											</p>
											<p className="pt-0.5 text-[13px] text-tinta/50">
												Desde {pesos(producto.basePrice ?? 0)}
											</p>
											{renglon?.disenoBase && (
												<p
													className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 ${
														productoConDisenoGuardado === renglon.id
															? "rounded-full bg-emerald-50 px-2 py-1"
															: ""
													}`}
												>
													<CircleCheckBig className="size-3.5" aria-hidden />
													Diseño base guardado
												</p>
											)}
										</div>
										<button
											type="button"
											disabled={guardando}
											onClick={() => void disenarBase(producto.id)}
											className="inline-flex h-10 shrink-0 items-center rounded-full border border-tinta px-4 text-xs font-semibold disabled:opacity-40"
										>
											{renglon?.disenoBase
												? "Editar diseño base"
												: "Crear diseño base"}
										</button>
										<label className="shrink-0 text-[11px] font-bold uppercase tracking-[0.07em] text-tinta/45">
											Los invitados pueden
											<select
												value={reglas[producto.id] ?? "libre"}
												onChange={(e) =>
													setReglas((p) => ({
														...p,
														[producto.id]: e.target.value,
													}))
												}
												className="mt-1.5 h-10 w-[236px] rounded-[10px] border-[1.5px] border-tinta/15 bg-white px-2.5 text-[13px] font-medium normal-case tracking-normal text-tinta"
											>
												{REGLAS.map((r) => (
													<option key={r.valor} value={r.valor}>
														{r.nombre}
													</option>
												))}
											</select>
										</label>
										<button
											type="button"
											aria-label={`Quitar ${producto.name}`}
											onClick={() =>
												setSeleccion((p) =>
													p.filter((id) => id !== producto.id),
												)
											}
											className="grid size-10 shrink-0 place-items-center rounded-full text-tinta/45 transition hover:bg-gris hover:text-tinta"
										>
											<Trash2 className="size-4" aria-hidden />
										</button>
									</div>
								);
							})}
						</div>
					)}

					{seleccion.length < 5 && (
						<div>
							<p className="pb-3 text-sm font-semibold">Elegir del catálogo</p>
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
								{disponibles.map((producto) => (
									<button
										key={producto.id}
										type="button"
										onClick={() =>
											setSeleccion((p) =>
												p.length < 5 ? [...p, producto.id] : p,
											)
										}
										className="overflow-hidden rounded-xl border border-tinta/10 text-left transition hover:border-tinta/40"
									>
										<div className="aspect-square bg-hueso">
											{producto.images[0]?.url && (
												/* biome-ignore lint/performance/noImgElement: fotos del
												   catálogo, remotas y sin optimizar en el export. */
												<img
													src={producto.images[0].url}
													alt=""
													className="size-full object-contain"
												/>
											)}
										</div>
										<div className="flex items-start justify-between gap-2 p-3">
											<span className="text-sm font-semibold leading-5">
												{producto.name}
											</span>
											<Plus
												className="size-4 shrink-0 text-tinta/45"
												aria-hidden
											/>
										</div>
									</button>
								))}
							</div>
						</div>
					)}
				</Seccion>

				<Seccion
					titulo="Entrega"
					nota="Todos los pedidos del evento llegan a esta dirección, en un solo envío."
				>
					<div className="grid gap-4 sm:grid-cols-2">
						{[
							["calle", "Calle"],
							["numero", "Número"],
							["interior", "Interior (opcional)"],
							["colonia", "Colonia"],
							["ciudad", "Ciudad"],
							["estado", "Estado"],
							["cp", "Código postal"],
							["referencias", "Referencias (opcional)"],
						].map(([campo, etiqueta]) => (
							<label key={campo} className="block text-sm font-semibold">
								{etiqueta}
								<input
									className={`${CAMPO} mt-2`}
									value={datos[campo as keyof typeof datos]}
									onChange={(e) => cambiar(campo, e.target.value)}
									required={campo !== "interior" && campo !== "referencias"}
								/>
							</label>
						))}
					</div>
				</Seccion>
			</div>

			{fallo && (
				<p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
					{fallo}
				</p>
			)}

			{/* El pie se queda pegado abajo: el formulario es largo y los botones
			    se perdían por debajo del doblez. */}
			<div className="sticky bottom-0 -mx-1 mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-tinta/10 bg-hueso px-1 py-4">
				<p className="text-[13px] text-tinta/55">
					{evento
						? "Sigue siendo un borrador hasta que lo publiques."
						: "Se guardará como borrador."}
				</p>
				<div className="flex gap-3">
					<button
						type="button"
						onClick={onCancelar}
						className="h-12 rounded-full border border-tinta px-6 font-semibold"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={guardando || seleccion.length === 0}
						className="inline-flex h-12 items-center gap-2 rounded-full bg-tinta px-6 font-semibold text-lima disabled:opacity-40"
					>
						{guardando && (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						)}
						{guardando ? "Guardando…" : "Guardar borrador"}
					</button>
				</div>
			</div>
		</form>
	);
}

function SubidorDeFoto({
	imagen,
	onCambio,
}: {
	imagen: string | null;
	onCambio: (ruta: string | null) => void;
}) {
	const entrada = useRef<HTMLInputElement>(null);
	const [subiendo, setSubiendo] = useState(false);

	const elegir = async (archivo: File | undefined) => {
		if (!archivo) return;
		if (archivo.size > MAXIMO_FOTO) {
			toast.error(
				`Esa foto pesa demasiado. El máximo son ${Math.round(MAXIMO_FOTO / 1024 / 1024)} MB.`,
			);
			return;
		}
		setSubiendo(true);
		try {
			onCambio(await subirFotoDeEvento(archivo));
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "No pudimos subir la foto.",
			);
		} finally {
			setSubiendo(false);
			/* Sin esto, elegir el MISMO archivo después de un fallo no dispara
			   `change` y parece que el botón dejó de funcionar. */
			if (entrada.current) entrada.current.value = "";
		}
	};

	return (
		<div>
			<p className="pb-2 text-sm font-semibold">Foto del evento</p>
			<input
				ref={entrada}
				type="file"
				accept={TIPOS_DE_FOTO}
				className="hidden"
				onChange={(e) => void elegir(e.target.files?.[0])}
			/>

			{imagen ? (
				<div className="relative h-[214px] overflow-hidden rounded-[14px] bg-tinta">
					{/* biome-ignore lint/performance/noImgElement: mismo origen y sin
					    optimizador en el export estático. */}
					<img src={imagen} alt="" className="size-full object-cover" />
					<div className="absolute bottom-2.5 right-2.5 flex gap-2">
						<button
							type="button"
							onClick={() => entrada.current?.click()}
							className="h-9 rounded-full bg-hueso/92 px-3.5 text-xs font-semibold"
						>
							Cambiar
						</button>
						<button
							type="button"
							aria-label="Quitar la foto"
							onClick={() => onCambio(null)}
							className="grid size-9 place-items-center rounded-full bg-hueso/92"
						>
							<Trash2 className="size-4" aria-hidden />
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					disabled={subiendo}
					onClick={() => entrada.current?.click()}
					className="grid h-[214px] w-full place-items-center rounded-[14px] border-[1.5px] border-dashed border-tinta/25 bg-gris transition hover:border-tinta/50"
				>
					<span className="text-center">
						{subiendo ? (
							<Loader2
								className="mx-auto size-6 animate-spin text-tinta/50"
								aria-hidden
							/>
						) : (
							<Camera className="mx-auto size-6 text-tinta/40" aria-hidden />
						)}
						<span className="mt-2 block text-sm font-semibold text-tinta/60">
							{subiendo ? "Subiendo…" : "Subir una foto"}
						</span>
					</span>
				</button>
			)}
			<p className="pt-2.5 text-xs leading-[18px] text-tinta/45">
				Horizontal, mínimo 1200 × 630 px. JPG, PNG o WebP, hasta{" "}
				{Math.round(MAXIMO_FOTO / 1024 / 1024)} MB.
			</p>
		</div>
	);
}

function DetalleEvento({
	evento,
	onVolver,
	onEditar,
	onCambio,
}: {
	evento: Evento;
	onVolver: () => void;
	onEditar: () => void;
	onCambio: (e: Evento) => void;
}) {
	const [procesando, setProcesando] = useState(false);
	const participaciones = evento.participaciones ?? [];
	const piezas = participaciones.reduce(
		(s, p) => s + p.lineas.reduce((n, l) => n + l.piezas, 0),
		0,
	);
	const cobrado = participaciones
		.filter((p) => p.estadoPago === "pagado")
		.reduce((s, p) => s + p.subtotal, 0);
	const pendientes = participaciones.filter(
		(p) => p.estadoPago === "pendiente",
	).length;
	const enlace =
		typeof window === "undefined"
			? ""
			: `${window.location.origin}/evento?codigo=${encodeURIComponent(evento.codigo)}`;

	const publicar = async () => {
		setProcesando(true);
		try {
			onCambio({ ...(await publicarEvento(evento.id)), participaciones });
			toast.success("Evento publicado");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "No pudimos publicarlo.");
		} finally {
			setProcesando(false);
		}
	};
	const cerrar = async () => {
		setProcesando(true);
		try {
			onCambio({ ...(await cerrarEvento(evento.id)), participaciones });
			toast.success("Evento cerrado");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "No pudimos cerrarlo.");
		} finally {
			setProcesando(false);
		}
	};
	const configurar = async (
		itemId: string,
		personalizacion: Evento["productos"][number]["personalizacion"],
	) => {
		setProcesando(true);
		try {
			onCambio({
				...(await configurarProductoDeEvento(evento.id, itemId, {
					personalizacion,
				})),
				participaciones,
			});
			toast.success("Regla de personalización guardada");
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "No pudimos guardar la regla.",
			);
		} finally {
			setProcesando(false);
		}
	};

	return (
		<div className="max-w-[1050px] pb-10">
			<button
				type="button"
				onClick={onVolver}
				className="text-sm font-semibold underline underline-offset-4"
			>
				← Todos los eventos
			</button>

			{/* Cabecera con la portada: el organizador ve lo mismo que sus invitados */}
			<div className="relative mt-5 overflow-hidden rounded-[20px]">
				<Portada imagen={evento.imagen} className="h-[200px]" />
				{evento.imagen && (
					<div className="pointer-events-none absolute inset-0 bg-linear-to-b from-tinta/10 to-tinta/80" />
				)}
				<div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-4 p-5 md:p-6">
					<div>
						<Estado estado={evento.estado} sobreFoto={Boolean(evento.imagen)} />
						<h2
							className={`pt-2.5 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] ${evento.imagen ? "text-hueso" : ""}`}
						>
							{evento.nombre}
						</h2>
					</div>
					<div className="flex shrink-0 gap-2.5">
						{evento.estado === "borrador" && (
							<>
								<button
									type="button"
									onClick={onEditar}
									className="h-11 rounded-full border border-tinta bg-hueso px-5 text-sm font-semibold"
								>
									Editar
								</button>
								<button
									type="button"
									disabled={procesando}
									onClick={() => void publicar()}
									className="h-11 rounded-full bg-lima px-5 text-sm font-semibold disabled:opacity-40"
								>
									Publicar evento
								</button>
							</>
						)}
						{evento.estado === "publicado" && (
							<button
								type="button"
								disabled={procesando}
								onClick={() => void cerrar()}
								className={`h-11 rounded-full border px-5 text-sm font-semibold disabled:opacity-40 ${evento.imagen ? "border-hueso/50 text-hueso" : "border-tinta"}`}
							>
								Cerrar ahora
							</button>
						)}
					</div>
				</div>
			</div>

			{evento.descripcion && (
				<p className="max-w-[70ch] pt-5 text-sm leading-6 text-tinta/60">
					{evento.descripcion}
				</p>
			)}

			{evento.estado !== "borrador" && (
				<div className="mt-6 rounded-[20px] bg-tinta p-5 text-hueso md:p-6">
					<p className="text-xs font-bold uppercase tracking-[0.1em] text-lima">
						Enlace para invitados
					</p>
					<div className="mt-3.5 flex flex-wrap gap-2.5">
						<input
							readOnly
							value={enlace}
							className="h-11 min-w-0 flex-1 rounded-[10px] bg-white/10 px-3.5 text-sm"
						/>
						<button
							type="button"
							onClick={() =>
								navigator.clipboard
									.writeText(enlace)
									.then(() => toast.success("Enlace copiado"))
							}
							className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-lima px-4 text-sm font-semibold text-tinta"
						>
							<Copy className="size-4" aria-hidden /> Copiar
						</button>
						<a
							href={`https://wa.me/?text=${encodeURIComponent(`${evento.nombre} — pide lo tuyo aquí: ${enlace}`)}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-hueso/35 px-4 text-sm font-semibold"
						>
							<Share2 className="size-4" aria-hidden /> Mandar por WhatsApp
						</a>
					</div>
					<p className="pt-3 text-xs leading-[19px] text-hueso/55">
						Cualquiera con el enlace puede pedir hasta el{" "}
						{fecha(evento.cierraEn)}. No hace falta que se creen cuenta.
					</p>
				</div>
			)}

			<div className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
				<Metrica
					etiqueta="Participaciones"
					valor={String(participaciones.length)}
				/>
				<Metrica etiqueta="Piezas registradas" valor={String(piezas)} />
				<Metrica etiqueta="Cobrado" valor={pesos(cobrado)} />
				<Metrica
					etiqueta="Pagos pendientes"
					valor={String(pendientes)}
					alerta={pendientes > 0}
				/>
			</div>

			<section className="pt-8">
				<h3 className="font-display text-[21px] font-semibold">
					Productos del evento
				</h3>
				<div className="grid gap-3 pt-4 sm:grid-cols-2">
					{evento.productos.map((p) => {
						const pedidas = participaciones.reduce(
							(s, part) =>
								s +
								part.lineas
									.filter((l) => l.producto === p.nombre)
									.reduce((n, l) => n + l.piezas, 0),
							0,
						);
						return (
							<div
								key={p.id}
								className="flex items-center gap-4 rounded-[16px] border border-tinta/10 bg-white p-3.5"
							>
								<div className="size-[76px] shrink-0 overflow-hidden rounded-[10px] bg-hueso">
									{p.imagen && (
										/* biome-ignore lint/performance/noImgElement: foto remota del
										   catálogo, sin optimizador en el export. */
										<img
											src={p.imagen}
											alt=""
											className="size-full object-contain"
										/>
									)}
								</div>
								<div className="min-w-0 flex-1">
									<p className="font-display text-[17px] font-semibold">
										{p.nombre}
									</p>
									{p.disenoBase && (
										<p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
											<CircleCheckBig className="size-3.5" aria-hidden />
											Diseño base guardado
										</p>
									)}
									{evento.estado === "borrador" ? (
										<>
											<Link
												href={rutaParaDisenoBase(evento, p)}
												className="mt-2 inline-flex h-9 items-center rounded-full border border-tinta px-4 text-xs font-semibold"
											>
												{p.disenoBase
													? "Editar diseño base"
													: "Crear diseño base"}
											</Link>
											<select
												value={p.personalizacion}
												disabled={procesando}
												onChange={(e) =>
													void configurar(
														p.id,
														e.target.value as typeof p.personalizacion,
													)
												}
												className="mt-2 h-10 w-full rounded-[10px] border-[1.5px] border-tinta/15 bg-white px-2.5 text-xs text-tinta"
											>
												{REGLAS.map((r) => (
													<option key={r.valor} value={r.valor}>
														{r.nombre}
													</option>
												))}
											</select>
										</>
									) : (
										<>
											<p className="pt-1 text-[13px] text-tinta/55">
												{
													REGLAS.find((r) => r.valor === p.personalizacion)
														?.nombre
												}
											</p>
											<p className="pt-1.5 text-[13px] font-semibold text-lima-oscuro">
												{pedidas} {pedidas === 1 ? "pedida" : "pedidas"}
											</p>
										</>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</section>

			<section className="pt-8">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h3 className="font-display text-[21px] font-semibold">
						Quién ha pedido
					</h3>
					{participaciones.length > 0 && (
						<button
							type="button"
							onClick={() => descargarLista(evento, participaciones)}
							className="inline-flex h-10 items-center gap-2 rounded-full border border-tinta px-4 text-[13px] font-semibold"
						>
							<Download className="size-4" aria-hidden /> Descargar la lista
						</button>
					)}
				</div>

				{participaciones.length === 0 ? (
					<p className="mt-4 rounded-xl bg-hueso p-5 text-sm text-tinta/55">
						Cuando alguien complete el formulario del evento aparecerá aquí.
					</p>
				) : (
					<div className="mt-4 overflow-hidden rounded-[16px] border border-tinta/10 bg-white">
						<div className="hidden bg-gris px-5 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-tinta/50 md:grid md:grid-cols-[240px_minmax(0,1fr)_110px_130px] md:gap-4">
							<span>Participante</span>
							<span>Qué pidió</span>
							<span>Total</span>
							<span>Pago</span>
						</div>
						{participaciones.map((p) => (
							<div
								key={p.id}
								className="grid gap-2 border-t border-tinta/8 px-5 py-4 first:border-t-0 md:grid-cols-[240px_minmax(0,1fr)_110px_130px] md:items-center md:gap-4 md:first:border-t"
							>
								<div>
									<p className="text-sm font-semibold">
										{p.participante.nombre}
									</p>
									<p className="pt-0.5 text-xs text-tinta/50">
										{p.participante.email}
									</p>
								</div>
								<div className="text-[13px]">
									{p.lineas.map((l) => (
										<p key={l.id}>
											{l.piezas}× {l.producto} · {l.talla}
											{l.diseno ? " · personalizado" : ""}
										</p>
									))}
								</div>
								<p className="font-display text-[15px] font-bold">
									{pesos(p.subtotal)}
								</p>
								<span
									className={`justify-self-start rounded-full px-2.5 py-1 text-[11px] font-bold ${
										p.estadoPago === "pagado"
											? "bg-lima-oscuro/16 text-lima-oscuro"
											: "bg-naranja/20 text-[#a2472a]"
									}`}
								>
									{NOMBRE_DE_PAGO[p.estadoPago]}
								</span>
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}

function Seccion({
	titulo,
	nota,
	extra,
	children,
}: {
	titulo: string;
	nota?: string;
	extra?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-[18px] border border-tinta/10 bg-white p-5 md:p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="font-display text-[20px] font-semibold">{titulo}</h3>
					{nota && <p className="pt-1 text-sm text-tinta/50">{nota}</p>}
				</div>
				{extra}
			</div>
			<div className="space-y-5 pt-5">{children}</div>
		</section>
	);
}

function Estado({
	estado,
	sobreFoto,
}: {
	estado: Evento["estado"];
	sobreFoto?: boolean;
}) {
	const nombres = {
		borrador: "Borrador",
		publicado: "Abierto",
		cerrado: "Cerrado",
		cancelado: "Cancelado",
	};
	const abierto = estado === "publicado";
	return (
		<span
			className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
				abierto
					? "bg-lima text-tinta"
					: sobreFoto
						? "bg-hueso/20 text-hueso"
						: "bg-tinta/7 text-tinta"
			}`}
		>
			{nombres[estado]}
		</span>
	);
}

function Metrica({
	etiqueta,
	valor,
	alerta,
}: {
	etiqueta: string;
	valor: string;
	alerta?: boolean;
}) {
	return (
		<div
			className={`rounded-[16px] p-4 ${alerta ? "bg-naranja/14" : "bg-hueso-suave"}`}
		>
			<p className="font-display text-[28px] font-bold leading-tight">
				{valor}
			</p>
			<p className="pt-1 text-xs text-tinta/55">{etiqueta}</p>
		</div>
	);
}

const NOMBRE_DE_PAGO: Record<
	NonNullable<Evento["participaciones"]>[number]["estadoPago"],
	string
> = {
	pendiente: "Pendiente",
	pagado: "Pagado",
	fallido: "Fallido",
	reembolsado: "Reembolsado",
};

/**
 * Baja la lista como CSV.
 *
 * LLEVA BOM. Excel en Windows abre un CSV sin él como Latin-1 y parte todos
 * los acentos, que en una lista de nombres mexicanos es la mitad de la lista.
 */
function descargarLista(
	evento: Evento,
	participaciones: NonNullable<Evento["participaciones"]>,
) {
	const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
	const filas = [
		["Participante", "Correo", "WhatsApp", "Qué pidió", "Total", "Pago"],
		...participaciones.map((p) => [
			p.participante.nombre,
			p.participante.email,
			p.participante.whatsapp ?? "",
			p.lineas
				.map((l) => `${l.piezas}x ${l.producto} · ${l.talla}`)
				.join(" | "),
			String(p.subtotal),
			NOMBRE_DE_PAGO[p.estadoPago],
		]),
	];
	const csv = `﻿${filas.map((f) => f.map(escapar).join(",")).join("\r\n")}`;
	const url = URL.createObjectURL(
		new Blob([csv], { type: "text/csv;charset=utf-8" }),
	);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${evento.nombre.replace(/[^\w\s-]/g, "").trim() || "evento"}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

const fecha = (iso: string) =>
	new Intl.DateTimeFormat("es-MX", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(iso));
const pesos = (n: number) =>
	new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
		n,
	);
function paraCampo(fecha: Date) {
	const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
	return local.toISOString().slice(0, 16);
}

function rutaParaDisenoBase(
	evento: Evento,
	producto: Evento["productos"][number],
) {
	const parametros = new URLSearchParams({
		id: producto.productoId,
		evento: evento.codigo,
		item: producto.id,
		eventoId: evento.id,
		organizador: "1",
		personalizacion: producto.personalizacion,
	});
	if (producto.disenoBase) parametros.set("diseno", producto.disenoBase.ruta);
	return `/design?${parametros.toString()}`;
}
