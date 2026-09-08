"use client";

import { CalendarDays, MapPin, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
	type EventoPublico as Evento,
	obtenerEventoPublico,
	type ParticipacionDeEvento,
	registrarParticipacion,
} from "@/lib/api/eventos";
import type { ArticuloDeCarrito } from "@/lib/carrito/almacen";
import { leerDisenoDeEvento } from "@/lib/eventos/borrador";

type Eleccion = {
	activa: boolean;
	talla: string;
	color: string;
	piezas: number;
	diseno: ArticuloDeCarrito | null;
};
const CAMPO =
	"h-12 w-full rounded-[10px] border-[1.5px] border-tinta/15 bg-white px-3.5 text-sm outline-none focus:border-tinta";

export default function EventoPublico() {
	const codigo = useSearchParams().get("codigo") ?? "";
	const [evento, setEvento] = useState<Evento | null>(null);
	const [elecciones, setElecciones] = useState<Record<string, Eleccion>>({});
	const [participante, setParticipante] = useState({
		nombre: "",
		email: "",
		whatsapp: "",
	});
	const [resultado, setResultado] = useState<ParticipacionDeEvento | null>(
		null,
	);
	const [cargando, setCargando] = useState(true);
	const [enviando, setEnviando] = useState(false);
	/* Sobrevive a un timeout o doble clic: reintentar la misma participación
	   usa la misma llave condicional en DynamoDB. Se renueva al abrir otro
	   evento porque el componente vuelve a montar. */
	const [intentoId] = useState(() => crypto.randomUUID());
	const [fallo, setFallo] = useState<string | null>(null);

	useEffect(() => {
		if (!codigo) {
			setFallo("Este enlace no tiene un código de evento.");
			setCargando(false);
			return;
		}
		obtenerEventoPublico(codigo)
			.then((dato) => {
				setEvento(dato);
				setElecciones(
					Object.fromEntries(
						dato.productos.map((p) => {
							const diseno = leerDisenoDeEvento(codigo, p.id);
							return [
								p.id,
								{
									activa: Boolean(diseno),
									talla: p.tallas[0] ?? "",
									color: p.colores[0]?.nombre ?? "",
									piezas: 1,
									diseno,
								},
							];
						}),
					),
				);
			})
			.catch((error) =>
				setFallo(
					error instanceof Error
						? error.message
						: "No pudimos abrir el evento.",
				),
			)
			.finally(() => setCargando(false));
	}, [codigo]);

	const total = useMemo(
		() =>
			evento?.productos.reduce((suma, producto) => {
				const eleccion = elecciones[producto.id];
				return (
					suma + (eleccion?.activa ? producto.precioDesde * eleccion.piezas : 0)
				);
			}, 0) ?? 0,
		[evento, elecciones],
	);

	const cambiar = (id: string, cambio: Partial<Eleccion>) =>
		setElecciones((previo) => ({
			...previo,
			[id]: { ...previo[id], ...cambio },
		}));

	const enviar = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!evento) return;
		const lineas = evento.productos.flatMap((p) => {
			const x = elecciones[p.id];
			return x?.activa
				? [
						{
							eventoItemId: p.id,
							talla: x.talla,
							color: x.color,
							piezas: x.piezas,
							diseno: x.diseno ? { carritoId: x.diseno.carritoId } : null,
						},
					]
				: [];
		});
		if (!lineas.length) {
			setFallo("Elige al menos un producto.");
			return;
		}
		setEnviando(true);
		setFallo(null);
		try {
			setResultado(
				await registrarParticipacion(codigo, {
					intentoId,
					participante,
					lineas,
				}),
			);
		} catch (error) {
			setFallo(
				error instanceof Error
					? error.message
					: "No pudimos registrar tu participación.",
			);
		} finally {
			setEnviando(false);
		}
	};

	return (
		<div className="min-h-screen bg-[#f6f6f5] text-tinta">
			<header className="border-b border-tinta/10 bg-white">
				<div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-5">
					<Link
						href="/"
						className="font-display text-2xl font-bold tracking-tight"
					>
						kustto
					</Link>
					<span className="text-xs font-bold uppercase tracking-[0.11em] text-tinta/45">
						Evento compartido
					</span>
				</div>
			</header>
			<main className="mx-auto max-w-[1080px] px-5 py-9 md:py-14">
				{cargando && (
					<p className="py-16 text-center text-sm text-tinta/50">
						Abriendo el evento…
					</p>
				)}
				{fallo && !evento && (
					<div className="mx-auto max-w-lg rounded-[20px] bg-white p-8 text-center">
						<h1 className="font-display text-2xl font-semibold">
							No pudimos abrirlo
						</h1>
						<p className="pt-3 text-sm text-tinta/60">{fallo}</p>
					</div>
				)}
				{evento && resultado ? (
					<Confirmacion evento={evento} participacion={resultado} />
				) : (
					evento && (
						<>
							<section className="rounded-[24px] bg-tinta p-6 text-hueso md:p-9">
								<div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-lima">
									<span>
										{evento.estado === "abierto"
											? "Recibiendo pedidos"
											: estado(evento.estado)}
									</span>
								</div>
								<h1 className="max-w-[19ch] pt-3 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.035em] md:text-[52px]">
									{evento.nombre}
								</h1>
								{evento.descripcion && (
									<p className="max-w-[62ch] pt-4 text-sm leading-6 text-hueso/65 md:text-base">
										{evento.descripcion}
									</p>
								)}
								<div className="flex flex-col gap-3 pt-7 text-sm text-hueso/75 sm:flex-row sm:gap-7">
									<span className="flex items-center gap-2">
										<CalendarDays className="size-4 text-lima" /> Cierra{" "}
										{fecha(evento.cierraEn)}
									</span>
									<span className="flex items-center gap-2">
										<MapPin className="size-4 text-lima" /> Entrega en{" "}
										{evento.entrega.ciudad}, {evento.entrega.estado}
									</span>
								</div>
							</section>

							{evento.estado !== "abierto" ? (
								<div className="mt-6 rounded-[18px] bg-white p-6 text-sm">
									{evento.estado === "proximamente"
										? `Podrás participar a partir del ${fecha(evento.abreEn)}.`
										: "Este evento ya no recibe participaciones."}
								</div>
							) : (
								<form
									onSubmit={enviar}
									className="grid gap-7 pt-8 lg:grid-cols-[1fr_340px]"
								>
									<div>
										<h2 className="font-display text-[27px] font-semibold">
											Elige lo tuyo
										</h2>
										<p className="pt-1 text-sm text-tinta/55">
											Puedes combinar los productos disponibles y elegir tu
											talla.
										</p>
										<div className="space-y-4 pt-5">
											{evento.productos.map((producto) => {
												const x = elecciones[producto.id];
												if (!x) return null;
												return (
													<article
														key={producto.id}
														className={`overflow-hidden rounded-[18px] border bg-white transition ${x.activa ? "border-2 border-tinta" : "border-tinta/10"}`}
													>
														<div className="grid grid-cols-[110px_1fr] sm:grid-cols-[150px_1fr]">
															<button
																type="button"
																aria-label={`${x.activa ? "Quitar" : "Elegir"} ${producto.nombre}`}
																onClick={() =>
																	cambiar(producto.id, { activa: !x.activa })
																}
																className="relative aspect-square bg-hueso"
															>
																{producto.imagen && (
																	<img
																		src={producto.imagen}
																		alt=""
																		className="h-full w-full object-contain"
																	/>
																)}
																{x.activa && (
																	<span className="absolute left-2 top-2 rounded-full bg-lima px-2 py-1 text-[10px] font-bold uppercase">
																		Elegido
																	</span>
																)}
															</button>
															<div className="p-4">
																<button
																	type="button"
																	onClick={() =>
																		cambiar(producto.id, { activa: !x.activa })
																	}
																	className="text-left font-display text-[19px] font-semibold"
																>
																	{producto.nombre}
																</button>
																<p className="pt-1 text-sm text-tinta/55">
																	Desde {pesos(producto.precioDesde)} por pieza
																</p>
																{producto.personalizacion !==
																"sin_personalizacion" ? (
																	<Link
																		href={rutaParaDisenar(
																			codigo,
																			evento.id,
																			producto.productoId,
																			producto.id,
																			x.diseno,
																			producto.disenoBase?.ruta ?? null,
																			producto.personalizacion,
																		)}
																		className="mt-3 inline-flex h-9 items-center rounded-full border border-tinta px-4 text-xs font-semibold"
																	>
																		{x.diseno
																			? "Editar personalización"
																			: "Personalizar"}
																	</Link>
																) : (
																	<p className="pt-3 text-xs text-tinta/45">
																		Este producto usa el diseño definido por el
																		organizador.
																	</p>
																)}
																{x.diseno && (
																	<p className="pt-2 text-xs font-semibold text-emerald-700">
																		Diseño guardado
																	</p>
																)}
																{x.activa && (
																	<div className="grid grid-cols-2 gap-3 pt-4">
																		<label className="text-xs font-semibold">
																			Talla
																			<select
																				className={`${CAMPO} mt-1 h-10`}
																				value={x.talla}
																				onChange={(e) =>
																					cambiar(producto.id, {
																						talla: e.target.value,
																					})
																				}
																			>
																				{producto.tallas.map((t) => (
																					<option key={t}>{t}</option>
																				))}
																			</select>
																		</label>
																		<label className="text-xs font-semibold">
																			Color
																			<select
																				className={`${CAMPO} mt-1 h-10`}
																				value={x.color}
																				onChange={(e) =>
																					cambiar(producto.id, {
																						color: e.target.value,
																					})
																				}
																			>
																				{producto.colores.length ? (
																					producto.colores.map((c) => (
																						<option key={c.nombre}>
																							{c.nombre}
																						</option>
																					))
																				) : (
																					<option value="">Único</option>
																				)}
																			</select>
																		</label>
																		<div className="col-span-2 flex items-center justify-between">
																			<span className="text-xs font-semibold">
																				Piezas
																			</span>
																			<div className="flex items-center rounded-lg border border-tinta/15">
																				<button
																					type="button"
																					aria-label="Quitar pieza"
																					onClick={() =>
																						cambiar(producto.id, {
																							piezas: Math.max(1, x.piezas - 1),
																						})
																					}
																					className="grid size-10 place-items-center"
																				>
																					<Minus className="size-4" />
																				</button>
																				<span className="w-8 text-center text-sm font-semibold">
																					{x.piezas}
																				</span>
																				<button
																					type="button"
																					aria-label="Agregar pieza"
																					onClick={() =>
																						cambiar(producto.id, {
																							piezas: Math.min(
																								50,
																								x.piezas + 1,
																							),
																						})
																					}
																					className="grid size-10 place-items-center"
																				>
																					<Plus className="size-4" />
																				</button>
																			</div>
																		</div>
																	</div>
																)}
															</div>
														</div>
													</article>
												);
											})}
										</div>
									</div>
									<aside className="h-fit rounded-[20px] bg-white p-5 lg:sticky lg:top-5">
										<h2 className="font-display text-[21px] font-semibold">
											Tus datos
										</h2>
										<p className="pt-1 text-xs leading-5 text-tinta/50">
											El organizador usará estos datos para identificar tu
											pedido.
										</p>
										<div className="space-y-4 pt-5">
											<label className="block text-xs font-semibold">
												Nombre
												<input
													className={`${CAMPO} mt-1.5`}
													required
													value={participante.nombre}
													onChange={(e) =>
														setParticipante({
															...participante,
															nombre: e.target.value,
														})
													}
												/>
											</label>
											<label className="block text-xs font-semibold">
												Correo
												<input
													type="email"
													className={`${CAMPO} mt-1.5`}
													required
													value={participante.email}
													onChange={(e) =>
														setParticipante({
															...participante,
															email: e.target.value,
														})
													}
												/>
											</label>
											<label className="block text-xs font-semibold">
												WhatsApp (opcional)
												<input
													className={`${CAMPO} mt-1.5`}
													value={participante.whatsapp}
													onChange={(e) =>
														setParticipante({
															...participante,
															whatsapp: e.target.value,
														})
													}
												/>
											</label>
										</div>
										<div className="mt-5 flex items-center justify-between border-t border-tinta/10 pt-5">
											<span className="text-sm text-tinta/55">
												Total estimado
											</span>
											<strong className="text-xl">{pesos(total)}</strong>
										</div>
										{fallo && (
											<p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
												{fallo}
											</p>
										)}
										<button
											disabled={enviando || total === 0}
											className="mt-5 h-12 w-full rounded-full bg-lima font-semibold disabled:opacity-40"
										>
											{enviando ? "Registrando…" : "Registrar mi pedido"}
										</button>
										<p className="pt-3 text-center text-[11px] leading-4 text-tinta/45">
											Todavía no se hará ningún cargo. El pago en línea se
											habilita en la siguiente etapa.
										</p>
									</aside>
								</form>
							)}
						</>
					)
				)}
			</main>
		</div>
	);
}

function Confirmacion({
	evento,
	participacion,
}: {
	evento: Evento;
	participacion: ParticipacionDeEvento;
}) {
	return (
		<div className="mx-auto max-w-[620px] rounded-[24px] bg-white p-7 text-center md:p-10">
			<span className="mx-auto grid size-12 place-items-center rounded-full bg-lima text-xl">
				✓
			</span>
			<h1 className="pt-5 font-display text-[30px] font-semibold">
				Tu selección quedó registrada
			</h1>
			<p className="pt-3 text-sm leading-6 text-tinta/60">
				Ya aparece en el panel de <strong>{evento.nombre}</strong>. Su estado es
				pago pendiente y todavía no se enviará a producción.
			</p>
			<div className="mt-6 rounded-xl bg-hueso p-4 text-left">
				{participacion.lineas.map((l) => (
					<p key={l.id} className="text-sm">
						{l.piezas}× {l.producto} · {l.talla}
					</p>
				))}
				<p className="mt-3 border-t border-tinta/10 pt-3 font-semibold">
					{pesos(participacion.subtotal)}
				</p>
			</div>
		</div>
	);
}
const pesos = (n: number) =>
	new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
		n,
	);
const fecha = (iso: string) =>
	new Intl.DateTimeFormat("es-MX", {
		dateStyle: "long",
		timeStyle: "short",
	}).format(new Date(iso));
const estado = (v: Evento["estado"]) =>
	({
		proximamente: "Próximamente",
		abierto: "Abierto",
		cerrado: "Cerrado",
		cancelado: "Cancelado",
	})[v];

function rutaParaDisenar(
	codigo: string,
	eventoId: string,
	productoId: string,
	itemId: string,
	diseno: ArticuloDeCarrito | null,
	disenoBase: string | null,
	personalizacion: Evento["productos"][number]["personalizacion"],
) {
	const parametros = new URLSearchParams({
		id: productoId,
		evento: codigo,
		item: itemId,
		eventoId,
	});
	if (diseno) {
		parametros.set(
			"diseno",
			`/eventos/${eventoId}/${itemId}/${diseno.carritoId}/diseno.json`,
		);
	} else if (disenoBase) {
		parametros.set("diseno", disenoBase);
		if (personalizacion === "bloqueada") parametros.set("baseEvento", "1");
	}
	if (personalizacion === "bloqueada") parametros.set("bloquear", "1");
	return `/design?${parametros.toString()}`;
}
