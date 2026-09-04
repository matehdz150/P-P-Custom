"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import { Campo } from "@/components/Pedir/Campo";
import { Paso } from "@/components/Pedir/Paso";
import {
	consultarCotizacion,
	cotizarCompra,
	crearPedido,
	type Direccion,
	enlaceDeSeguimiento,
} from "@/lib/api/pedir";
import {
	type ArticuloDeCarrito,
	importeDe,
	piezasDe,
} from "@/lib/carrito/almacen";
import { useCarrito } from "@/lib/carrito/useCarrito";
import { usePrecargarPerfil } from "@/lib/pedido/precargar";

/**
 * El checkout del carrito.
 *
 * Es otra pantalla que `/pedir` a propósito, y no la misma con condiciones:
 * aquí la entrega NO es una decisión sino una por taller, y el envío tampoco
 * es un precio sino varios. Meter eso en el formulario de un solo producto lo
 * habría llenado de "si hay carrito…" en cada paso.
 *
 * LA DIRECCIÓN ES UNA; EL MÉTODO, POR TALLER. A dónde va el paquete lo decide
 * quien compra una vez. Que un taller esté en su ciudad y prefiera recogerlo
 * es una decisión distinta, y por eso se pregunta por separado.
 */

type MetodoEntrega = "envio" | "recoger";

type Tarifa = {
	id: string;
	paqueteria: string;
	servicio: string;
	precio: number;
	dias: number | null;
};

type EstadoDeTaller = {
	proveedorId: string;
	nombre: string;
	articulos: ArticuloDeCarrito[];
	metodo: MetodoEntrega;
	cotizacionId?: string;
	tarifas: Tarifa[];
	tarifaId?: string;
	/** Por qué este taller no puede enviar. Con esto sólo queda recoger. */
	error?: string;
};

const DIRECCION_VACIA: Direccion = {
	calle: "",
	numero: "",
	interior: "",
	colonia: "",
	ciudad: "",
	estado: "",
	cp: "",
	referencias: "",
};

/** Cuántas veces se pregunta por las tarifas antes de rendirse. */
const INTENTOS = 6;

export default function PedirCarritoPage() {
	const router = useRouter();
	const { articulos, cargando, vaciar } = useCarrito();

	const [paso, setPaso] = useState(1);
	const [contacto, setContacto] = useState({
		nombre: "",
		email: "",
		whatsapp: "",
		notas: "",
	});
	const [direccion, setDireccion] = useState<Direccion>(DIRECCION_VACIA);

	/* Lo que ya sabemos de quien entró: nombre y correo del token, WhatsApp y
	   dirección de su perfil. Es el mismo trato que da `/pedir` —el mismo hook,
	   ver `lib/pedido/precargar`—, que es lo que evita que llegar por el carrito
	   obligue a teclear otra vez lo que ya está guardado. */
	const { comprador } = useComprador();
	const perfilPuesto = usePrecargarPerfil(setContacto, setDireccion);

	const [talleres, setTalleres] = useState<EstadoDeTaller[]>([]);
	const [cotizando, setCotizando] = useState(false);
	const [enviando, setEnviando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);

	/* Los artículos, agrupados por quien los produce. Es el mismo reparto que
	   hará la API al crear la compra: aquí sólo se enseña antes de pagar. */
	const grupos = useMemo(() => {
		const porTaller = new Map<string, ArticuloDeCarrito[]>();

		for (const a of articulos) {
			porTaller.set(a.proveedorId, [
				...(porTaller.get(a.proveedorId) ?? []),
				a,
			]);
		}

		return [...porTaller.entries()].map(([proveedorId, suyos]) => ({
			proveedorId,
			nombre: suyos[0]?.proveedorNombre ?? "Taller",
			articulos: suyos,
		}));
	}, [articulos]);

	// El estado de entrega arranca cuando se conocen los grupos, y se conserva
	// si alguien vuelve atrás a corregir un dato.
	useEffect(() => {
		setTalleres((antes) =>
			grupos.map((g) => {
				const previo = antes.find((t) => t.proveedorId === g.proveedorId);
				return {
					...g,
					metodo: previo?.metodo ?? "envio",
					cotizacionId: previo?.cotizacionId,
					tarifas: previo?.tarifas ?? [],
					tarifaId: previo?.tarifaId,
					error: previo?.error,
				};
			}),
		);
	}, [grupos]);

	const productos = articulos.reduce((suma, a) => suma + importeDe(a), 0);
	const enviosElegidos = talleres.reduce((suma, t) => {
		if (t.metodo !== "envio") return suma;
		const tarifa = t.tarifas.find((r) => r.id === t.tarifaId);
		return suma + (tarifa?.precio ?? 0);
	}, 0);

	// Se redondea aquí igual que en la API: sumar precios de envío en coma
	// flotante deja totales como 809.9300000000001.
	const total = Math.round((productos + enviosElegidos) * 100) / 100;

	const direccionCompleta =
		direccion.calle.trim() !== "" &&
		direccion.numero.trim() !== "" &&
		direccion.colonia.trim() !== "" &&
		direccion.ciudad.trim() !== "" &&
		direccion.estado.trim() !== "" &&
		/^\d{5}$/.test(direccion.cp.trim());

	const cotizar = useCallback(async () => {
		if (!direccionCompleta || articulos.length === 0) return;

		setCotizando(true);
		setFallo(null);

		try {
			const { partes } = await cotizarCompra({
				destino: direccion,
				lineas: articulos.map((a) => ({
					productoId: a.productoId,
					tallas: a.tallas,
				})),
			});

			setTalleres((antes) =>
				antes.map((t) => {
					const parte = partes.find((p) => p.proveedorId === t.proveedorId);
					return {
						...t,
						cotizacionId: parte?.cotizacionId,
						error: parte?.error,
						// Un taller que no puede enviar sólo puede recogerse.
						metodo: parte?.error ? "recoger" : t.metodo,
						tarifas: [],
						tarifaId: undefined,
					};
				}),
			);

			/* Las tarifas tardan unos segundos y llegan de a poco. Se consulta con
			   reintentos y en serie: en paralelo se volvería a rozar el límite de
			   la paquetería, que es justo lo que la Lambda evita al cotizar. */
			for (const parte of partes) {
				if (!parte.cotizacionId) continue;

				for (let i = 0; i < INTENTOS; i++) {
					await new Promise((r) => setTimeout(r, 1500));

					const { lista, tarifas } = await consultarCotizacion(
						parte.cotizacionId,
					);

					if (tarifas.length > 0) {
						setTalleres((antes) =>
							antes.map((t) =>
								t.proveedorId === parte.proveedorId
									? { ...t, tarifas, tarifaId: t.tarifaId ?? tarifas[0]?.id }
									: t,
							),
						);
					}

					if (lista) break;
				}
			}
		} catch (error) {
			setFallo(
				error instanceof Error
					? error.message
					: "No pudimos cotizar los envíos.",
			);
		} finally {
			setCotizando(false);
		}
	}, [articulos, direccion, direccionCompleta]);

	const listoParaPagar =
		contacto.nombre.trim() !== "" &&
		/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contacto.email.trim()) &&
		contacto.whatsapp.replace(/\D/g, "").length >= 10 &&
		talleres.length > 0 &&
		talleres.every(
			(t) =>
				t.metodo === "recoger" || (t.metodo === "envio" && Boolean(t.tarifaId)),
		) &&
		(talleres.every((t) => t.metodo === "recoger") || direccionCompleta);

	async function mandar() {
		if (!listoParaPagar || enviando) return;

		setEnviando(true);
		setFallo(null);

		try {
			const pedido = await crearPedido({
				comprador: {
					nombre: contacto.nombre.trim(),
					email: contacto.email.trim(),
					whatsapp: contacto.whatsapp.trim(),
					notas: contacto.notas.trim() || undefined,
				},
				partes: talleres.map((t) => ({
					proveedorId: t.proveedorId,
					entrega:
						t.metodo === "envio"
							? { metodo: "envio", direccion }
							: { metodo: "recoger" },
					envio:
						t.metodo === "envio" && t.cotizacionId && t.tarifaId
							? { cotizacionId: t.cotizacionId, tarifaId: t.tarifaId }
							: undefined,
				})),
				lineas: articulos.map((a) => ({
					productoId: a.productoId,
					colorPrenda: a.colorPrenda,
					lados: a.lados.map((l) => l.lado),
					tallas: a.tallas,
					// El arte ya está subido desde que se agregó: la API lo copia
					// fuera del prefijo que caduca.
					carritoId: a.carritoId,
					archivos: a.lados.map((l) => ({
						lado: l.lado,
						anchoPx: l.anchoPx,
						altoPx: l.altoPx,
						dpi: l.dpi,
					})),
				})),
			});

			// El carrito se vacía DESPUÉS de que la compra existe: si se vaciara
			// antes y fallara la creación, alguien perdería su carrito sin haber
			// pedido nada.
			vaciar();

			router.push(enlaceDeSeguimiento(pedido));
		} catch (error) {
			setFallo(
				error instanceof Error ? error.message : "No pudimos crear tu pedido.",
			);
			setEnviando(false);
		}
	}

	if (cargando) {
		return (
			<main className="mx-auto max-w-[760px] px-5 py-16 text-[15px] text-tinta/60">
				Cargando tu carrito…
			</main>
		);
	}

	if (articulos.length === 0) {
		return (
			<main className="mx-auto max-w-[760px] px-5 py-16">
				<h1 className="font-display text-[26px] font-semibold text-tinta">
					Tu carrito está vacío
				</h1>
				<p className="pt-2 text-[15px] text-tinta/70">
					Agrega un diseño desde el editor y vuelve por aquí.
				</p>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-[760px] px-5 py-10">
			<h1 className="font-display text-[26px] font-semibold tracking-[-0.032em] text-tinta">
				Terminar la compra
			</h1>

			{talleres.length > 1 && (
				<p className="mt-3 rounded-lg border border-tinta/12 bg-gris px-4 py-3 text-sm leading-[22px] text-tinta/75">
					Son {talleres.length} talleres, así que cada uno prepara y entrega lo
					suyo. Puedes elegir cómo recibir cada parte.
				</p>
			)}

			<div className="flex flex-col gap-3 pt-6">
				<Paso
					numero={1}
					titulo="Tus datos"
					abierto={paso === 1}
					completado={paso > 1}
					resumen={
						contacto.nombre ? `${contacto.nombre} · ${contacto.email}` : ""
					}
					onEditar={() => setPaso(1)}
				>
					<div className="flex flex-col gap-3">
						<Campo
							id="nombre"
							etiqueta="Tu nombre"
							valor={contacto.nombre}
							onChange={(v) => setContacto((c) => ({ ...c, nombre: v }))}
							requerido
						/>
						{/* Con sesión el correo NO se edita, igual que en `/pedir`: es
						    el que ata la compra a la cuenta —los pedidos se buscan por
						    correo—, y dejar cambiarlo aquí mandaría la compra al
						    historial de otra persona. */}
						<Campo
							id="email"
							etiqueta="Correo"
							tipo="email"
							valor={contacto.email}
							onChange={(v) => setContacto((c) => ({ ...c, email: v }))}
							bloqueado={Boolean(comprador)}
							ayuda={
								comprador
									? "El de tu cuenta. Ahí llega el enlace para seguir tu pedido."
									: "Ahí llega el enlace para seguir tu pedido."
							}
							requerido
						/>
						<Campo
							id="whatsapp"
							etiqueta="WhatsApp"
							valor={contacto.whatsapp}
							onChange={(v) => setContacto((c) => ({ ...c, whatsapp: v }))}
							ayuda="La paquetería lo pide para entregar."
							inputMode="numeric"
							requerido
						/>

						<button
							type="button"
							onClick={() => setPaso(2)}
							className="mt-2 h-12 rounded-lg bg-tinta text-[15px] font-semibold text-lima"
						>
							Continuar
						</button>
					</div>
				</Paso>

				<Paso
					numero={2}
					titulo="Cómo recibes cada parte"
					abierto={paso === 2}
					completado={paso > 2}
					resumen={talleres
						.map(
							(t) =>
								`${t.nombre}: ${t.metodo === "envio" ? "envío" : "recoger"}`,
						)
						.join(" · ")}
					onEditar={() => setPaso(2)}
				>
					<div className="flex flex-col gap-5">
						<div className="flex flex-col gap-3">
							{perfilPuesto && (
								// Se dice que viene de la cuenta y se puede editar aquí
								// mismo: cambiarla en esta compra NO toca la guardada, y
								// callárselo haría que alguien la "corrigiera" creyendo que
								// arregla su perfil.
								<p className="rounded-lg bg-gris px-3.5 py-3 text-[13px] leading-[21px] text-tinta/70">
									Pusimos la dirección de tu cuenta. Si esta compra va a otro
									lado, cámbiala aquí — tu cuenta se queda como está.
								</p>
							)}

							<p className="text-[13px] font-semibold text-tinta">
								¿A dónde mandamos lo que sí se envía?
							</p>
							<div className="grid grid-cols-2 gap-3">
								<Campo
									id="calle"
									etiqueta="Calle"
									valor={direccion.calle}
									onChange={(v) => setDireccion((d) => ({ ...d, calle: v }))}
									requerido
								/>
								<Campo
									id="numero"
									etiqueta="Número"
									valor={direccion.numero}
									onChange={(v) => setDireccion((d) => ({ ...d, numero: v }))}
									requerido
								/>
								<Campo
									id="colonia"
									etiqueta="Colonia"
									valor={direccion.colonia}
									onChange={(v) => setDireccion((d) => ({ ...d, colonia: v }))}
									requerido
								/>
								<Campo
									id="cp"
									etiqueta="Código postal"
									valor={direccion.cp}
									onChange={(v) => setDireccion((d) => ({ ...d, cp: v }))}
									inputMode="numeric"
									maxLength={5}
									requerido
								/>
								<Campo
									id="ciudad"
									etiqueta="Ciudad"
									valor={direccion.ciudad}
									onChange={(v) => setDireccion((d) => ({ ...d, ciudad: v }))}
									requerido
								/>
								<Campo
									id="estado"
									etiqueta="Estado"
									valor={direccion.estado}
									onChange={(v) => setDireccion((d) => ({ ...d, estado: v }))}
									requerido
								/>
							</div>

							<button
								type="button"
								onClick={cotizar}
								disabled={!direccionCompleta || cotizando}
								className="h-11 rounded-lg border-[1.5px] border-tinta px-4 text-[15px] font-semibold text-tinta disabled:opacity-40"
							>
								{cotizando ? "Cotizando envíos…" : "Cotizar envíos"}
							</button>
						</div>

						{talleres.map((t) => (
							<TallerEnCheckout
								key={t.proveedorId}
								taller={t}
								onMetodo={(metodo) =>
									setTalleres((antes) =>
										antes.map((x) =>
											x.proveedorId === t.proveedorId ? { ...x, metodo } : x,
										),
									)
								}
								onTarifa={(tarifaId) =>
									setTalleres((antes) =>
										antes.map((x) =>
											x.proveedorId === t.proveedorId ? { ...x, tarifaId } : x,
										),
									)
								}
							/>
						))}

						<button
							type="button"
							onClick={() => setPaso(3)}
							className="h-12 rounded-lg bg-tinta text-[15px] font-semibold text-lima"
						>
							Continuar
						</button>
					</div>
				</Paso>

				<Paso
					numero={3}
					titulo="Confirmar"
					abierto={paso === 3}
					completado={false}
					resumen=""
					onEditar={() => setPaso(3)}
				>
					<div className="flex flex-col gap-3">
						<Linea texto="Productos" monto={productos} />
						{talleres
							.filter((t) => t.metodo === "envio")
							.map((t) => {
								const tarifa = t.tarifas.find((r) => r.id === t.tarifaId);
								return (
									<Linea
										key={t.proveedorId}
										texto={`Envío · ${t.nombre}`}
										monto={tarifa?.precio ?? 0}
									/>
								);
							})}

						<div className="flex items-center justify-between border-t border-tinta/12 pt-3">
							<span className="text-[15px] font-semibold text-tinta">
								Total
							</span>
							<span className="font-display text-[20px] font-semibold text-tinta">
								${total.toLocaleString("es-MX")}
							</span>
						</div>

						<p className="text-[13px] leading-5 text-tinta/55">
							Todavía no se cobra nada aquí: cada taller confirma su parte y
							acuerda contigo el pago.
						</p>

						{fallo && (
							<p className="text-sm text-[#c0392b]" role="alert">
								{fallo}
							</p>
						)}

						<button
							type="button"
							disabled={!listoParaPagar || enviando}
							onClick={mandar}
							className="h-12 rounded-lg bg-tinta text-[15px] font-semibold text-lima disabled:bg-tinta/14 disabled:text-tinta/40"
						>
							{enviando ? "Mandando…" : "Mandar el pedido"}
						</button>
					</div>
				</Paso>
			</div>
		</main>
	);
}

function TallerEnCheckout({
	taller,
	onMetodo,
	onTarifa,
}: {
	taller: EstadoDeTaller;
	onMetodo: (m: MetodoEntrega) => void;
	onTarifa: (id: string) => void;
}) {
	const piezas = taller.articulos.reduce((n, a) => n + piezasDe(a), 0);

	return (
		<div className="rounded-xl border border-tinta/12 bg-hueso p-4">
			<p className="text-[15px] font-semibold text-tinta">{taller.nombre}</p>
			<p className="text-sm text-tinta/60">
				{taller.articulos.length}{" "}
				{taller.articulos.length === 1 ? "diseño" : "diseños"} · {piezas} piezas
			</p>

			{taller.error ? (
				/* No es un fallo que haya que esconder: este taller no puede enviar
				   todavía, y decirlo aquí evita que alguien pague un envío que no
				   existe. Queda recogerlo. */
				<p className="mt-3 rounded-lg bg-[rgba(192,57,43,0.07)] px-3 py-2 text-sm text-tinta/80">
					{taller.error}. Puedes recogerlo con el taller.
				</p>
			) : null}

			<div className="flex gap-2 pt-3">
				<button
					type="button"
					disabled={Boolean(taller.error)}
					onClick={() => onMetodo("envio")}
					className={`h-10 flex-1 rounded-lg border-[1.5px] text-sm font-semibold disabled:opacity-40 ${
						taller.metodo === "envio"
							? "border-tinta bg-tinta text-lima"
							: "border-tinta/20 text-tinta"
					}`}
				>
					Envío a domicilio
				</button>
				<button
					type="button"
					onClick={() => onMetodo("recoger")}
					className={`h-10 flex-1 rounded-lg border-[1.5px] text-sm font-semibold ${
						taller.metodo === "recoger"
							? "border-tinta bg-tinta text-lima"
							: "border-tinta/20 text-tinta"
					}`}
				>
					Recoger con el taller
				</button>
			</div>

			{taller.metodo === "envio" && taller.tarifas.length > 0 && (
				<div className="flex flex-col gap-2 pt-3">
					{taller.tarifas.map((t) => (
						<label
							key={t.id}
							className="flex items-center justify-between gap-3 rounded-lg border border-tinta/12 bg-white px-3 py-2.5"
						>
							<span className="flex items-center gap-2 text-sm text-tinta">
								<input
									type="radio"
									name={`tarifa-${taller.proveedorId}`}
									checked={taller.tarifaId === t.id}
									onChange={() => onTarifa(t.id)}
								/>
								{t.paqueteria} · {t.servicio}
								{t.dias ? ` · ${t.dias} días` : ""}
							</span>
							<span className="font-mono text-sm text-tinta">
								${t.precio.toLocaleString("es-MX")}
							</span>
						</label>
					))}
				</div>
			)}
		</div>
	);
}

function Linea({ texto, monto }: { texto: string; monto: number }) {
	return (
		<div className="flex items-center justify-between text-sm">
			<span className="text-tinta/70">{texto}</span>
			<span className="font-mono text-tinta">
				${monto.toLocaleString("es-MX")}
			</span>
		</div>
	);
}
