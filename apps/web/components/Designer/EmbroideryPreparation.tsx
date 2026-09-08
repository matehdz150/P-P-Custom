"use client";

import {
	type EmbroideryJobPublic,
	embroideryDesignHash,
	resultMatchesCurrentDesign,
} from "@kustto/bordado";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { DesignerProductTemplate } from "@/lib/api/products";
import {
	createEmbroideryJob,
	EmbroideryApiError,
	getEmbroideryJob,
} from "@/lib/bordado/api";
import { capturar } from "@/lib/bordado/capturar";
import {
	type ClienteDeBordado,
	crearClienteDeBordado,
} from "@/lib/bordado/cliente";
import { crearProgramador, type Programador } from "@/lib/bordado/programador";

const ENABLED = process.env.NEXT_PUBLIC_EMBROIDERY_AUTO_DIGITIZATION === "true";

/**
 * Cuánto se espera a que el comprador pare de editar antes de preparar.
 *
 * No es un antirrebote de comodidad: cada diseño DISTINTO que llega al final
 * cuesta una ejecución del motor, y en las pruebas un logo complejo tardó
 * 206 s. Repetir el mismo diseño sí es gratis —el API deriva el `jobId` del
 * `designHash`, así que deshacer y rehacer devuelve el trabajo que ya existe—,
 * de modo que lo que hay que frenar son los estados intermedios de alguien
 * que está iterando, no las repeticiones.
 */
const ESPERA_MS = 2500;

/**
 * A partir de aquí la espera se alarga en vez de cortarse.
 *
 * Quien mueve una letra treinta veces genera treinta diseños distintos, y cada
 * uno es un trabajo. Un tope duro sería peor que el problema: sin panel no hay
 * botón que pulsar, así que dejar de preparar dejaría al comprador sin poder
 * comprar y sin nada que hacer al respecto. Alargar la espera degrada —sigue
 * preparándose, sólo que cuando de verdad se detiene— y no acorrala a nadie.
 */
const TRABAJOS_ANTES_DE_FRENAR = 12;
const ESPERA_LARGA_MS = 15000;

export default function EmbroideryPreparation({
	productId,
	product,
}: {
	productId: string;
	product: DesignerProductTemplate;
}) {
	const { activeSide, tecnicas, getCanvas, getEditableAreas, setBordado } =
		useDesigner();
	const [job, setJob] = useState<EmbroideryJobPublic | null>(null);
	const [error, setError] = useState<string | null>(null);
	/* Dos etapas distintas y el comprador no tiene por qué saberlo: primero se
	   analiza aquí y después lo digitaliza el taller. Lo único que cambia para él
	   es el texto del mensaje. */
	const [analizando, setAnalizando] = useState(false);
	const currentHash = useRef<string | null>(null);
	const revision = useRef(0);
	const cliente = useRef<ClienteDeBordado | null>(null);
	/* Un espejo del estado en una ref: el manejador de cambios del lienzo se
	   registra una sola vez y con el estado normal vería siempre el valor del
	   primer render. */
	const analizandoRef = useRef(false);
	analizandoRef.current = analizando;
	/**
	 * Acceso al lienzo a través de una ref, NO por dependencias.
	 *
	 * El contexto crea `getCanvas` y `getEditableAreas` nuevas en cada render.
	 * Si `programar` dependiera de ellas cambiaría de identidad también en cada
	 * render, y el efecto que la usa limpiaría y volvería a poner el
	 * temporizador cada vez: la espera no llegaría a vencer NUNCA y no se
	 * prepararía nada. Con la ref, `programar` es estable.
	 */
	const lienzo = useRef({ getCanvas, getEditableAreas });
	lienzo.current = { getCanvas, getEditableAreas };

	const isEmbroidery = tecnicas[activeSide] === "bordado";

	/**
	 * Si hay algo que preparar en este lado.
	 *
	 * `capturar()` lanza «Agrega texto o un logo antes de preparar el bordado»
	 * cuando el lienzo sólo tiene el área. Eso servía cuando el comprador
	 * pulsaba un botón —era la respuesta a lo que acababa de hacer—, pero
	 * preparando solo le aparecería un error por abrir un lado en blanco, sin
	 * haber tocado nada. Se comprueba antes de programar nada.
	 */
	const hayContenido = useCallback(() => {
		const canvas = lienzo.current.getCanvas();
		if (!canvas) return false;
		const areas = lienzo.current.getEditableAreas();
		return canvas.getObjects().some((objeto) => !areas.includes(objeto));
	}, []);

	/* El resultado se publica al contexto para que el paso de agregar al carrito
	   pueda consultarlo: es lo que impide que un bordado rechazado acabe pagado.
	   Mientras se prepara se deja en `null` a propósito —"todavía no se sabe" no
	   es lo mismo que "salió bien"— y el carrito trata la ausencia como "hay que
	   preparar esto antes de seguir". */
	useEffect(() => {
		if (!isEmbroidery) {
			setBordado(activeSide, null);
			return;
		}
		if (!job) {
			/* Mientras se prepara se publica PROCESSING, no `null`.
			   `null` significa «no hay nada» y el carrito lo traduce a «prepáralo
			   tú». Eso tenía sentido cuando había un botón; ahora sería mandar al
			   comprador a hacer algo que no puede hacer. PROCESSING dice la
			   verdad: está en marcha, espera. */
			setBordado(
				activeSide,
				analizando
					? {
							jobId: "",
							designHash: "",
							status: "PROCESSING",
							mensaje: null,
							incidencias: [],
						}
					: null,
			);
			return;
		}
		setBordado(activeSide, {
			jobId: job.jobId,
			designHash: job.designHash,
			status: job.status,
			mensaje: job.issues[0]?.message ?? null,
			incidencias: job.issues.map((incidencia) => incidencia.code),
		});
	}, [job, isEmbroidery, activeSide, setBordado, analizando]);

	useEffect(() => {
		cliente.current = crearClienteDeBordado();
		return () => {
			cliente.current?.destruir();
			cliente.current = null;
		};
	}, []);
	/**
	 * Programa una preparación cuando el comprador deje de editar.
	 *
	 * Va en una ref y no en el efecto porque el manejador del lienzo se registra
	 * una sola vez: capturado en un `useCallback` normal vería el `prepare` del
	 * primer render y prepararía siempre el estado inicial.
	 */
	const prepararRef = useRef<(reintento?: boolean) => void>(() => {});

	/** El antirrebote y el freno, probados aparte en `programador.test.ts`. */
	const programador = useRef<Programador | null>(null);
	if (!programador.current)
		programador.current = crearProgramador(
			() => prepararRef.current(),
			{
				espera: ESPERA_MS,
				esperaLarga: ESPERA_LARGA_MS,
				antesDeFrenar: TRABAJOS_ANTES_DE_FRENAR,
			},
			(fn, ms) => window.setTimeout(fn, ms),
			(id) => window.clearTimeout(id),
		);

	const programar = useCallback(() => {
		programador.current?.programar(hayContenido());
	}, [hayContenido]);

	/**
	 * Se depende del LIENZO, no de `getCanvas`.
	 *
	 * `getCanvas` es nueva en cada render, así que este efecto se desuscribía y
	 * se volvía a suscribir continuamente. Con el objeto —estable una vez
	 * creado— corre cuando de verdad cambia, y eso permite programar aquí: el
	 * lienzo puede registrarse DESPUÉS del primer render, y en un diseño que ya
	 * trae contenido no saltaría ningún evento ni habría nada que disparara la
	 * preparación.
	 */
	const canvas = getCanvas();
	useEffect(() => {
		if (!canvas) return;
		const invalidate = () => {
			currentHash.current = null;
			setJob(null);
			/* Cambió el diseño: lo que el worker esté calculando ya no vale. Se sube
			   la revisión para que su respuesta no pueda aplicarse aunque llegue. */
			revision.current++;
			if (analizandoRef.current) {
				cliente.current?.cancelar();
				setAnalizando(false);
			}
			programar();
		};
		canvas.on("object:added", invalidate);
		canvas.on("object:modified", invalidate);
		canvas.on("object:removed", invalidate);
		canvas.on("text:changed", invalidate);
		// El lienzo acaba de estar disponible: si ya trae diseño, a preparar.
		programar();
		return () => {
			canvas.off("object:added", invalidate);
			canvas.off("object:modified", invalidate);
			canvas.off("object:removed", invalidate);
			canvas.off("text:changed", invalidate);
		};
	}, [canvas, programar]);

	/**
	 * Preparar también al ENTRAR a un lado que ya tiene diseño.
	 *
	 * El lienzo sólo avisa cuando algo cambia, y hay dos formas de llegar aquí
	 * sin que cambie nada: cambiar la técnica a bordado sobre un diseño ya
	 * hecho, y volver a un lado que se editó antes. En ambas no saltaría ningún
	 * evento y el comprador se quedaría esperando un bordado que nadie pidió.
	 *
	 * `activeSide` está en las dependencias aunque no se lea en el cuerpo: es lo
	 * ÚNICO que hace que esto vuelva a correr al cambiar de cara, porque
	 * `programar` es estable a propósito —lee el lienzo por ref—. Quitarlo, que
	 * es lo que sugiere el linter, dejaría de preparar al cambiar de lado.
	 */
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver arriba: es la dependencia que dispara el cambio de lado
	useEffect(() => {
		if (!ENABLED || !isEmbroidery) return;
		programar();
		return () => programador.current?.cancelar();
	}, [isEmbroidery, activeSide, programar]);
	useEffect(() => {
		if (!job || (job.status !== "QUEUED" && job.status !== "PROCESSING"))
			return;
		let cancelled = false;
		const timer = window.setInterval(async () => {
			try {
				const next = await getEmbroideryJob(job.jobId);
				if (!cancelled && resultMatchesCurrentDesign(currentHash.current, next))
					setJob(next);
			} catch {}
		}, 1500);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [job]);
	const prepare = useCallback(
		async (retry = false) => {
			setError(null);
			const mia = ++revision.current;
			setAnalizando(true);
			try {
				const side = product.printSides?.find(
					(item) => item.sideKey === activeSide,
				);
				const canvas = getCanvas();
				if (!side || !canvas)
					throw new Error("Este lado todavía no está listo");

				// La captura es la parte que necesita Fabric y el documento; es barata.
				const { solicitud, transferibles } = await capturar({
					canvas,
					areas: getEditableAreas(),
					productId,
					sideId: activeSide,
					widthMm: side.widthCm * 10,
					heightMm: side.heightCm * 10,
					revision: mia,
				});
				if (mia !== revision.current) return;

				// Y esta es la cara: se va al worker y el editor sigue vivo.
				const respuesta = await cliente.current?.preparar(
					solicitud,
					transferibles,
				);
				if (!respuesta || mia !== revision.current) return;

				if (respuesta.estado === "error") throw new Error(respuesta.mensaje);
				if (respuesta.estado === "rechazado") {
					const primera = respuesta.incidencias[0];
					setError(primera?.message ?? "Este diseño no se puede bordar");
					/* Un rechazo local NO crea trabajo remoto, así que no hay `job` que
					   publique el estado: se publica aquí a mano. Sin esto el carrito
					   veía "sin preparar" en vez de "rechazado", que es lo mismo para
					   bloquear pero peor para explicárselo al comprador. */
					const revisable = respuesta.incidencias.every(
						(incidencia) => incidencia.severity === "review",
					);
					setBordado(activeSide, {
						jobId: "",
						designHash: "",
						status: revisable ? "REVIEW" : "REJECTED",
						mensaje: primera?.message ?? null,
						incidencias: respuesta.incidencias.map((i) => i.code),
					});
					return;
				}

				const hash = await embroideryDesignHash(respuesta.design);
				if (mia !== revision.current) return;
				currentHash.current = hash;

				programador.current?.contar();
				const next = await createEmbroideryJob(respuesta.design, retry);
				if (
					mia === revision.current &&
					resultMatchesCurrentDesign(currentHash.current, next)
				)
					setJob(next);
			} catch (cause) {
				if (mia !== revision.current) return;
				if (cause instanceof EmbroideryApiError && cause.status === 401)
					setError("Inicia sesión para preparar y guardar el bordado.");
				else
					setError(
						cause instanceof Error
							? cause.message
							: "No pudimos preparar el bordado",
					);
			} finally {
				if (mia === revision.current) setAnalizando(false);
			}
		},
		[activeSide, getCanvas, getEditableAreas, product, productId, setBordado],
	);
	prepararRef.current = prepare;
	if (!ENABLED || !isEmbroidery) return null;
	const working = job?.status === "QUEUED" || job?.status === "PROCESSING";
	const ocupado = analizando || working;
	/* El aviso que SÍ le importa al comprador: por qué no va a poder continuar.
	   `REVIEW` no está aquí a propósito —el bordado se puede comprar y quien lo
	   revisa es el taller, así que decírselo sólo le daría una preocupación que
	   no le toca resolver. */
	const problema =
		error ??
		(job?.status === "REJECTED"
			? (job.issues[0]?.message ??
				"Este diseño no se puede bordar. Prueba con formas más simples.")
			: job?.status === "FAILED"
				? "No pudimos preparar tu bordado. Cambia algo del diseño para intentarlo otra vez."
				: null);

	/* Nada que decir, nada que enseñar. La preparación es asunto nuestro: si va
	   bien, el comprador no tiene por qué enterarse de que existe. */
	if (!ocupado && !problema) return null;

	return (
		<div
			aria-live="polite"
			className="pointer-events-none fixed bottom-20 right-4 z-30 w-[min(20rem,calc(100vw-2rem))] md:bottom-6"
		>
			{problema ? (
				<p className="rounded-xl border border-red-200 bg-red-50/95 px-3 py-2 text-sm text-red-800 shadow-sm backdrop-blur">
					{problema}
				</p>
			) : (
				/* Sin botón de cancelar: cancelar dejaba el lado sin preparar y sin
				   forma de volver a intentarlo, que es justo el callejón sin salida
				   que había que evitar al quitar el panel. Cambiar el diseño ya
				   cancela lo que hubiera en curso. */
				<p className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3 py-1.5 text-sm text-black/70 shadow-sm backdrop-blur">
					<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
					Preparando tu bordado…
				</p>
			)}
		</div>
	);
}
