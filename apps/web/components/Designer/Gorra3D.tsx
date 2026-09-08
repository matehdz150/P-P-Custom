"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import type { ReferenciaGorra } from "@/lib/prenda/mapeoGorra";
import type { MedidaPlayera } from "@/lib/prenda/mapeoPlayera";

/**
 * La gorra, con el paquete optimizado para navegador tal y como viene.
 *
 * QUÉ ES. `public/gorra/` es la entrega «Gorra_ThreeJS»: GLB con geometría
 * Draco y un atlas de normales horneado (775 KB, 51 962 triángulos frente a
 * los 230 264 del original), más el HDR del estudio con el que se calibró. Se
 * monta como pide su documentación —AgX, entorno al 8 %, sus tres luces de
 * área— porque la tela usa `KHR_materials_sheen`: con otra iluminación deja de
 * parecer sarga de algodón.
 *
 * QUÉ SE PERDIÓ POR EL CAMINO, y por qué no importa. El modelo anterior venía
 * partido en dos mallas —`frente` y `resto`— y traía en `extras` la caja UV
 * del panel delantero, todo producido por `scripts/convertir-gorra.mjs`. El
 * paquete nuevo viene en una sola malla de cuatro primitivas por material, así
 * que esa partición ya no existe y el panel SE DERIVA de la geometría: se
 * eligen los triángulos que miran al frente por encima de la visera.
 *
 * TAMBIÉN SE FUE LA VÍA CALIBRADA CON FOTO (`proyectarGorra`, `uvDeGorra`,
 * `REGISTRO_GORRA`). Estaba escrita contra la geometría anterior y ninguna
 * gorra del catálogo tiene foto real, así que nunca llegaba a ejecutarse: el
 * único camino vivo era el respaldo. Mantenerla apuntando a una malla que ya
 * no existe habría sido peor que quitarla.
 */

/** Dónde vive el paquete de la gorra dentro de `public/`. */
const BASE = "/gorra/";

/** La tela de la copa: es la que se tiñe y sobre la que va el diseño. */
const MATERIAL_TELA = "01 · Sarga blanca de algodon";

/** El ángulo de cámara del paquete, para que se vea como en su propio visor. */
const CAMPO_VISUAL = 25.36;

/** Qué fracción del alto del marco ocupa la gorra; el resto es aire para
 *  poder girarla sin que se salga. */
const OCUPACION = 0.82;

/* ─────────────────────────────────────────────────────────────────────────
   DÓNDE CAE EL DISEÑO · perillas para ajustar a mano

   De salida el arte se centra en el panel delantero y se escala a lo que
   quepa conservando su proporción. Cambia un número, guarda, y en «Probar»
   se ve al momento. Son constantes y no una interfaz porque es una
   calibración que se hace una vez contra las fotos reales del producto,
   igual que en el termo.
   ───────────────────────────────────────────────────────────────────────── */

/** Sube (+) o baja (−) el diseño sobre el panel, en centímetros reales. */
const SUBIR_CM = -1;

/** Corre el diseño de lado, en centímetros. Positivo lo mueve a la DERECHA de
 *  quien mira; negativo, a la izquierda. */
const CORRER_CM = 0;

/**
 * Agranda (>1) o encoge (<1) el diseño.
 *
 * 1 es el área declarada del producto —hoy 9 × 5 cm—, que es lo que se
 * estampa de verdad. Por encima de ~1.5 el arte se sale del panel y empieza a
 * montarse sobre la curva de la copa.
 */
const ESCALA = 1.5;

/**
 * Dónde acaba la visera y empieza la copa, como fracción del alto del modelo.
 *
 * La visera también mira al frente, así que sin este corte el arte se
 * derramaría sobre ella. Se mide desde abajo: 0.5 es la mitad del modelo.
 */
const CORTE_VISERA = 0.25;

/** Cuánto tiene que mirar al frente un triángulo para contar como panel. */
const FRENTE_MINIMO = 0.35;

/**
 * Exposición y luz de entorno.
 *
 * El paquete pide exposición 1 y entorno al 8 %, y así se ve en SU visor, que
 * tiene fondo propio. Aquí la gorra va sobre el hueso del editor y con esos
 * valores una gorra BLANCA salía gris apagada, sin parecerse a las fotos del
 * producto. Es lo único que se cambia de su montaje, y se cambia porque el
 * contexto es otro.
 */
const EXPOSICION = 1.55;
const LUZ_AMBIENTE = 0.9;

let promesa: Promise<{ escena: THREE.Group; hdr: THREE.DataTexture }> | null =
	null;

function cargarPaquete() {
	if (promesa) return promesa;
	const draco = new DRACOLoader().setDecoderPath(`${BASE}vendor/draco/`);
	draco.setWorkerLimit(2);
	promesa = Promise.all([
		new GLTFLoader()
			.setDRACOLoader(draco)
			.loadAsync(`${BASE}assets/gorra_web.glb`),
		new HDRLoader().loadAsync(`${BASE}assets/estudio.hdr`),
	])
		.then(([gltf, hdr]) => {
			draco.dispose();
			hdr.mapping = THREE.EquirectangularReflectionMapping;
			return { escena: gltf.scene, hdr };
		})
		.catch((error) => {
			draco.dispose();
			/* Un fallo de red no puede dejar la promesa cacheada para siempre. */
			promesa = null;
			throw error;
		});
	return promesa;
}

/**
 * El estudio del paquete, tal cual.
 *
 * Las posiciones llegan en el sistema de Blender y en centímetros; la
 * conversión (x, y, z) → (x·0,01, z·0,01, −y·0,01) es la suya. No se retocan
 * los valores: están calibrados contra el render original.
 */
function montarEstudio() {
	RectAreaLightUniformsLib.init();
	const grupo = new THREE.Group();
	grupo.name = "Estudio de la gorra";
	const softbox = (
		pos: [number, number, number],
		potencia: number,
		ancho: number,
		alto: number,
		color: [number, number, number],
		mira: [number, number, number] = [0, -2, 5],
	) => {
		const luz = new THREE.RectAreaLight(
			new THREE.Color(...color),
			(0.6 * potencia) / (Math.PI * ancho * alto),
			ancho * 0.01,
			alto * 0.01,
		);
		luz.position.set(pos[0] * 0.01, pos[2] * 0.01, -pos[1] * 0.01);
		luz.lookAt(mira[0] * 0.01, mira[2] * 0.01, -mira[1] * 0.01);
		grupo.add(luz);
	};
	softbox([-16, -20, 29], 18000, 16, 20, [1, 0.96, 0.92]);
	softbox([18, -12, 18], 9000, 14, 17, [0.88, 0.94, 1]);
	softbox([2, 14, 24], 13000, 13, 16, [1, 1, 1]);
	return grupo;
}

/**
 * El panel delantero, derivado de la geometría.
 *
 * SE ELIGEN TRIÁNGULOS, no vértices: un vértice del borde pertenece a caras
 * que miran a sitios distintos, y quedarse con él por una sola de ellas
 * dejaba dientes en el borde del panel.
 *
 * La visera también mira al frente, de ahí el corte por altura. Y la UV se
 * proyecta en plano sobre (x, y) porque el arte de una gorra se manda plano:
 * es la misma regla que en el pecho de la playera.
 */
function derivarPanel(mallas: THREE.Mesh[], cajaModelo: THREE.Box3) {
	const corte =
		cajaModelo.min.y + (cajaModelo.max.y - cajaModelo.min.y) * CORTE_VISERA;

	const v = new THREE.Vector3();
	const n = new THREE.Vector3();
	const P: number[] = [];
	const N: number[] = [];
	const I: number[] = [];
	const caja = new THREE.Box3();

	/* SE RECORREN TODAS LAS MALLAS, no sólo la de la sarga.

	   Con una sola, el diseño salía partido por una banda horizontal: el frente
	   de la copa no es de un solo material —hay costura y detalles— y esos
	   triángulos quedaban fuera del panel, dejando un hueco justo por donde
	   pasaba el texto. Un estampado va por encima de la costura igual que por
	   encima de la tela. */
	for (const malla of mallas) {
		const geo = malla.geometry;
		const pos = geo.getAttribute("position");
		const nor = geo.getAttribute("normal");
		if (!pos || !nor) continue;
		const indice = geo.getIndex();
		const alMundo = malla.matrixWorld;
		const normalAlMundo = new THREE.Matrix3().getNormalMatrix(alMundo);
		const cuenta = indice ? indice.count : pos.count;
		const mapa = new Map<number, number>();

		for (let t = 0; t < cuenta; t += 3) {
			const abc = [0, 1, 2].map((k) => (indice ? indice.getX(t + k) : t + k));
			let ny = 0;
			let nz = 0;
			let dentro = true;
			for (const i of abc) {
				v.fromBufferAttribute(pos, i).applyMatrix4(alMundo);
				n.fromBufferAttribute(nor, i).applyMatrix3(normalAlMundo).normalize();
				ny += n.y / 3;
				nz += n.z / 3;
				if (v.y < corte) dentro = false;
			}
			/* Mira al frente y no es la cara de arriba de la visera. */
			if (!dentro || nz < FRENTE_MINIMO || ny > 0.75) continue;

			for (const i of abc) {
				let j = mapa.get(i);
				if (j === undefined) {
					j = P.length / 3;
					mapa.set(i, j);
					v.fromBufferAttribute(pos, i).applyMatrix4(alMundo);
					n.fromBufferAttribute(nor, i).applyMatrix3(normalAlMundo).normalize();
					/* Separado un pelo por la normal: si comparte plano con la copa,
					   la tarjeta gráfica decide cuál pinta y salen manchas.
					
					   MUY POCO, y de eso ya se encarga sobre todo el `polygonOffset`
					   del material. Con 0,6 mm se abría una muesca en la costura
					   central: ahí los vértices están duplicados con normales que
					   divergen, y separarlos tanto partía el texto en dos. */
					P.push(v.x + n.x * 0.0002, v.y + n.y * 0.0002, v.z + n.z * 0.0002);
					N.push(n.x, n.y, n.z);
					caja.expandByPoint(v);
				}
				I.push(j);
			}
		}
	}
	if (I.length < 3) return null;

	const geometria = new THREE.BufferGeometry();
	geometria.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
	geometria.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
	geometria.setIndex(I);
	return { geometria, caja };
}

type Props = {
	/** Sólo se usa `front`: es el único lado imprimible de una gorra. */
	artes: Record<string, string | null>;
	medidas?: MedidaPlayera[];
	/** Se acepta por compatibilidad; el modelo nuevo no usa la vía con foto. */
	referencia?: ReferenciaGorra;
	hex?: string | null;
	miniatura?: boolean;
	zoom?: number;
};

/** Preview únicamente. La forma, el ala y la caída son de referencia; no
 * sustituyen las medidas ni los archivos para bordar. */
export default function Gorra3D({
	artes,
	medidas,
	hex,
	miniatura = false,
	zoom = 1,
}: Props) {
	const host = useRef<HTMLDivElement>(null);
	const [error, setError] = useState(false);
	const [cargando, setCargando] = useState(true);
	const api = useRef<{
		rotate: (delta: number) => void;
		zoom: (value: number) => void;
		color: (value?: string | null) => void;
	} | null>(null);
	const arte = artes.front ?? null;
	const medidaFrente = medidas?.find((m) => m.sideKey === "front");

	// biome-ignore lint/correctness/useExhaustiveDependencies: el zoom sólo siembra el inicial; lo mueve el efecto de abajo
	useEffect(() => {
		const root = host.current;
		if (!root) return;
		let vigente = true;
		let frame = 0;
		let renderer: THREE.WebGLRenderer;
		setError(false);
		setCargando(true);
		try {
			renderer = new THREE.WebGLRenderer({
				antialias: !miniatura,
				alpha: true,
			});
		} catch {
			setError(true);
			setCargando(false);
			return;
		}
		renderer.setPixelRatio(
			Math.min(window.devicePixelRatio || 1, miniatura ? 1 : 2),
		);
		/* Gestión de color y mapeo de tonos TAL CUAL los pide el paquete. */
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.AgXToneMapping;
		renderer.toneMappingExposure = EXPOSICION;
		renderer.domElement.style.cssText =
			"width:100%;height:100%;display:block;touch-action:none";
		root.appendChild(renderer.domElement);

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(CAMPO_VISUAL, 1, 0.001, 10);
		camera.position.set(0, 0.12, 0.6);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enabled = !miniatura;
		controls.enablePan = false;
		controls.enableDamping = true;
		controls.dampingFactor = 0.12;
		controls.minPolarAngle = 0.35;
		controls.maxPolarAngle = Math.PI - 0.35;
		controls.update();

		const render = () => {
			frame = 0;
			if (!vigente) return;
			controls.update();
			renderer.render(scene, camera);
		};
		const invalidate = () => {
			if (vigente && !frame) frame = requestAnimationFrame(render);
		};
		controls.addEventListener("change", invalidate);
		const setZoom = (value: number) => {
			camera.zoom = Math.min(4, Math.max(0.5, value));
			camera.updateProjectionMatrix();
			invalidate();
		};

		const resize = () => {
			const { width, height } = root.getBoundingClientRect();
			if (!width || !height) return;
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			invalidate();
		};
		const observer = new ResizeObserver(resize);
		observer.observe(root);

		const texturas: THREE.Texture[] = [];
		const propias: THREE.Material[] = [];
		const geometrias: THREE.BufferGeometry[] = [];
		let entorno: THREE.WebGLRenderTarget | null = null;

		cargarPaquete()
			.then(({ escena, hdr }) => {
				if (!vigente) return;

				const pmrem = new THREE.PMREMGenerator(renderer);
				entorno = pmrem.fromEquirectangular(hdr);
				pmrem.dispose();
				scene.environment = entorno.texture;
				scene.environmentRotation.y = Math.PI / 2;
				scene.environmentIntensity = LUZ_AMBIENTE;
				scene.add(montarEstudio());

				const gorra = escena.clone(true);
				scene.add(gorra);
				gorra.updateWorldMatrix(true, true);

				/* Los materiales del GLB los comparten todas las instancias del
				   modelo cacheado: teñir el original pintaría también la miniatura
				   que esté montada al lado. */
				const telas: THREE.MeshPhysicalMaterial[] = [];
				const mallas: THREE.Mesh[] = [];
				const anisotropia = Math.min(
					8,
					renderer.capabilities.getMaxAnisotropy(),
				);
				gorra.traverse((objeto) => {
					if (!(objeto instanceof THREE.Mesh)) return;
					const original = objeto.material as THREE.Material | THREE.Material[];
					const copias = (Array.isArray(original) ? original : [original]).map(
						(m) => {
							const copia = m.clone() as THREE.MeshPhysicalMaterial;
							propias.push(copia);
							if (copia.normalMap) copia.normalMap.anisotropy = anisotropia;
							if (copia.name === MATERIAL_TELA) telas.push(copia);
							return copia;
						},
					);
					objeto.material = Array.isArray(original) ? copias : copias[0];
					mallas.push(objeto);
				});

				const tenir = (valor?: string | null) => {
					for (const m of telas) {
						/* Sin color declarado se respeta el blanco del paquete. */
						if (/^#[\da-f]{6}$/i.test(valor ?? ""))
							m.color.set(valor as string);
						else m.color.setRGB(0.76, 0.78, 0.8);
					}
					invalidate();
				};
				api.current = {
					rotate: (delta) => {
						const offset = camera.position.clone().sub(controls.target);
						offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
						camera.position.copy(controls.target).add(offset);
						controls.update();
						invalidate();
					},
					zoom: setZoom,
					color: tenir,
				};
				tenir(hex);

				/* Encuadre desde la CAJA, con el aspecto del lienzo.

				   Por alto solo no vale: eso funciona con el termo, que es alto y
				   estrecho, pero una gorra es al revés y se salía por los lados.
				   Y por la esfera envolvente tampoco: su radio es media diagonal
				   de la caja —casi el doble del semialto— y la gorra salía a un
				   cuarto del cuadro. Se ajusta la caja por los dos ejes y manda el
				   que pida más distancia.

				   El ancho se toma como el MAYOR entre ancho y fondo, para que al
				   girarla de perfil siga cabiendo sin recolocar la cámara. */
				const caja = new THREE.Box3().setFromObject(gorra);
				const alto = caja.max.y - caja.min.y;
				const anchoMax = Math.max(
					caja.max.x - caja.min.x,
					caja.max.z - caja.min.z,
				);
				const centroY = (caja.max.y + caja.min.y) / 2;
				const { width: anchoLienzo, height: altoLienzo } =
					root.getBoundingClientRect();
				const aspecto =
					altoLienzo > 0 ? Math.max(0.2, anchoLienzo / altoLienzo) : 1;
				const semiVertical = (CAMPO_VISUAL * Math.PI) / 360;
				const semiHorizontal = Math.atan(Math.tan(semiVertical) * aspecto);
				const distancia =
					Math.max(
						alto / 2 / Math.tan(semiVertical),
						anchoMax / 2 / Math.tan(semiHorizontal),
					) / OCUPACION;

				controls.target.set(0, centroY, 0);
				camera.position.set(0, centroY + alto * 0.08, distancia);
				controls.minDistance = distancia * 0.45;
				controls.maxDistance = distancia * 1.8;
				controls.update();

				setCargando(false);
				resize();
				setZoom(zoom);
				invalidate();

				if (!arte || mallas.length === 0) return;

				// ---- El panel del diseño ----------------------------------------
				const panel = derivarPanel(mallas, caja);
				if (!panel) return;
				geometrias.push(panel.geometria);

				const anchoPanel = panel.caja.max.x - panel.caja.min.x;
				const altoPanel = panel.caja.max.y - panel.caja.min.y;

				const lienzo = document.createElement("canvas");
				lienzo.width = miniatura ? 1024 : 2048;
				lienzo.height = miniatura ? 1024 : 2048;
				const ctx = lienzo.getContext("2d");
				if (!ctx) return;

				const img = new Image();
				img.onload = () => {
					if (!vigente) return;

					/* MANDA EL ÁREA DECLARADA, no el panel.
					
					   Escalar el arte hasta llenar el panel lo sacaba enorme: el
					   panel es toda la cara delantera de la copa y el área que se
					   estampa de verdad son 9 × 5 cm. El modelo viene en metros, así
					   que la conversión es dividir entre 100.
					
					   La proporción es la del raster, que el exportador conserva; si
					   pide más alto del declarado se reduce todo a la vez, porque
					   deformarlo sería enseñar algo que la máquina no va a hacer. */
					const CM = 100;
					const proporcion =
						img.naturalWidth > 0 && img.naturalHeight > 0
							? img.naturalWidth / img.naturalHeight
							: 1;
					let ancho = (medidaFrente?.widthCm ?? 9) / CM;
					let altoArte = ancho / proporcion;
					const altoDeclarado = (medidaFrente?.heightCm ?? 5) / CM;
					if (altoArte > altoDeclarado) {
						altoArte = altoDeclarado;
						ancho = altoArte * proporcion;
					}
					/* Y por si el área declarada no cupiera en el panel del modelo. */
					if (ancho > anchoPanel) {
						ancho = anchoPanel;
						altoArte = ancho / proporcion;
					}
					if (altoArte > altoPanel) {
						altoArte = altoPanel;
						ancho = altoArte * proporcion;
					}
					ancho *= ESCALA;
					altoArte *= ESCALA;

					const subir = SUBIR_CM / CM;
					const cx = (panel.caja.min.x + panel.caja.max.x) / 2 + CORRER_CM / CM;
					const cy = (panel.caja.min.y + panel.caja.max.y) / 2 + subir;

					/* UV plana sobre (x, y): el arte de una gorra se manda plano, y
					   es la misma regla que en el pecho de la playera. */
					const p = panel.geometria.getAttribute("position");
					const uv = new Float32Array(p.count * 2);
					for (let i = 0; i < p.count; i++) {
						uv[i * 2] = (p.getX(i) - (cx - ancho / 2)) / ancho;
						uv[i * 2 + 1] = (p.getY(i) - (cy - altoArte / 2)) / altoArte;
					}
					panel.geometria.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

					const textura = new THREE.CanvasTexture(lienzo);
					textura.colorSpace = THREE.SRGBColorSpace;
					textura.anisotropy = anisotropia;
					/* Fuera del arte no se pinta nada: con `Repeat` el diseño se
					   embaldosaba sobre la copa entera. */
					textura.wrapS = THREE.ClampToEdgeWrapping;
					textura.wrapT = THREE.ClampToEdgeWrapping;
					texturas.push(textura);

					/**
					 * EL DISEÑO SE PINTA CON SUS COLORES, SIN ILUMINAR.
					 *
					 * Estaba con un material físico, o sea recibiendo los focos y el
					 * entorno del estudio igual que la tela. Eso levanta un negro a
					 * gris: el texto salía descolorido y no se parecía al del editor
					 * ni al de las fotos del producto.
					 *
					 * `MeshBasicMaterial` toma el color tal cual de la textura, y
					 * `toneMapped = false` lo libra además del AgX, que desatura y
					 * levanta las sombras. El precio es que el estampado no coge el
					 * sombreado de la copa, pero enseñar el color equivocado es peor:
					 * el comprador está eligiendo un color.
					 *
					 * En el termo se hace AL REVÉS a propósito: allí el arte es un
					 * grabado láser sobre metal y tiene que reflejar el entorno para
					 * parecerlo.
					 */
					const material = new THREE.MeshBasicMaterial({
						map: textura,
						transparent: true,
						depthWrite: false,
						polygonOffset: true,
						polygonOffsetFactor: -1,
					});
					material.toneMapped = false;
					propias.push(material);
					scene.add(new THREE.Mesh(panel.geometria, material));

					/* El lienzo se deja TRANSPARENTE fuera del arte para que
					   `ClampToEdge` no arrastre el borde por todo el panel. */
					ctx.clearRect(0, 0, lienzo.width, lienzo.height);
					ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
					textura.needsUpdate = true;
					invalidate();
				};
				img.onerror = () => {
					if (vigente) invalidate();
				};
				img.crossOrigin = "anonymous";
				img.src = arte;
			})
			.catch(() => {
				if (!vigente) return;
				setError(true);
				setCargando(false);
			});

		const perdido = (evento: Event) => {
			evento.preventDefault();
			setError(true);
		};
		renderer.domElement.addEventListener("webglcontextlost", perdido);
		resize();

		return () => {
			vigente = false;
			api.current = null;
			cancelAnimationFrame(frame);
			observer.disconnect();
			controls.dispose();
			renderer.domElement.removeEventListener("webglcontextlost", perdido);
			/* Sólo se tira lo de ESTA instancia: las geometrías y el HDR del
			   paquete viven en la caché del módulo y los comparten las demás. */
			for (const m of propias) m.dispose();
			for (const g of geometrias) g.dispose();
			for (const t of texturas) t.dispose();
			entorno?.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
			renderer.domElement.remove();
		};
	}, [arte, miniatura, medidaFrente]);

	useEffect(() => {
		api.current?.color(hex);
	}, [hex]);

	useEffect(() => {
		api.current?.zoom(zoom);
	}, [zoom]);

	return (
		<div
			className={`relative w-full ${miniatura ? "pointer-events-none aspect-square" : "h-full min-h-[260px]"}`}
		>
			{miniatura ? (
				<div ref={host} className="absolute inset-0" aria-hidden="true" />
			) : (
				<div
					ref={host}
					className="absolute inset-0"
					role="img"
					aria-label="Vista 3D de tu diseño en la gorra. Arrastra para girar."
				/>
			)}
			{cargando && !error && !miniatura && (
				<output className="absolute inset-x-0 top-4 block text-center text-sm text-tinta/55">
					Preparando tu gorra…
				</output>
			)}
			{error && (
				<output className="absolute inset-0 flex items-center justify-center bg-hueso-suave p-3 text-center text-xs text-tinta/60">
					{miniatura
						? "3D"
						: "No se pudo cargar la vista 3D. Puedes seleccionar una de las imágenes del producto."}
				</output>
			)}
			{!miniatura && !error && (
				<div className="absolute inset-x-0 bottom-16 hidden flex-col items-center gap-2 md:flex">
					<div className="flex items-center gap-2 rounded-full border border-tinta/10 bg-white/90 p-1 shadow-sm">
						<button
							type="button"
							aria-label="Girar gorra a la izquierda"
							onClick={() => api.current?.rotate(-Math.PI / 6)}
							className="rounded-full px-3 py-2 text-sm hover:bg-gris"
						>
							↶
						</button>
						<button
							type="button"
							aria-label="Girar gorra a la derecha"
							onClick={() => api.current?.rotate(Math.PI / 6)}
							className="rounded-full px-3 py-2 text-sm hover:bg-gris"
						>
							↷
						</button>
					</div>
					<p className="text-center text-xs text-tinta/50">
						Arrastra para girar · Desliza para acercar
					</p>
				</div>
			)}
		</div>
	);
}
