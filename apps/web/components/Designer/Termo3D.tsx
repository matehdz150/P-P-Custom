"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

type Props = {
	arte?: string | null;
	hex?: string | null;
	miniatura?: boolean;
	zoom?: number;
	anchoCm?: number;
	/**
	 * Se acepta por simetría con la taza, pero NO se usa para colocar el arte:
	 * manda la proporción del raster, que el exportador conserva de verdad. Los
	 * centímetros declarados del producto pueden ser los de por defecto del
	 * alta —«Termo negro» dice 28 × 35 cm, imposible en un termo de 24 cm— y
	 * fiarse de ellos deforma el diseño.
	 */
	altoCm?: number;
	centro?: number;
};

/**
 * El termo, con el paquete optimizado para navegador tal y como viene.
 *
 * QUÉ ES. `public/termo/` es la entrega «Termo_ThreeJS»: GLB con geometría
 * Draco y un atlas de normales horneado (408 KB, 23 700 triángulos frente a
 * los 238 432 del original de Blender), más el HDR del estudio con el que se
 * calibró. Se monta como pide su documentación —mapeo de tonos AgX, el
 * entorno al 8 %, y sus cinco luces de área— porque los materiales de la tapa
 * usan transmisión y volumen: con otra iluminación dejan de parecer
 * policarbonato y se ven como plástico lechoso.
 *
 * NO SE RETOCAN SUS NÚMEROS. Las potencias y posiciones de las luces vienen
 * calibradas contra el render de Cycles; mover una desafina el conjunto.
 */

/** Dónde vive el paquete del termo dentro de `public/`. */
const BASE = "/termo/";

/**
 * El material del cuerpo, que es el que se tiñe y sobre el que va el diseño.
 *
 * Se busca por MATERIAL y no por nombre de malla: el GLB trae las seis piezas
 * en una sola malla de seis primitivas, así que todas comparten nombre.
 */
const MATERIAL_CUERPO = "01 | Negro grafito · pintura microtexturizada";

/** El ángulo de cámara del paquete, para que se vea como en su propio visor. */
const CAMPO_VISUAL = 25.36;

/** Qué fracción del alto del marco ocupa el termo; el resto es aire para
 *  poder girarlo sin que se salga. */
const OCUPACION = 0.62;

/* ─────────────────────────────────────────────────────────────────────────
   DÓNDE CAE EL DISEÑO · perillas para ajustar a mano

   De salida el arte se centra en la pared recta del cuerpo y se escala a lo
   que quepa conservando su proporción. Estos tres números lo corren desde
   ahí. Cambia uno, guarda, y en «Probar» se ve al momento.

   Son constantes y no una interfaz a propósito: es una calibración que se
   hace una vez contra las fotos reales del producto, como el
   `SUBIR_FRENTE_CM` de la playera.
   ───────────────────────────────────────────────────────────────────────── */

/** Sube (+) o baja (−) el diseño, en centímetros sobre el producto real.
 *  0 lo deja centrado en la pared recta. */
const SUBIR_CM = 1;

/** Agranda (>1) o encoge (<1) el diseño. 1 es lo máximo que cabe conservando
 *  su proporción; por encima de ~1.2 empieza a salirse de la pared recta y a
 *  montarse sobre la curva del fondo. */
const ESCALA = 1;

/**
 * Corre el diseño de lado, en grados alrededor del termo.
 *
 * NEGATIVO lo mueve a la IZQUIERDA de quien mira, positivo a la derecha.
 * Sobre un cilindro, moverlo de lado es girarlo: no hay un desplazamiento
 * horizontal que no sea éste. Con los 10 cm de diámetro del cuerpo la vuelta
 * son 31,4 cm, así que 10° ≈ 0,9 cm de recorrido sobre la pared.
 */
const GIRO_GRADOS = -35;

/**
 * El modelo y su estudio, cargados UNA VEZ por pestaña.
 *
 * Entre el GLB, el HDR y el decodificador son 1,6 MB: volver a bajarlos cada
 * vez que se entra en «Probar» y se vuelve al editor no es una opción.
 */
let promesa: Promise<{ escena: THREE.Group; hdr: THREE.DataTexture }> | null =
	null;

function cargarPaquete() {
	if (promesa) return promesa;
	const draco = new DRACOLoader().setDecoderPath(`${BASE}vendor/draco/`);
	draco.setWorkerLimit(2);
	promesa = Promise.all([
		new GLTFLoader()
			.setDRACOLoader(draco)
			.loadAsync(`${BASE}assets/termo_web.glb`),
		new HDRLoader().loadAsync(`${BASE}assets/estudio.hdr`),
	])
		.then(([gltf, hdr]) => {
			draco.dispose();
			hdr.mapping = THREE.EquirectangularReflectionMapping;
			return { escena: gltf.scene, hdr };
		})
		.catch((error) => {
			draco.dispose();
			/* Un fallo de red no puede dejar la promesa cacheada para siempre: sin
			   esto, el primer intento fallido condena a la pestaña entera. */
			promesa = null;
			throw error;
		});
	return promesa;
}

/**
 * El estudio de luces del paquete, tal cual.
 *
 * Las posiciones llegan en el sistema de Blender y en centímetros; la
 * conversión (x, y, z) → (x·0,01, z·0,01, −y·0,01) es la suya.
 */
function montarEstudio() {
	RectAreaLightUniformsLib.init();
	const grupo = new THREE.Group();
	grupo.name = "Estudio del termo";
	const softbox = (
		pos: [number, number, number],
		potencia: number,
		ancho: number,
		alto: number,
		color: [number, number, number],
		mira: [number, number, number] = [0, 0, 12],
	) => {
		const luz = new THREE.RectAreaLight(
			new THREE.Color(...color),
			potencia / (5 * Math.PI * ancho * alto),
			ancho * 0.01,
			alto * 0.01,
		);
		luz.position.set(pos[0] * 0.01, pos[2] * 0.01, -pos[1] * 0.01);
		luz.lookAt(mira[0] * 0.01, mira[2] * 0.01, -mira[1] * 0.01);
		grupo.add(luz);
	};
	softbox([-11, -11, 17], 17000, 4, 24, [1, 0.93, 0.84]);
	softbox([10, -8, 15], 22000, 3.6, 26, [0.87, 0.93, 1]);
	softbox([-1, -15, 25], 4500, 10, 10, [1, 1, 1]);
	softbox([3, 6, 23], 20000, 7, 18, [0.78, 0.87, 1]);
	softbox([-6, 0, 31], 11000, 9, 8, [1, 1, 1], [0, 0, 20]);
	return grupo;
}

/**
 * Dónde cae el diseño: la pared recta del cuerpo.
 *
 * Se MIDE sobre la geometría en vez de fijarla a mano, porque el termo se
 * estrecha hacia abajo y sólo la mitad de arriba es cilíndrica. Grabar fuera
 * de ahí deformaría el arte sobre la curva.
 */
function medirFranja(cuerpo: THREE.Mesh) {
	cuerpo.updateWorldMatrix(true, false);
	const posicion = cuerpo.geometry.getAttribute("position");
	const punto = new THREE.Vector3();
	let radio = 0;
	for (let i = 0; i < posicion.count; i++) {
		punto.fromBufferAttribute(posicion, i).applyMatrix4(cuerpo.matrixWorld);
		const r = Math.hypot(punto.x, punto.z);
		if (r > radio) radio = r;
	}
	let y0 = Number.POSITIVE_INFINITY;
	let y1 = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < posicion.count; i++) {
		punto.fromBufferAttribute(posicion, i).applyMatrix4(cuerpo.matrixWorld);
		if (Math.hypot(punto.x, punto.z) < radio * 0.97) continue;
		if (punto.y < y0) y0 = punto.y;
		if (punto.y > y1) y1 = punto.y;
	}
	return { radio, y0, y1 };
}

export default function Termo3D({
	arte,
	hex,
	miniatura = false,
	zoom = 1,
	anchoCm,
	altoCm,
	centro = 0.5,
}: Props) {
	const host = useRef<HTMLDivElement>(null);
	const [error, setError] = useState(false);
	const [cargando, setCargando] = useState(true);
	const api = useRef<{
		rotate: (delta: number) => void;
		zoom: (value: number) => void;
		color: (value?: string | null) => void;
	} | null>(null);

	/* `zoom` se queda FUERA de las dependencias: aquí sólo siembra el zoom
	   inicial. Dentro reconstruiría renderer, texturas y geometría en cada paso
	   del zoom; de moverlo se encarga el efecto de abajo, que sólo toca la
	   cámara. Mismo motivo que en la taza. */
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver comentario
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
		renderer.toneMappingExposure = 1;
		renderer.domElement.style.cssText =
			"width:100%;height:100%;display:block;touch-action:none";
		root.appendChild(renderer.domElement);

		const scene = new THREE.Scene();
		/* Perspectiva, no ortográfica: es la cámara con la que se calibró el
		   estudio. La taza usa ortográfica porque su mapeo viene de una foto. */
		const camera = new THREE.PerspectiveCamera(CAMPO_VISUAL, 1, 0.001, 10);
		camera.position.set(0, 0.24, 0.68);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enabled = !miniatura;
		controls.enablePan = false;
		controls.enableDamping = true;
		controls.dampingFactor = 0.12;
		controls.minPolarAngle = 0.35;
		controls.maxPolarAngle = Math.PI - 0.35;
		controls.target.set(0, 0.12, 0);
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
				scene.environmentIntensity = 0.08;
				scene.add(montarEstudio());

				const termo = escena.clone(true);
				scene.add(termo);

				/* Los materiales del GLB los comparten todas las instancias del
				   modelo cacheado: teñir el original pintaría también la miniatura
				   que esté montada al lado. */
				let cuerpo: THREE.Mesh | null = null;
				const anisotropia = Math.min(
					8,
					renderer.capabilities.getMaxAnisotropy(),
				);
				termo.traverse((objeto) => {
					if (!(objeto instanceof THREE.Mesh)) return;
					const original = objeto.material as THREE.Material | THREE.Material[];
					const copias = (Array.isArray(original) ? original : [original]).map(
						(m) => {
							const copia = m.clone() as THREE.MeshPhysicalMaterial;
							propias.push(copia);
							if (copia.normalMap) copia.normalMap.anisotropy = anisotropia;
							if (copia.name === MATERIAL_CUERPO) cuerpo = objeto;
							return copia;
						},
					);
					objeto.material = Array.isArray(original) ? copias : copias[0];
				});

				const tenir = (valor?: string | null) => {
					if (!cuerpo) return;
					const materiales = [
						(cuerpo as THREE.Mesh).material,
					].flat() as THREE.MeshPhysicalMaterial[];
					for (const m of materiales) {
						if (m.name !== MATERIAL_CUERPO) continue;
						/* Sin color declarado se respeta el negro grafito del paquete. */
						if (/^#[\da-f]{6}$/i.test(valor ?? ""))
							m.color.set(valor as string);
						else m.color.setRGB(0.008, 0.009, 0.01);
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

				/* Encuadre a partir de la caja REAL del modelo. El origen del paquete
				   está en el centro de la BASE, no del objeto: sin esto la cámara
				   apunta demasiado abajo y el termo sale cortado por arriba. */
				const caja = new THREE.Box3().setFromObject(termo);
				const alto = caja.max.y - caja.min.y;
				const centroY = (caja.max.y + caja.min.y) / 2;
				const distancia =
					alto / OCUPACION / (2 * Math.tan((CAMPO_VISUAL * Math.PI) / 360));
				controls.target.set(0, centroY, 0);
				camera.position.set(0, centroY + alto * 0.12, distancia);
				controls.minDistance = distancia * 0.45;
				controls.maxDistance = distancia * 1.8;
				controls.update();

				setCargando(false);
				resize();
				setZoom(zoom);
				invalidate();

				if (!cuerpo || !arte) return;

				// ---- La franja del diseño --------------------------------------
				const { radio, y0, y1 } = medirFranja(cuerpo);
				if (!Number.isFinite(y0) || !Number.isFinite(y1)) return;

				const lienzo = document.createElement("canvas");
				lienzo.width = miniatura ? 1024 : 2048;
				lienzo.height = miniatura ? 512 : 1024;
				const ctx = lienzo.getContext("2d");
				if (!ctx) return;

				const img = new Image();
				img.onload = () => {
					if (!vigente) return;

					/* EL ARTE NO SE ESTIRA. Antes se mapeaba a una vuelta COMPLETA y
					   a toda la pared recta, así que salía deformado y, al ocupar
					   los 360°, de frente sólo se leía el tercio de en medio: de
					   «SARCASM UNIVERSITY» se veía «SARCAS».

					   Ahora manda la proporción del propio raster —que el exportador
					   conserva de verdad, mientras que los centímetros declarados
					   del producto pueden no cuadrar— y se ajusta a lo que hay de
					   pared: el ancho es el declarado como fracción de la
					   circunferencia, y si el alto que pide no cabe, se reduce todo
					   a la vez para no deformarlo. */
					const escala = 100; // el modelo viene en metros
					const circunferenciaCm = 2 * Math.PI * radio * escala;
					const paredCm = (y1 - y0) * escala;
					const proporcion =
						img.naturalWidth > 0 && img.naturalHeight > 0
							? img.naturalWidth / img.naturalHeight
							: 1;

					let ancho = Math.min(anchoCm || circunferenciaCm, circunferenciaCm);
					let alto = ancho / proporcion;
					if (alto > paredCm) {
						alto = paredCm;
						ancho = alto * proporcion;
					}
					/* La escala manual va DESPUÉS del ajuste, y no se vuelve a
					   recortar: si se pide más de lo que cabe es porque se quiere ver
					   qué pasa, y recortarlo por detrás sería ignorar la perilla sin
					   decirlo. */
					ancho *= ESCALA;
					alto *= ESCALA;
					const arco = 2 * Math.PI * Math.min(1, ancho / circunferenciaCm);

					const geometria = new THREE.CylinderGeometry(
						radio * 1.0015,
						radio * 1.0015,
						alto / escala,
						Math.max(
							8,
							Math.round((miniatura ? 48 : 96) * (arco / (2 * Math.PI))),
						),
						1,
						true,
						/* El arco se centra en +Z, que es lo que mira a cámara. */
						-arco / 2,
						arco,
					);
					geometrias.push(geometria);

					const textura = new THREE.CanvasTexture(lienzo);
					textura.colorSpace = THREE.SRGBColorSpace;
					textura.anisotropy = anisotropia;
					texturas.push(textura);

					/* EL LÁSER ES ACERO A LA VISTA, no pintura clara. El mapa ya
					   viene plateado desde `platearArte`, pero con `metalness: 0` no
					   tenía nada que reflejar y quedaba gris plano. Con metal y algo
					   de aspereza recoge el estudio y se lee como grabado. */
					const material = new THREE.MeshPhysicalMaterial({
						map: textura,
						transparent: true,
						metalness: 0.9,
						roughness: 0.34,
						depthWrite: false,
						polygonOffset: true,
						polygonOffsetFactor: -1,
					});
					propias.push(material);

					const franja = new THREE.Mesh(geometria, material);
					franja.position.y = (y0 + y1) / 2 + SUBIR_CM / escala;
					/* `centro` dice qué u del arte mira al frente. El arte ocupa el
					   arco entero, así que su u=centro está en −arco/2 + centro·arco
					   y hay que girar lo justo para traerla al frente. */
					franja.rotation.y =
						arco *
							(0.5 - (Number.isFinite(centro) ? ((centro % 1) + 1) % 1 : 0.5)) +
						(GIRO_GRADOS * Math.PI) / 180;
					scene.add(franja);

					ctx.clearRect(0, 0, lienzo.width, lienzo.height);
					ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
					textura.needsUpdate = true;
					invalidate();
				};
				img.onerror = () => {
					/* Que falle el arte no puede tumbar la vista del producto: el
					   termo sigue siendo útil sin el diseño encima. */
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
			/* Sólo se tira lo de ESTA instancia. Las geometrías y el HDR del
			   paquete viven en la caché del módulo y los comparten las demás
			   vistas: liberarlos aquí dejaría la siguiente en negro. */
			for (const m of propias) m.dispose();
			for (const g of geometrias) g.dispose();
			for (const t of texturas) t.dispose();
			entorno?.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
			renderer.domElement.remove();
		};
	}, [arte, miniatura, anchoCm, altoCm, centro]);

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
			{/* La miniatura va oculta al lector de pantalla: quien la ve tiene al
			    lado el botón del lado, que ya dice cuál es. La vista grande sí se
			    anuncia, porque es el contenido. */}
			{miniatura ? (
				<div ref={host} className="absolute inset-0" aria-hidden="true" />
			) : (
				<div
					ref={host}
					className="absolute inset-0"
					role="img"
					aria-label="Vista 3D de tu diseño en el termo. Arrastra para girar."
				/>
			)}
			{cargando && !error && !miniatura && (
				<output className="absolute inset-x-0 top-4 block text-center text-sm text-tinta/55">
					Preparando tu termo…
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
				/* Sólo en escritorio: con el dedo el termo ya se gira arrastrándolo,
				   y ahí los botones taparían la parte baja del modelo. Con ratón sí
				   valen, y el teclado los necesita para poder girar sin gesto. */
				<div className="absolute inset-x-0 bottom-16 hidden flex-col items-center gap-2 md:flex">
					<div className="flex items-center gap-2 rounded-full border border-tinta/10 bg-white/90 p-1 shadow-sm">
						<button
							type="button"
							aria-label="Girar termo a la izquierda"
							onClick={() => api.current?.rotate(-Math.PI / 6)}
							className="rounded-full px-3 py-2 text-sm hover:bg-gris"
						>
							↶
						</button>
						<button
							type="button"
							aria-label="Girar termo a la derecha"
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
