"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
	CAJA_MANGA,
	CAJA_PRENDA,
	LADOS_PLAYERA_3D,
	type MedidaPlayera,
	PLAYERA,
	type RectDeVista,
	relativoA,
} from "@/lib/prenda/mapeoPlayera";

const SIN_MEDIDAS: MedidaPlayera[] = [];

/** Las cuatro regiones del modelo. El cuerpo va proyectado de frente y cada
 *  manga de perfil, así que cada una necesita su propia textura. */
const REGIONES = [
	"frente",
	"espalda",
	"mangaIzqFuera",
	"mangaDerFuera",
] as const;
type Region = (typeof REGIONES)[number];

/* La cara de DENTRO de cada manga. No lleva textura con arte: si la llevara,
   el estampado daría la vuelta al tubo y se vería también por debajo del
   brazo, que es justo lo que no queremos. Va con tela lisa del color de la
   prenda. */
const FORROS = ["mangaIzqDentro", "mangaDerDentro"] as const;
type Forro = (typeof FORROS)[number];

/** Qué lado del editor pinta cada región. */
const LADO_DE: Record<Region, string> = {
	frente: "front",
	espalda: "back",
	mangaIzqFuera: "leftmanga",
	mangaDerFuera: "rightmanga",
};

type CajaDeManga = { anchoU: number; altoU: number };

type Parametros = {
	imagenes: Record<string, HTMLImageElement | null>;
	colocaciones: Record<string, RectDeVista & { giro?: number }>;
	color: string;
	/* Viajan CON el pintado y no se leen de la clausura del efecto de la
	   escena: ese efecto sólo se rehace al cambiar `miniatura`, así que unas
	   medidas nuevas del producto dimensionarían la manga con las viejas. */
	impresion: readonly MedidaPlayera[];
};

/* Dónde cae el centro del estampado a lo alto de la manga, de 0 (hombro) a 1
   (boca de la manga). La malla de manga empieza ARRIBA DEL TODO, en la costura
   del hombro, así que centrarlo en 0.5 lo dejaba pegado a la sisa. */
const CENTRO_MANGA = 0.44;

/**
 * Cuánto se AGRANDA el estampado de manga en la previsualización — y sólo ahí.
 *
 * NO cambia lo que se imprime ni lo que se cobra. Esos salen de `widthCm` del
 * producto, viajan al taller por su lado y no pasan por este archivo. Esto es
 * un ajuste de presentación pedido a propósito: a tamaño real el logo de manga
 * se lee demasiado pequeño en el modelo.
 *
 * Es decir: el 3D enseña la manga MÁS GRANDE de lo que se va a estampar. Si
 * alguna vez esta vista se usa para aprobar un arte o para discutir una
 * reclamación, esto tiene que volver a 1.
 */
const AUMENTO_MANGA = 1.45;

/**
 * Cuántos centímetros SUBE el estampado del pecho en la previsualización.
 *
 * Sólo el del frente: la espalda se queda donde la pone el área. Y sólo aquí,
 * como el aumento de la manga — el archivo que va al taller no lo toca.
 *
 * En centímetros y no en una fracción del lienzo a propósito: así se puede
 * razonar («súbelo dos dedos») sin tener que saber cuánto mide el lienzo.
 */
const SUBIR_FRENTE_CM = 6;

type MallasDePlayera = {
	geometrias: Record<Region | Forro, THREE.BufferGeometry>;
	/** Cuánto mide en centímetros una unidad del modelo. */
	cmPorUnidad: number;
	/** Hasta dónde llega la parte del cuerpo bien texturizada, en el lienzo. */
	cuerpo: { u0: number; u1: number };
	/** Cuánto mundo abarca la textura de cada manga, para poder dibujar el
	 *  estampado a su tamaño real en vez de a ojo. */
	mangas: Record<"mangaIzqFuera" | "mangaDerFuera", CajaDeManga>;
};

/**
 * El modelo, descargado UNA VEZ por pestaña.
 *
 * En la previsualización hay dos instancias a la vez —la grande y la miniatura
 * de la tira—, y cada una monta su propio renderer. Sin esta caché se bajarían
 * y se parsearían 300 KB dos veces para dibujar la misma prenda.
 *
 * Se devuelven las geometrías ORIGINALES y cada instancia se queda con un
 * `clone()`: al desmontarse, la limpieza recorre su escena y llama a
 * `dispose()` sobre lo que encuentra. Si compartieran el búfer, cerrar la
 * miniatura dejaría la vista grande sin malla y sin ningún error que lo
 * explicara.
 */
let mallas: Promise<MallasDePlayera> | null = null;

function cargarPlayera() {
	if (!mallas) {
		mallas = new GLTFLoader()
			.loadAsync("/modelos/playera.glb")
			.then((gltf) => {
				const busca = (nombre: string) => {
					const nodo = gltf.scene.getObjectByName(nombre);
					if (!(nodo instanceof THREE.Mesh))
						throw new Error(`el modelo no trae la malla «${nombre}»`);
					return nodo.geometry as THREE.BufferGeometry;
				};
				const geometrias = Object.fromEntries(
					[...REGIONES, ...FORROS].map((r) => [r, busca(r)]),
				) as Record<Region | Forro, THREE.BufferGeometry>;
				/* Las medidas viajan en el GLB —`scenes[0].extras`, que three
				   deja en `userData`— y no como constantes aquí: cambiar de
				   modelo no debe obligar a recalibrar el estampado a mano. */
				const extras = gltf.scene.userData as Partial<MallasDePlayera>;
				if (!extras?.cmPorUnidad || !extras.mangas || !extras.cuerpo)
					throw new Error("el modelo no trae sus medidas");
				return {
					geometrias,
					cmPorUnidad: extras.cmPorUnidad,
					cuerpo: extras.cuerpo,
					mangas: extras.mangas,
				};
			})
			.catch((error) => {
				// Se suelta la promesa fallida: si no, un corte de red deja la
				// playera rota para el resto de la sesión aunque vuelva la señal.
				mallas = null;
				throw error;
			});
	}
	return mallas;
}

type Props = {
	artes: Record<string, string | null>;
	areas: Record<string, RectDeVista>;
	medidas?: MedidaPlayera[];
	hex?: string | null;
	miniatura?: boolean;
	zoom?: number;
	ladoInicial?: string;
};

/** Preview únicamente. La talla, caída de la tela y confección siguen siendo
 * de referencia; no sustituye las medidas ni los archivos para fabricación. */
export default function Playera3D({
	artes,
	areas,
	medidas = SIN_MEDIDAS,
	hex,
	miniatura = false,
	zoom = 1,
	ladoInicial = "front",
}: Props) {
	const host = useRef<HTMLDivElement>(null);
	const inicial = useRef(ladoInicial);
	const [error, setError] = useState(false);
	const [cargando, setCargando] = useState(true);
	const [modeloListo, setModeloListo] = useState(false);
	const api = useRef<{
		zoom: (v: number) => void;
		girar: (v: number) => void;
		ver: (espalda: boolean) => void;
		pintar: (p: Parametros) => void;
	} | null>(null);
	const cache = useRef(new Map<string, Promise<HTMLImageElement>>());

	useEffect(() => {
		const root = host.current;
		if (!root) return;
		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({
				alpha: true,
				antialias: !miniatura,
			});
		} catch {
			// WebGL es un recurso externo: propagar su fallo de creación al fallback.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setError(true);
			setCargando(false);
			return;
		}
		/* En el teléfono se recorta a la mitad. Es donde pasa el reinicio —hay
		   mucha menos memoria y el navegador mata la pestaña sin avisar— y es
		   también donde menos se nota, porque la pantalla es pequeña. */
		const enMovil = window.matchMedia("(max-width: 768px)").matches;
		let alive = true,
			frame = 0;
		renderer.setPixelRatio(
			Math.min(window.devicePixelRatio || 1, miniatura ? 1 : 2),
		);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		/* SIN MAPEO DE TONO. ACES comprime el rango alto: un blanco puro entraba
		   en 1.0 y salía por 0.8, así que la prenda NUNCA podía verse blanca por
		   mucha luz que se le echara —se veía gris—. Sin mapeo, lo que está a
		   plena luz sale a 255 y la forma la siguen dibujando las zonas que
		   reciben menos. */
		renderer.toneMapping = THREE.NoToneMapping;
		renderer.domElement.style.cssText =
			"width:100%;height:100%;display:block;touch-action:none";
		root.appendChild(renderer.domElement);
		const scene = new THREE.Scene();
		const camera = new THREE.OrthographicCamera(-0.8, 0.8, 0.7, -0.7, 0.01, 10);
		camera.position.set(0, 0, inicial.current === "back" ? -2 : 2);
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.target.set(0, -0.015, 0);
		controls.enablePan = false;
		controls.enabled = !miniatura;
		controls.enableDamping = true;
		controls.dampingFactor = 0.12;
		controls.minZoom = 0.5;
		controls.maxZoom = 4;
		controls.minPolarAngle = 0.2;
		controls.maxPolarAngle = Math.PI - 0.2;
		const render = () => {
			frame = 0;
			if (!alive) return;
			controls.update();
			renderer.render(scene, camera);
		};
		const invalidate = () => {
			if (alive && !frame) frame = requestAnimationFrame(render);
		};
		controls.addEventListener("change", invalidate);
		const resize = () => {
			const { width, height } = root.getBoundingClientRect();
			if (!width || !height) return;
			renderer.setSize(width, height, false);
			const aspect = width / height;
			const h = Math.max(1.1, 1.3 / aspect);
			camera.left = (-h * aspect) / 2;
			camera.right = (h * aspect) / 2;
			camera.top = h / 2;
			camera.bottom = -h / 2;
			camera.updateProjectionMatrix();
			invalidate();
		};
		const observer = new ResizeObserver(resize);
		observer.observe(root);
		/* LUZ NEUTRA Y SIN TINTE. La clave era cálida (0xfff6e9) y el relleno
		   frío (0xdfe6f2): sobre una prenda blanca eso se ve como una camisa
		   crema por un lado y azulada por el otro. Ahora todas son blancas y lo
		   único que cambia entre ellas es de dónde vienen.

		   Los valores están ajustados MIDIENDO el render, no a ojo. Y la clave
		   es FLOJA a propósito: con ella fuerte el pecho se saturaba a 255 en
		   bloque y la prenda encandilaba —se perdían los pliegues justo en la
		   cara que más se mira—. Ahora manda la hemisférica, que ilumina
		   parejo, y las direccionales sólo dibujan el volumen. */
		scene.add(new THREE.HemisphereLight(0xffffff, 0xf0eee8, 2.55));
		const key = new THREE.DirectionalLight(0xffffff, 0.6);
		key.position.set(-1.1, 1.9, 2.4);
		scene.add(key);
		/* Relleno flojo del lado opuesto: separa el costado en sombra del fondo
		   sin borrar el modelado. */
		const relleno = new THREE.DirectionalLight(0xffffff, 0.45);
		relleno.position.set(2.2, 0.2, 1.4);
		scene.add(relleno);
		/* Contraluz: dibuja el canto del hombro y de las mangas, que es lo que
		   hace que se lea como un cuerpo y no como una silueta recortada. */
		const contra = new THREE.DirectionalLight(0xffffff, 0.5);
		contra.position.set(0.6, 1.1, -2.6);
		scene.add(contra);
		/* LOS LIENZOS SE CREAN CUANDO LLEGA EL MODELO. El de cada manga tiene la
		   proporción de ESA manga —fondo contra alto, que no es la de la
		   prenda—, y eso viaja en el GLB. Un `pintar()` que ocurra mientras se
		   descarga se guarda y se reproduce al montar, así que nada se pierde
		   por llegar antes. */
		const lienzos = new Map<
			Region,
			{ canvas: HTMLCanvasElement; textura: THREE.CanvasTexture }
		>();
		/* Un solo material para las dos caras de dentro: no llevan arte, sólo el
		   color de la prenda, así que compartirlo ahorra una textura por manga. */
		const forro = new THREE.MeshStandardMaterial({
			color: "#ffffff",
			roughness: 0.98,
			side: THREE.DoubleSide,
		});
		let medidas3D: MallasDePlayera | null = null;
		let ultimoPintado: Parametros | null = null;

		const aplicar = () => {
			if (!medidas3D || !ultimoPintado) return;
			const { imagenes, colocaciones, color, impresion } = ultimoPintado;
			for (const region of REGIONES) {
				const hoja = lienzos.get(region);
				if (!hoja) continue;
				const { canvas, textura } = hoja;
				const ctx = canvas.getContext("2d");
				if (!ctx) continue;
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.fillStyle = color;
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				const lado = LADO_DE[region];
				const imagen = imagenes[lado];
				const area = colocaciones[lado];
				if (imagen && area) {
					const esManga =
						region === "mangaIzqFuera" || region === "mangaDerFuera";
					/* El área llega normalizada al MOCKUP ENTERO, y el modelo está
					   escalado a su propio contorno: la prenda ocupa el 79 % del ancho
					   del dibujo, así que sin referirla antes a la caja que le toca el
					   arte salía pequeño y corrido. */
					const r = relativoA(
						area,
						esManga
							? CAJA_MANGA[
									region === "mangaIzqFuera" ? "leftmanga" : "rightmanga"
								]
							: CAJA_PRENDA,
					);
					if (!esManga) {
						/* El lienzo del cuerpo abarca el alto de la prenda, así que
						   los centímetros se pasan a fracción con esa medida. Arriba
						   es restar: el borde de arriba del lienzo es el cuello. */
						const subir =
							region === "frente"
								? SUBIR_FRENTE_CM /
									(PLAYERA.alto * medidas3D.cmPorUnidad)
								: 0;
						/* RECORTADO AL CUERPO. Si el área de impresión se sale de la
						   zona bien texturizada —pasa cuando no está centrada en el
						   mockup—, el borde del arte cae en triángulos que giran casi
						   de canto y se estira en una cuña de color sobre la manga.
						   Sin borde que estirar, no hay cuña. */
						ctx.save();
						ctx.beginPath();
						ctx.rect(
							medidas3D.cuerpo.u0 * canvas.width,
							0,
							(medidas3D.cuerpo.u1 - medidas3D.cuerpo.u0) * canvas.width,
							canvas.height,
						);
						ctx.clip();
						ctx.drawImage(
							imagen,
							r.left * canvas.width,
							(r.top - subir) * canvas.height,
							r.width * canvas.width,
							r.height * canvas.height,
						);
						ctx.restore();
					} else {
						/* LA MANGA NO PUEDE COPIAR LA POSICIÓN DEL MOCKUP, y no es por
						   pereza: ahí la manga está TENDIDA DE LADO, así que su eje
						   horizontal es a lo largo del brazo y el vertical es la vuelta
						   al tubo. En el modelo es justo al revés. Copiar los dos ejes
						   dejaba el logo de pie y pegado a la sisa.

						   Lo que sí se conserva es el TAMAÑO —la misma fracción del
						   ancho de la manga que en el dibujo— y la forma del arte. La
						   posición es la del estampado de manga de verdad: centrado en
						   la cara exterior. */
						/* EL TAMAÑO SALE DE LOS CENTÍMETROS, no del mockup. Ahí el
						   ancho del área es a lo LARGO DEL BRAZO, y aquí se aplica al
						   fondo de la manga: son magnitudes distintas, y usar una por
						   la otra sacaba el estampado del doble de grande. Con los
						   centímetros de impresión contra los centímetros que mide la
						   manga en el modelo, 7 cm de logo ocupan 7 cm de manga.

						   Si el producto no declara medidas se cae a la fracción del
						   dibujo: peor, pero mejor que no pintar nada. */
						const caja = medidas3D.mangas[region];
						const anchoMangaCm = caja.anchoU * medidas3D.cmPorUnidad;
						const cm = impresion.find((m) => m.sideKey === lado);
						const fraccion =
							(cm?.widthCm && cm.widthCm > 0 && anchoMangaCm > 0
								? cm.widthCm / anchoMangaCm
								: r.width) * AUMENTO_MANGA;
						const w = fraccion * canvas.width;
						const proporcion =
							imagen.naturalWidth / imagen.naturalHeight || 1;
						const h = w / proporcion;
						ctx.drawImage(
							imagen,
							(canvas.width - w) / 2,
							(canvas.height - h) * CENTRO_MANGA,
							w,
							h,
						);
					}
				}
				textura.needsUpdate = true;
			}
			forro.color.set(color);
			invalidate();
		};

		cargarPlayera().then(
			(modelo) => {
				if (!alive) return;
				medidas3D = modelo;
				for (const region of REGIONES) {
					const esManga =
						region === "mangaIzqFuera" || region === "mangaDerFuera";
					/* La proporción sale de la región: el cuerpo de la prenda, la
					   manga de su propia caja. */
					const rel = esManga
						? modelo.mangas[region].altoU / modelo.mangas[region].anchoU
						: PLAYERA.alto / PLAYERA.ancho;
					const canvas = document.createElement("canvas");
					/* POR PÍXELES TOTALES, NO POR ANCHO FIJO. Con el ancho clavado en
					   2048 el lienzo lo decidía la PROPORCIÓN de la región, y la de
					   una manga es alta y estrecha: salían de 2048×3072 —24 MB— para
					   pintar un logo de 9 cm. Medido: el estampado de manga recibía
					   493 DPI y el del pecho 63. Ocho veces más resolución en lo que
					   menos se mira.

					   Los cuatro lienzos sumaban 76 MB, y otro tanto al subirlos a la
					   GPU. En un teléfono eso se lleva la pestaña por delante: el
					   navegador la mata y vuelve a cargar, que es el "se reinicia
					   solo" del editor. */
					const presupuesto = (esManga ? 6e5 : 3.9e6) * (enMovil ? 0.5 : 1);
					canvas.width = miniatura
						? 512
						: Math.round(Math.sqrt(presupuesto / rel));
					canvas.height = Math.round(canvas.width * rel);
					const ctx = canvas.getContext("2d");
					if (ctx) {
						/* Blanco puro: la prenda en crudo es #fff, no un hueso. El
						   tono de marca viste la interfaz, nunca la tela. */
						ctx.fillStyle = "#ffffff";
						ctx.fillRect(0, 0, canvas.width, canvas.height);
					}
					const textura = new THREE.CanvasTexture(canvas);
					textura.colorSpace = THREE.SRGBColorSpace;
					textura.anisotropy = Math.min(
						8,
						renderer.capabilities.getMaxAnisotropy(),
					);
					lienzos.set(region, { canvas, textura });
					scene.add(
						new THREE.Mesh(
							modelo.geometrias[region].clone(),
							/* DOS CARAS. La tela de Marvelous es una superficie de una
							   sola capa, no un sólido cerrado: con descarte de caras
							   traseras se vería el interior de la espalda a través del
							   pecho. */
							new THREE.MeshStandardMaterial({
								map: textura,
								roughness: 0.98,
								side: THREE.DoubleSide,
							}),
						),
					);
				}
				for (const dentro of FORROS)
					scene.add(new THREE.Mesh(modelo.geometrias[dentro].clone(), forro));
				setModeloListo(true);
				aplicar();
				invalidate();
			},
			() => {
				if (alive) setError(true);
			},
		);
		api.current = {
			zoom: (v) => {
				camera.zoom = Math.max(0.5, Math.min(4, v));
				camera.updateProjectionMatrix();
				invalidate();
			},
			girar: (v) => {
				const offset = camera.position
					.clone()
					.sub(controls.target)
					.applyAxisAngle(new THREE.Vector3(0, 1, 0), v);
				camera.position.copy(controls.target).add(offset);
				controls.update();
				invalidate();
			},
			ver: (espalda) => {
				camera.position.set(0, controls.target.y, espalda ? -2 : 2);
				controls.update();
				invalidate();
			},
			/* `pintar` ya no dibuja: apunta lo último que se pidió y deja que
			   `aplicar` lo reparta por las cuatro texturas. Así una petición que
			   llegue antes que el modelo no se pierde. */
			pintar: (p) => {
				ultimoPintado = p;
				aplicar();
			},
		};
		const lost = (event: Event) => {
			event.preventDefault();
			if (alive) setError(true);
		};
		renderer.domElement.addEventListener("webglcontextlost", lost);
		resize();
		controls.update();
		return () => {
			alive = false;
			api.current = null;
			cancelAnimationFrame(frame);
			observer.disconnect();
			controls.dispose();
			renderer.domElement.removeEventListener("webglcontextlost", lost);
			const materials = new Set<THREE.Material>();
			scene.traverse((o) => {
				if (o instanceof THREE.Mesh) {
					o.geometry.dispose();
					[o.material].flat().forEach((m) => materials.add(m));
				}
			});
			materials.forEach((m) => m.dispose());
			// Las texturas viven en el mapa aunque el modelo no llegara a montarse.
			lienzos.forEach(({ textura }) => textura.dispose());
			forro.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
			renderer.domElement.remove();
		};
	}, [miniatura]);

	useEffect(() => {
		api.current?.zoom(zoom);
	}, [zoom, miniatura]);
	useEffect(() => {
		let alive = true;
		const color = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex ?? "")
			? hex!
			: "#ffffff";
		const cargar = (src: string) => {
			let promise = cache.current.get(src);
			if (!promise) {
				promise = new Promise<HTMLImageElement>((resolve, reject) => {
					const image = new Image();
					image.onload = () => resolve(image);
					image.onerror = () => reject(new Error("arte"));
					image.src = src;
				});
				cache.current.set(src, promise);
			}
			return promise;
		};
		Promise.all(
			LADOS_PLAYERA_3D.map(async (side) => {
				const src = artes[side];
				return [side, src ? await cargar(src) : null] as const;
			}),
		)
			.then((entries) => {
				if (!alive) return;
				/* Sólo el cuerpo necesita colocación: la manga ya no se dibuja
				   dentro del lienzo del frente, sino en el suyo, y ahí el tamaño
				   sale de los centímetros de impresión contra los centímetros que
				   mide la manga en el modelo. */
				const colocaciones: Record<string, RectDeVista & { giro?: number }> =
					{ ...areas };
				// Sin colocación válida no se ignora silenciosamente un diseño.
				const faltan = entries.some(
					([side, image]) =>
						image &&
						(side === "front" || side === "back") &&
						!colocaciones[side],
				);
				if (faltan) {
					setError(true);
					setCargando(false);
					return;
				}
				api.current?.pintar({
					imagenes: Object.fromEntries(entries),
					colocaciones,
					color,
					impresion: medidas,
				});
				setCargando(false);
			})
			.catch(() => {
				if (alive) {
					setError(true);
					setCargando(false);
				}
			});
		return () => {
			alive = false;
		};
	}, [artes, areas, hex, miniatura, medidas]);

	return (
		<div
			className={`relative w-full ${miniatura ? "aspect-square pointer-events-none" : "h-full min-h-[220px]"}`}
		>
			<div
				ref={host}
				className="absolute inset-0"
				role={miniatura ? undefined : "img"}
				aria-label={
					miniatura
						? undefined
						: "Vista 3D de tu diseño en una playera. Arrastra para girar."
				}
			/>
			{/* La malla cuenta como parte de la carga: el arte puede terminar de
			    cargarse antes que los 300 KB del modelo, y apagar el aviso ahí
			    dejaría una escena vacía que parece un fallo. */}
			{(cargando || !modeloListo) && !miniatura && !error && (
				<p
					role="status"
					className="absolute inset-x-0 top-3 text-center text-sm text-tinta/55"
				>
					Preparando tu playera…
				</p>
			)}
			{error && (
				<div
					role="status"
					className="absolute inset-0 flex items-center justify-center bg-hueso-suave p-4 text-center text-xs text-tinta/60"
				>
					{miniatura
						? "3D"
						: "No se pudo preparar el modelo con tu diseño. Puedes usar las imágenes del producto."}
				</div>
			)}
			{!miniatura && !error && (
				<div className="absolute inset-x-0 bottom-5 flex flex-col items-center gap-2 md:bottom-16">
					<div className="flex gap-1 rounded-full border border-tinta/10 bg-white/95 p-1 shadow-sm">
						<button
							type="button"
							aria-label="Girar playera a la izquierda"
							className="h-9 w-10 rounded-full hover:bg-gris"
							onClick={() => api.current?.girar(-Math.PI / 6)}
						>
							↶
						</button>
						<button
							type="button"
							className="rounded-full px-3 text-xs hover:bg-gris"
							onClick={() => api.current?.ver(false)}
						>
							Frente
						</button>
						<button
							type="button"
							className="rounded-full px-3 text-xs hover:bg-gris"
							onClick={() => api.current?.ver(true)}
						>
							Espalda
						</button>
						<button
							type="button"
							aria-label="Girar playera a la derecha"
							className="h-9 w-10 rounded-full hover:bg-gris"
							onClick={() => api.current?.girar(Math.PI / 6)}
						>
							↷
						</button>
					</div>
					<p className="text-[11px] text-tinta/50">
						Arrastra para girar · Desliza para acercar
					</p>
				</div>
			)}
		</div>
	);
}
