"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useComprador } from "@/Contexts/CompradorContext";
import { Campo } from "@/components/Pedir/Campo";
import { Envio } from "@/components/Pedir/Envio";
import { Paso } from "@/components/Pedir/Paso";
import { Resumen } from "@/components/Pedir/Resumen";
import { getFichaDeProducto } from "@/lib/api/catalogo";
import {
	cotizarEnvio,
	destacadas,
	SinEnvio,
	type Tarifa,
} from "@/lib/api/envios";
import { getMiPerfil } from "@/lib/api/cuenta";
import {
	crearPedido,
	type Direccion,
	enlaceDeSeguimiento,
	subirArchivos,
} from "@/lib/api/pedir";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { ESTADOS_MX } from "@/lib/mexico";
import {
	type BorradorPedido,
	borrarBorrador,
	leerBorrador,
} from "@/lib/pedido/borrador";
import { loadProductTemplate } from "@/lib/products/loadProductsTemplate";

/**
 * El checkout.
 *
 * Antes esto era un modal encima del editor, y tenía dos problemas: no cabía
 * lo que hace falta para entregar un paquete, y pedía datos de envío sobre un
 * lienzo a medio tapar. Ahora es su propia pantalla, con el diseño a la vista
 * mientras se captura.
 *
 * El diseño llega en el borrador que dejó el editor (`lib/pedido/borrador.ts`),
 * porque el lienzo de Fabric no sobrevive a la navegación. Si alguien entra
 * aquí de frente —un enlace guardado, una pestaña vieja— no hay nada que
 * pedir, y eso se dice en vez de enseñar un formulario que no va a funcionar.
 */

const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Contacto = { nombre: string; email: string; whatsapp: string };
type MetodoEntrega = "envio" | "recoger";

type EstadoEnvio = {
	estado: "inactivo" | "cotizando" | "listo" | "sin-envio" | "error";
	tarifas: Tarifa[];
	elegida: Tarifa | null;
	/** El id de la cotizacion de Skydropx: viaja al pedido para verificar precio. */
	cotizacionId: string | null;
};

/** Las piezas por talla, en una cadena estable para comparar destinos. */
function piezasPorTalla(cantidades: Record<string, number>) {
	return Object.entries(cantidades)
		.filter(([, n]) => n > 0)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([t, n]) => `${t}:${n}`)
		.join(",");
}

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

/**
 * La dirección del perfil, lista para meter en el formulario.
 *
 * El perfil guarda `null` en lo opcional y aquí los campos son cadenas: un
 * `null` en un input lo vuelve no controlado y React se queja en consola.
 */
function limpiar(d: Record<string, string | null> | null): Partial<Direccion> {
	if (!d) return {};
	return Object.fromEntries(
		Object.entries(d).map(([k, v]) => [k, v ?? ""]),
	) as Partial<Direccion>;
}

export default function PedirPage() {
	const router = useRouter();

	const [borrador, setBorrador] = useState<BorradorPedido | null>(null);
	const [producto, setProducto] = useState<DesignerProductTemplate | null>(
		null,
	);
	/** La foto de catálogo. No viene en la plantilla, que sólo trae el lienzo. */
	const [fotoProducto, setFotoProducto] = useState<string | null>(null);
	const [cargando, setCargando] = useState(true);

	const [paso, setPaso] = useState(1);
	const [visitados, setVisitados] = useState<number[]>([]);

	const [cantidades, setCantidades] = useState<Record<string, number>>({});
	const [contacto, setContacto] = useState<Contacto>({
		nombre: "",
		email: "",
		whatsapp: "",
	});
	const [metodo, setMetodo] = useState<MetodoEntrega>("envio");
	const [envio, setEnvio] = useState<EstadoEnvio>({
		estado: "inactivo",
		tarifas: [],
		elegida: null,
		cotizacionId: null,
	});
	const [verTodasLasTarifas, setVerTodasLasTarifas] = useState(false);
	const [direccion, setDireccion] = useState<Direccion>(DIRECCION_VACIA);
	const [notas, setNotas] = useState("");

	/* ─── Lo que ya sabemos de quien entró ─────────────────────────────────
	   Con sesión, el checkout no vuelve a preguntar lo que ya está guardado.
	   Se rellena UNA vez y sólo lo que esté vacío: si el perfil llega tarde
	   —es una petición a la API— no puede pisar lo que la persona ya tecleó. */
	const { comprador } = useComprador();
	const [perfilPuesto, setPerfilPuesto] = useState(false);
	const yaRellene = useRef(false);

	useEffect(() => {
		if (!comprador || yaRellene.current) return;
		yaRellene.current = true;

		// El nombre y el correo salen del token, así que están de inmediato.
		setContacto((c) => ({
			...c,
			nombre: c.nombre || (comprador.nombre ?? ""),
			email: c.email || comprador.email,
		}));

		getMiPerfil()
			.then((perfil) => {
				setContacto((c) => ({
					...c,
					nombre: c.nombre || (perfil.nombre ?? ""),
					whatsapp: c.whatsapp || (perfil.whatsapp ?? ""),
				}));

				if (!perfil.direccion) return;

				setDireccion((d) =>
					d.calle.trim() ? d : { ...d, ...limpiar(perfil.direccion) },
				);
				setPerfilPuesto(true);
			})
			// Sin perfil guardado se sigue con lo del token: no tener dirección
			// no es un fallo, es alguien que pide por primera vez.
			.catch(() => {});
	}, [comprador]);

	const [errores, setErrores] = useState<Record<string, string>>({});
	const [enviando, setEnviando] = useState(false);
	const [fallo, setFallo] = useState<string | null>(null);

	useEffect(() => {
		let vigente = true;

		leerBorrador()
			.then(async (b) => {
				if (!vigente) return;
				if (!b) {
					setCargando(false);
					return;
				}

				setBorrador(b);

				// La plantilla trae el lienzo y los precios; la ficha, la foto de
				// catálogo. Van en paralelo porque no dependen una de la otra.
				const [plantilla, ficha] = await Promise.all([
					loadProductTemplate(b.productoId),
					getFichaDeProducto(b.productoId).catch(() => null),
				]);
				if (!vigente) return;

				setProducto(plantilla);
				setFotoProducto(ficha?.images?.[0]?.url ?? null);
				setCargando(false);
			})
			.catch(() => vigente && setCargando(false));

		return () => {
			vigente = false;
		};
	}, []);

	const tallas = useMemo(
		() =>
			producto?.sizes?.length
				? producto.sizes.map((t) => t.size)
				: ["S", "M", "L", "XL"],
		[producto],
	);

	const lados = borrador?.lados.map((l) => l.lado) ?? [];
	const piezas = Object.values(cantidades).reduce((n, v) => n + (v || 0), 0);

	const subtotal = useMemo(() => {
		if (!producto) return 0;
		const base = producto.pricing?.basePrice ?? 0;
		const porLado = producto.pricing?.perSidePrice ?? 0;
		const extra = Math.max(0, lados.length - 1) * porLado;
		return (base + extra) * piezas;
	}, [producto, lados.length, piezas]);

	const total = subtotal + (metodo === "envio" ? (envio.elegida?.precio ?? 0) : 0);

	/* ─── El envío ───────────────────────────────────────────────────────
	   Se cotiza cuando la dirección está COMPLETA, nunca mientras se teclea:
	   Skydropx admite 2 peticiones por segundo y una persona escribiendo su
	   código postal la revienta sola. El efecto depende de los campos ya
	   normalizados, así que sólo se dispara al cambiar de verdad el destino. */
	const destinoListo =
		metodo === "envio" &&
		/^\d{5}$/.test(direccion.cp.trim()) &&
		direccion.colonia.trim() !== "" &&
		direccion.ciudad.trim() !== "" &&
		direccion.estado !== "";

	// Una cadena y no un objeto: con un objeto el efecto se relanzaría en cada
	// render aunque el destino sea el mismo, y cada relanzamiento es una
	// cotización más contra la cuota.
	const claveDestino = destinoListo
		? [
				direccion.cp.trim(),
				direccion.colonia.trim(),
				direccion.ciudad.trim(),
				direccion.estado,
				piezasPorTalla(cantidades),
			].join("|")
		: "";

	useEffect(() => {
		if (!claveDestino || !borrador?.productoId) {
			setEnvio({ estado: "inactivo", tarifas: [], elegida: null, cotizacionId: null });
			return;
		}

		const control = new AbortController();
		setEnvio({ estado: "cotizando", tarifas: [], elegida: null, cotizacionId: null });

		const productoId = borrador.productoId;
		const tallas = Object.entries(cantidades)
			.filter(([, n]) => n > 0)
			.map(([size, piezas]) => ({ size, piezas }));

		const destino = {
			cp: direccion.cp.trim(),
			estado: direccion.estado,
			ciudad: direccion.ciudad.trim(),
			colonia: direccion.colonia.trim(),
		};

		/* Se espera a que la persona deje de tocar antes de cotizar.
		 *
		 * Sin esto, cada clic en "+1" dispara una cotización: siete clics
		 * seguidos son siete peticiones en medio segundo, y Skydropx responde
		 * 429 a todas —su límite es de 2 por segundo, medido por cuenta—. Pasó
		 * de verdad. El código postal ya estaba a salvo porque sólo cuenta
		 * completo; las cantidades no, porque cualquier valor es válido. */
		const espera = setTimeout(() => {
			cotizarEnvio([{ productoId, tallas }], destino, {
				senal: control.signal,
				// Se pinta lo que va llegando: cinco segundos en blanco se sienten
				// rotos, y con dos opciones ya puestas se sienten rápidos.
				onParcial: (tarifas) =>
					setEnvio((e) =>
						e.estado === "cotizando"
							? { ...e, tarifas, elegida: e.elegida ?? destacadas(tarifas)[0] }
							: e,
					),
			})
				.then(({ cotizacionId, tarifas }) => {
					if (control.signal.aborted) return;
					setEnvio((e) => ({
						estado: tarifas.length > 0 ? "listo" : "error",
						tarifas,
						// Se preselecciona la más barata para que el total no quede en
						// blanco, pero se puede cambiar.
						elegida: e.elegida ?? destacadas(tarifas)[0] ?? null,
						cotizacionId,
					}));
				})
				.catch((error) => {
					if (control.signal.aborted) return;
					setEnvio({
						estado: error instanceof SinEnvio ? "sin-envio" : "error",
						tarifas: [],
						elegida: null,
						cotizacionId: null,
					});
				});
		}, 700);

		return () => {
			clearTimeout(espera);
			control.abort();
		};
		// `cantidades` y `direccion` entran por `claveDestino`, que es lo que de
		// verdad decide si hay que volver a cotizar.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [claveDestino, borrador?.productoId]);

	/* ─── Validación, paso por paso ─────────────────────────────────────── */

	function validar(n: number): Record<string, string> {
		const e: Record<string, string> = {};

		if (n === 1 && piezas === 0) {
			e.tallas = "Dinos cuántas piezas quieres de cada talla.";
		}

		if (n === 2) {
			if (!contacto.nombre.trim()) e.nombre = "Necesitamos tu nombre.";
			if (!CORREO.test(contacto.email.trim())) {
				e.email = "Escribe un correo válido: ahí te llega el seguimiento.";
			}
		}

		if (n === 3 && metodo === "envio") {
			if (!direccion.calle.trim()) e.calle = "Falta la calle.";
			if (!direccion.numero.trim()) e.numero = "Falta el número.";
			if (!direccion.colonia.trim()) e.colonia = "Falta la colonia.";
			if (!direccion.ciudad.trim()) e.ciudad = "Falta la ciudad o municipio.";
			if (!direccion.estado) e.estado = "Elige el estado.";
			if (!/^\d{5}$/.test(direccion.cp.trim())) {
				e.cp = "El código postal va a cinco dígitos.";
			}
		}

		return e;
	}

	function continuar(n: number) {
		const e = validar(n);
		setErrores(e);
		if (Object.keys(e).length > 0) return;

		setVisitados((v) => (v.includes(n) ? v : [...v, n]));
		setPaso(n + 1);
	}

	const completado = (n: number) =>
		visitados.includes(n) && Object.keys(validar(n)).length === 0;

	/* ─── Mandar ────────────────────────────────────────────────────────── */

	async function mandar() {
		if (enviando || !borrador || !producto) return;

		// Se revalida todo: alguien pudo volver a un paso, vaciarlo y saltar
		// aquí con el resumen plegado enseñando datos que ya no están.
		const e = { ...validar(1), ...validar(2), ...validar(3) };
		if (Object.keys(e).length > 0) {
			setErrores(e);
			setPaso(
				Object.keys(validar(1)).length
					? 1
					: Object.keys(validar(2)).length
						? 2
						: 3,
			);
			return;
		}

		setFallo(null);
		setEnviando(true);

		try {
			const pedido = await crearPedido({
				comprador: {
					nombre: contacto.nombre.trim(),
					email: contacto.email.trim(),
					whatsapp: contacto.whatsapp.trim() || undefined,
					notas: notas.trim() || undefined,
				},
				entrega:
					metodo === "envio"
						? {
								metodo: "envio",
								direccion: {
									calle: direccion.calle.trim(),
									numero: direccion.numero.trim(),
									interior: direccion.interior?.trim() || undefined,
									colonia: direccion.colonia.trim(),
									ciudad: direccion.ciudad.trim(),
									estado: direccion.estado,
									cp: direccion.cp.trim(),
									referencias: direccion.referencias?.trim() || undefined,
								},
							}
						: { metodo: "recoger" },
				/* Sólo el id de la cotización y cuál se eligió. El precio NO se
				   manda: lo lee la Lambda de Skydropx, porque nada que pase por
				   el navegador puede decidir cuánto se cobra. */
				envio:
					metodo === "envio" && envio.elegida && envio.cotizacionId
						? {
								cotizacionId: envio.cotizacionId,
								tarifaId: envio.elegida.id,
							}
						: undefined,
				lineas: [
					{
						productoId: borrador.productoId,
						colorPrenda: borrador.colorPrenda,
						lados,
						archivos: borrador.lados.map((l) => ({
							lado: l.lado,
							anchoPx: l.anchoPx,
							altoPx: l.altoPx,
							dpi: l.dpi,
						})),
						tallas: Object.entries(cantidades)
							.filter(([, n]) => n > 0)
							.map(([size, n]) => ({ size, piezas: n })),
					},
				],
			});

			const { faltaArte } = await subirArchivos(
				pedido,
				borrador.lados,
				borrador.diseno,
			);

			// El borrador se tira aunque alguna subida haya fallado: el pedido ya
			// existe, y dejarlo permitiría mandarlo otra vez desde esta pantalla.
			await borrarBorrador();

			// Sólo se avisa si faltó el ARTE: sin él no se puede producir. Que
			// falte la imagen de colocación es una molestia para el taller, no
			// algo que el comprador tenga que resolver.
			if (faltaArte.length > 0) {
				alert(
					`Tu pedido ${pedido.folio} quedó registrado, pero no pudimos subir el arte de: ${faltaArte.join(", ")}. Escríbenos con tu folio y lo resolvemos.`,
				);
			}

			router.push(enlaceDeSeguimiento(pedido));
		} catch (error) {
			setFallo(
				error instanceof Error ? error.message : "No pudimos mandar tu pedido.",
			);
			setEnviando(false);
		}
	}

	/* ─── Estados de la pantalla ────────────────────────────────────────── */

	if (cargando) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<output
					className="h-8 w-8 animate-spin rounded-full border-[3px] border-tinta/15 border-t-tinta"
					aria-label="Cargando tu pedido"
				/>
			</div>
		);
	}

	if (!borrador || !producto) {
		return (
			<div className="mx-auto max-w-[560px] px-5 py-20 text-center">
				<h1 className="font-display text-[26px] font-bold tracking-[-0.02em] text-tinta">
					No encontramos tu diseño
				</h1>
				<p className="pt-3 text-[15px] leading-[24px] text-tinta/65">
					Un diseño sólo se guarda mientras lo estás pidiendo. Si recargaste
					después de mandarlo, o pasaron varias horas, hay que volver a abrirlo
					en el editor.
				</p>
				<Link
					href="/catalogo/productos"
					className="mt-6 inline-flex h-12 items-center justify-center rounded-lg bg-tinta px-6 text-[15px] font-semibold text-lima"
				>
					Ver el catálogo
				</Link>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-[1180px] px-5 pb-24 pt-10 md:px-8">
			{/* El diseño sigue guardado, así que volver al editor no cuesta nada.
			    Sin esta salida, cambiar un detalle obliga a rehacerlo entero. */}
			<Link
				href={`/design/${borrador.productoId}`}
				className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-tinta/70 hover:text-tinta"
			>
				<span aria-hidden="true">←</span>
				Volver a editar mi diseño
			</Link>

			<header className="pb-10 pt-6 text-center">
				<h1 className="font-display text-[32px] font-bold uppercase tracking-[0.01em] text-tinta md:text-[40px]">
					Finalizar pedido
				</h1>
				<p className="pt-1.5 text-[14px] text-tinta/60">
					({piezas} {piezas === 1 ? "pieza" : "piezas"}) · $
					{total.toLocaleString("es-MX")}
				</p>
			</header>

			<div className="grid gap-12 lg:grid-cols-[1fr_400px] lg:items-start lg:gap-16">
				<div>
					{/* 1 ─ Tallas */}
					<Paso
						numero={1}
						titulo="Tallas y cantidad"
						abierto={paso === 1}
						completado={completado(1)}
						onEditar={() => setPaso(1)}
						resumen={Object.entries(cantidades)
							.filter(([, n]) => n > 0)
							.map(([t, n]) => `${t} × ${n}`)
							.join("   ")}
					>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							{tallas.map((talla) => (
								<label key={talla} className="flex flex-col gap-1.5">
									<span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-tinta/60">
										{talla}
									</span>
									<input
										type="number"
										min={0}
										inputMode="numeric"
										value={cantidades[talla] ?? ""}
										onChange={(e) =>
											setCantidades((c) => ({
												...c,
												[talla]: Math.max(0, Number(e.target.value) || 0),
											}))
										}
										className="h-14 rounded-lg border-[1.5px] border-tinta/20 bg-white px-3.5 text-[15px] text-tinta outline-none focus:border-tinta"
									/>
								</label>
							))}
						</div>

						{errores.tallas && (
							<p role="alert" className="pt-3 text-[13px] text-[#c0392b]">
								{errores.tallas}
							</p>
						)}

						<BotonPaso onClick={() => continuar(1)} />
					</Paso>

					{/* 2 ─ Contacto */}
					<Paso
						numero={2}
						titulo="Contacto"
						abierto={paso === 2}
						completado={completado(2)}
						onEditar={() => setPaso(2)}
						resumen={
							<>
								{contacto.nombre}
								<br />
								{contacto.email}
							</>
						}
					>
						<div className="grid gap-3.5">
							<Campo
								id="nombre"
								etiqueta="Nombre completo"
								requerido
								autoComplete="name"
								valor={contacto.nombre}
								error={errores.nombre}
								onChange={(v) => setContacto((c) => ({ ...c, nombre: v }))}
							/>
							{/* Con sesión el correo NO se edita.
							    Los pedidos se encuentran por correo: si alguien pone
							    aquí uno distinto del de su cuenta, el pedido es válido
							    pero no vuelve a aparecerle en "Mis pedidos" y no hay
							    forma de devolvérselo. */}
							<Campo
								id="email"
								etiqueta="Correo electrónico"
								tipo="email"
								inputMode="email"
								requerido
								autoComplete="email"
								bloqueado={Boolean(comprador)}
								ayuda={
									comprador
										? "El de tu cuenta. Aquí te llega el enlace para seguir tu pedido."
										: "Aquí te mandamos el enlace para seguir tu pedido."
								}
								valor={contacto.email}
								error={errores.email}
								onChange={(v) => setContacto((c) => ({ ...c, email: v }))}
							/>
							<Campo
								id="whatsapp"
								etiqueta="WhatsApp (opcional)"
								inputMode="tel"
								autoComplete="tel"
								ayuda="El taller lo usa para dudas rápidas sobre tu diseño."
								valor={contacto.whatsapp}
								onChange={(v) => setContacto((c) => ({ ...c, whatsapp: v }))}
							/>
						</div>

						<BotonPaso onClick={() => continuar(2)} />
					</Paso>

					{/* 3 ─ Entrega */}
					<Paso
						numero={3}
						titulo="Entrega"
						abierto={paso === 3}
						completado={completado(3)}
						onEditar={() => setPaso(3)}
						resumen={
							metodo === "recoger" ? (
								"Recoger con el taller"
							) : (
								<>
									{direccion.calle} {direccion.numero}
									{direccion.interior && ` int. ${direccion.interior}`}
									<br />
									{direccion.colonia}, {direccion.ciudad}, {direccion.estado}{" "}
									{direccion.cp}
								</>
							)
						}
					>
						<div className="grid gap-3 pb-5 sm:grid-cols-2">
							<OpcionEntrega
								activa={metodo === "envio"}
								titulo="Envío a domicilio"
								detalle="Te cotizamos la paquetería con tu código postal."
								onClick={() => setMetodo("envio")}
							/>
							<OpcionEntrega
								activa={metodo === "recoger"}
								titulo="Recoger con el taller"
								detalle="Acuerdan punto y hora por WhatsApp."
								onClick={() => setMetodo("recoger")}
							/>
						</div>

						{metodo === "envio" && (
							<div className="grid gap-3.5">
								{perfilPuesto && (
									// Se dice que viene de la cuenta y se puede editar aquí
									// mismo: cambiarla en este pedido NO toca la guardada, y
									// callárselo haría que alguien la "corrigiera" creyendo
									// que arregla su perfil.
									<p className="rounded-lg bg-gris px-3.5 py-3 text-[13px] leading-[21px] text-tinta/70">
										Pusimos la dirección de tu cuenta. Si este pedido va a otro
										lado, cámbiala aquí — tu cuenta se queda como está.
									</p>
								)}
								<div className="grid gap-3.5 sm:grid-cols-[2fr_1fr_1fr]">
									<Campo
										id="calle"
										etiqueta="Calle"
										requerido
										autoComplete="address-line1"
										valor={direccion.calle}
										error={errores.calle}
										onChange={(v) => setDireccion((d) => ({ ...d, calle: v }))}
									/>
									<Campo
										id="numero"
										etiqueta="Número"
										requerido
										valor={direccion.numero}
										error={errores.numero}
										onChange={(v) => setDireccion((d) => ({ ...d, numero: v }))}
									/>
									<Campo
										id="interior"
										etiqueta="Interior"
										valor={direccion.interior ?? ""}
										onChange={(v) =>
											setDireccion((d) => ({ ...d, interior: v }))
										}
									/>
								</div>

								<div className="grid gap-3.5 sm:grid-cols-[2fr_1fr]">
									<Campo
										id="colonia"
										etiqueta="Colonia"
										requerido
										autoComplete="address-level3"
										valor={direccion.colonia}
										error={errores.colonia}
										onChange={(v) =>
											setDireccion((d) => ({ ...d, colonia: v }))
										}
									/>
									<Campo
										id="cp"
										etiqueta="Código postal"
										requerido
										inputMode="numeric"
										maxLength={5}
										autoComplete="postal-code"
										valor={direccion.cp}
										error={errores.cp}
										onChange={(v) =>
											setDireccion((d) => ({
												...d,
												cp: v.replace(/\D/g, "").slice(0, 5),
											}))
										}
									/>
								</div>

								<div className="grid gap-3.5 sm:grid-cols-2">
									<Campo
										id="ciudad"
										etiqueta="Ciudad o municipio"
										requerido
										autoComplete="address-level2"
										valor={direccion.ciudad}
										error={errores.ciudad}
										onChange={(v) => setDireccion((d) => ({ ...d, ciudad: v }))}
									/>

									<div className="flex flex-col">
										<div className="relative">
											<select
												id="estado"
												value={direccion.estado}
												onChange={(e) =>
													setDireccion((d) => ({
														...d,
														estado: e.target.value,
													}))
												}
												aria-invalid={errores.estado ? true : undefined}
												className={`h-14 w-full appearance-none rounded-lg border-[1.5px] bg-white px-3.5 pt-4 text-[15px] text-tinta outline-none focus:border-tinta ${
													errores.estado
														? "border-[#c0392b]"
														: "border-tinta/20"
												}`}
											>
												<option value="">Elige…</option>
												{ESTADOS_MX.map((e) => (
													<option key={e} value={e}>
														{e}
													</option>
												))}
											</select>
											<span className="pointer-events-none absolute left-3.5 top-1.5 text-[11px] uppercase tracking-[0.06em] text-tinta/55">
												Estado *
											</span>
										</div>
										{errores.estado && (
											<span
												role="alert"
												className="pt-1.5 text-[13px] text-[#c0392b]"
											>
												{errores.estado}
											</span>
										)}
									</div>
								</div>

								<Campo
									id="referencias"
									etiqueta="Referencias (opcional)"
									ayuda="Color de la fachada, entre qué calles, algo que ayude a encontrarte."
									valor={direccion.referencias ?? ""}
									onChange={(v) =>
										setDireccion((d) => ({ ...d, referencias: v }))
									}
								/>

								{/* Debajo de la dirección y no arriba: no hay nada que
								    cotizar hasta que el código postal esté completo. */}
								<Envio
									estado={envio.estado}
									tarifas={envio.tarifas}
									elegida={envio.elegida}
									onElegir={(t) => setEnvio((e) => ({ ...e, elegida: t }))}
									verTodas={verTodasLasTarifas}
									onVerTodas={() => setVerTodasLasTarifas(true)}
								/>
							</div>
						)}

						<BotonPaso onClick={() => continuar(3)} />
					</Paso>

					{/* 4 ─ Pago */}
					<Paso
						numero={4}
						titulo="Pago"
						abierto={paso === 4}
						completado={false}
						onEditar={() => setPaso(4)}
					>
						{/* No hay pasarela y es a propósito: se dejó para el final del
						    proyecto. Decirlo claro aquí evita que alguien espere un
						    cargo que no va a ocurrir y crea que el pedido falló. */}
						<div className="rounded-lg border border-tinta/12 bg-gris p-5">
							<p className="font-display text-[15px] font-semibold text-tinta">
								Todavía no se cobra nada
							</p>
							<p className="pt-1.5 text-[14px] leading-[22px] text-tinta/65">
								El taller revisa tu diseño, confirma el precio final y el costo
								del envío, y ahí acuerdan contigo cómo pagar. Vas a poder seguir
								todo desde el enlace que te llega por correo.
							</p>
						</div>

						<Campo
							id="notas"
							etiqueta="Notas para el taller (opcional)"
							className="pt-3.5"
							valor={notas}
							onChange={setNotas}
						/>

						{fallo && (
							<p role="alert" className="pt-4 text-[14px] text-[#c0392b]">
								{fallo}
							</p>
						)}

						<button
							type="button"
							onClick={mandar}
							disabled={enviando}
							className="mt-6 flex h-14 w-full items-center justify-center rounded-lg bg-tinta text-[15px] font-semibold uppercase tracking-[0.04em] text-lima transition-opacity disabled:opacity-50"
						>
							{enviando ? "Mandando tu pedido…" : "Mandar pedido"}
						</button>

						<p className="pt-3 text-center text-[12px] leading-[18px] text-tinta/50">
							Al mandarlo, tu diseño se envía al taller para que lo revise.
						</p>
					</Paso>
				</div>

				<Resumen
					producto={producto}
					fotoProducto={fotoProducto}
					archivos={borrador.lados}
					colorPrenda={borrador.colorPrenda}
					lados={lados}
					cantidades={cantidades}
					piezas={piezas}
					total={total}
					envio={metodo === "recoger" ? "recoger" : envio.elegida}
					cotizando={envio.estado === "cotizando"}
				/>
			</div>
		</div>
	);
}

function BotonPaso({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="mt-6 flex h-13 w-full items-center justify-center rounded-lg bg-tinta py-4 text-[15px] font-semibold uppercase tracking-[0.04em] text-lima sm:w-auto sm:px-10"
		>
			Continuar
		</button>
	);
}

function OpcionEntrega({
	activa,
	titulo,
	detalle,
	onClick,
}: {
	activa: boolean;
	titulo: string;
	detalle: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={activa}
			className={`rounded-lg border-[1.5px] p-4 text-left transition-colors ${
				activa
					? "border-tinta bg-white"
					: "border-tinta/20 bg-white hover:border-tinta/40"
			}`}
		>
			<span className="flex items-center gap-2.5">
				<span
					className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
						activa ? "border-tinta" : "border-tinta/30"
					}`}
				>
					{activa && <span className="h-2.5 w-2.5 rounded-full bg-tinta" />}
				</span>
				<span className="font-display text-[15px] font-semibold text-tinta">
					{titulo}
				</span>
			</span>
			<span className="block pt-1.5 pl-[28px] text-[13px] leading-[20px] text-tinta/60">
				{detalle}
			</span>
		</button>
	);
}
