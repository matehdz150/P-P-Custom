"use client";
import {
	FabricImage,
	type FabricObject,
	Group,
	loadSVGFromString,
} from "fabric";
import { useCallback, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { makeAreaClip } from "@/lib/fabric/areaClip";
import { salidaDelLado } from "@/lib/impresion/tecnicas";
import { ErrorDeVectorizado, vectorizar } from "@/lib/impresion/vectorizar";
import { useElementGuard } from "./useProductConfig";

const ORANGE = "#2b2812";

function applySelectionStyle(obj: FabricObject) {
	obj.set({
		transparentCorners: false,
		cornerColor: "#ffffff",
		cornerStrokeColor: ORANGE,
		borderColor: ORANGE,
		cornerSize: 8,
		borderScaleFactor: 1.1,
		cornerStyle: "rect",
	});
}

/**
 * En qué anda la imagen que se está agregando.
 *
 * `null` es lo normal: no hay nada en curso. Se expone para que el panel pinte
 * el estado, porque en un lado de grabado agregar una imagen deja de ser
 * instantáneo — hay que trazarla antes de que entre.
 */
export type EstadoDeImagen =
	| { fase: "vectorizando" }
	| { fase: "fallo"; mensaje: string; puedeReintentar: boolean }
	/**
	 * Salió, pero con el contorno peor de lo que debería.
	 *
	 * NO es un error: el diseño está puesto y se puede pedir. Es un consejo, y
	 * por eso no bloquea nada — a diferencia del fallo, que sí impide insertar.
	 */
	| { fase: "flojo" }
	| null;

export function useAddImage() {
	const { getCanvas, getEditableAreas, setActiveObject, activeSide, tecnicas } =
		useDesigner();
	const guard = useElementGuard();

	const [estado, setEstado] = useState<EstadoDeImagen>(null);
	/* La última fuente, para poder reintentar sin obligar a volver a elegir el
	   archivo. Vive en memoria y NO en el objeto de Fabric: lo que se serializa
	   viaja a S3 dentro de `diseno.json`, y meter ahí un data URL de varios MB
	   engordaría el pedido entero por una comodidad. */
	const [ultima, setUltima] = useState<string | null>(null);

	/** Lo que se está diseñando ahora, ¿se imprime o se graba? */
	const esGrabado =
		salidaDelLado({ tecnica: tecnicas[activeSide] }) === "vector";

	/** Coloca cualquier objeto ya listo dentro del área, y lo selecciona. */
	const colocar = useCallback(
		(objeto: FabricObject) => {
			const canvas = getCanvas();
			if (!canvas) return;

			const area = getEditableAreas()[0] ?? null;

			/* El origen al CENTRO para todos, imagen o grupo de trazos: abajo se
			   coloca por el centro del área, y con el origen por defecto —esquina
			   superior izquierda— el objeto entraría corrido media caja. */
			objeto.set({ originX: "center", originY: "center" });
			applySelectionStyle(objeto);

			if (area) {
				objeto.scaleToWidth(area.width * 0.8);
				objeto.set({
					left: area.left + area.width / 2,
					top: area.top + area.height / 2,
				});

				const clip = makeAreaClip(area);
				if (clip) objeto.clipPath = clip;
			} else {
				objeto.scaleToWidth(300);
				objeto.set({
					left: canvas.getWidth() / 2,
					top: canvas.getHeight() / 2,
				});
			}

			canvas.add(objeto);
			canvas.setActiveObject(objeto);
			canvas.requestRenderAll();
			setActiveObject(objeto);
		},
		[getCanvas, getEditableAreas, setActiveObject],
	);

	/**
	 * Traza la imagen y mete los TRAZOS en el lienzo, no la imagen.
	 *
	 * ES LO QUE SE VA A FABRICAR, y por eso entra ya convertida: el trazado no
	 * sale idéntico al original, y hacerlo al exportar significaría que alguien
	 * aprobó una cosa y recibió otra. Aquí se ve desde el primer momento lo que
	 * la máquina va a grabar.
	 *
	 * SE HACE UNA SOLA VEZ. Después es un grupo de trazos como cualquier otro
	 * objeto: mover, escalar y rotar no vuelven a pasar por VTracer.
	 */
	const vectorizarYColocar = useCallback(
		async (imagen: HTMLImageElement) => {
			setEstado({ fase: "vectorizando" });

			try {
				const { svg, sugerirMejorOriginal } = await vectorizar(imagen);

				const { objects } = await loadSVGFromString(svg);
				const trazos = objects.filter((o): o is FabricObject => !!o);

				if (trazos.length === 0) {
					throw new ErrorDeVectorizado(
						"vacio",
						"No encontramos formas que grabar en esa imagen.",
					);
				}

				/* Un grupo y no los trazos sueltos: la persona agregó UNA imagen y
				   espera moverla como una. Sueltos, arrastrar uno dejaría el diseño
				   descuadrado sin que nada avisara. */
				const grupo = new Group(trazos);

				colocar(grupo);
				setEstado(sugerirMejorOriginal ? { fase: "flojo" } : null);
			} catch (error) {
				const suyo = error instanceof ErrorDeVectorizado;

				/* NO SE CUELA EL PNG. Insertarlo "mientras tanto" daría un diseño que
				   se ve bien en pantalla y llega al taller como un archivo que no se
				   puede grabar; el fallo se descubriría con la pieza delante. */
				setEstado({
					fase: "fallo",
					mensaje: suyo
						? error.message
						: "No pudimos preparar esa imagen para grabado.",
					// Con otra imagen más simple sí puede salir; reintentar la misma no.
					puedeReintentar: !suyo || error.clase !== "complejo",
				});
			}
		},
		[colocar],
	);

	/**
	 * Mete una imagen ya cargada en el lienzo.
	 *
	 * Separado de `addImage` porque la fuente son DOS: un archivo del disco y
	 * una imagen de la biblioteca, que llega por URL. Lo que se hace con ella
	 * —escalar al área, recortar, seleccionar— es lo mismo en los dos casos.
	 */
	const ponerEnElLienzo = useCallback(
		(url: string) => {
			const canvas = getCanvas();
			if (!canvas) return;
			if (!guard.canAdd(1)) return;

			setUltima(url);

			const htmlImg = new Image();

			/* Sin esto, una imagen de la biblioteca CONTAMINA el lienzo y
			   `toDataURL` empieza a lanzar `SecurityError` al exportar el arte: el
			   pedido se queda sin archivo de producción. Va con `anonymous` y no
			   con credenciales porque `/medios/…` es público de lectura.

			   Las que vienen del disco son `data:` y esto no les afecta. Y en
			   grabado hace falta además para poder LEER los píxeles y trazarlos. */
			htmlImg.crossOrigin = "anonymous";
			htmlImg.src = url;

			htmlImg.onload = () => {
				if (esGrabado) {
					void vectorizarYColocar(htmlImg);
					return;
				}

				colocar(new FabricImage(htmlImg, {}));
				/* SE SUELTA LA COPIA EN CUANTO ENTRA. `ultima` sólo existe para el
				   botón de reintentar, y una foto de teléfono en base64 son varios
				   megas de cadena que se quedaban retenidos toda la sesión ADEMÁS
				   del mapa de bits que ya guarda el lienzo. Si salió bien no hay
				   nada que reintentar. */
				setUltima(null);
			};

			htmlImg.onerror = () => {
				setEstado({
					fase: "fallo",
					mensaje: "No pudimos abrir esa imagen.",
					puedeReintentar: true,
				});
			};
		},
		[getCanvas, guard, esGrabado, colocar, vectorizarYColocar],
	);

	const addImage = useCallback(
		(file: File) => {
			const reader = new FileReader();
			reader.onload = () => ponerEnElLienzo(reader.result as string);
			reader.readAsDataURL(file);
		},
		[ponerEnElLienzo],
	);

	/** Vuelve a intentarlo con la misma imagen. La guarda `ultima`, en memoria. */
	const reintentar = useCallback(() => {
		if (ultima) ponerEnElLienzo(ultima);
	}, [ultima, ponerEnElLienzo]);

	/** Descarta el fallo sin insertar nada. */
	const descartar = useCallback(() => setEstado(null), []);

	return {
		addImage,
		ponerEnElLienzo,
		/** Si el lado que se está diseñando se graba en vez de imprimirse. */
		esGrabado,
		estado,
		reintentar,
		descartar,
	};
}
