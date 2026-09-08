"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mapeoTaza, type ReferenciaCilindrica } from "@/lib/prenda/mapeoTaza";
import type { FotoRealDePrenda } from "@/lib/api/catalogo";

type Props = {
	arte?: string | null;
	hex?: string | null;
	miniatura?: boolean;
	zoom?: number;
	anchoCm?: number;
	altoCm?: number;
	centro?: number;
	referencia?: FotoRealDePrenda;
};

/** Modelo paramétrico de referencia. Las medidas declaradas son del arte,
 * no una medición del recipiente del proveedor. Nunca se usa para fabricar. */
export default function Taza3D({
	arte,
	hex,
	miniatura = false,
	zoom = 1,
	anchoCm,
	altoCm,
	centro = 0.5,
	referencia,
}: Props) {
	const host = useRef<HTMLDivElement>(null);
	const [error, setError] = useState(false);
	const [cargando, setCargando] = useState(true);
	const api = useRef<{
		rotate: (delta: number) => void;
		zoom: (value: number) => void;
		color: (value?: string | null) => void;
	} | null>(null);

	/* `zoom` se queda FUERA de las dependencias a propósito: aquí sólo se usa
	   para sembrar el zoom inicial al montar la escena. Ponerlo dentro —el
	   arreglo que propone la regla— reconstruiría el renderer, las texturas y
	   la geometría en cada paso del zoom. De cambiarlo se encarga el efecto de
	   abajo, que sólo mueve la cámara. */
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
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.3;
		renderer.domElement.style.cssText =
			"width:100%;height:100%;display:block;touch-action:none";
		root.appendChild(renderer.domElement);
		const scene = new THREE.Scene();
		// La foto usa proyección cilíndrica ortográfica: una cámara perspectiva
		// volvería a cambiar el tamaño relativo de la tinta según su profundidad.
		const camera = new THREE.OrthographicCamera(-0.1, 0.1, 0.1, -0.1, 0.01, 10);
		let altoEncuadre = 0.2;
		// El frente (+Z) coincide con el centro de la foto, no una vista lateral.
		camera.position.set(0, 0.065, 0.29);
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enabled = !miniatura;
		controls.enablePan = false;
		controls.enableDamping = true;
		controls.dampingFactor = 0.12;
		controls.minZoom = 0.5;
		controls.maxZoom = 4;
		controls.minPolarAngle = 0.15;
		controls.maxPolarAngle = Math.PI - 0.15;
		controls.target.set(0, 0, 0);
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
		api.current = {
			rotate: (delta) => {
				const offset = camera.position.clone().sub(controls.target);
				offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
				camera.position.copy(controls.target).add(offset);
				controls.update();
				invalidate();
			},
			zoom: setZoom,
			color: () => {},
		};
		const resize = () => {
			const { width, height } = root.getBoundingClientRect();
			if (!width || !height) return;
			renderer.setSize(width, height, false);
			const aspect = width / height;
			const alto = Math.max(altoEncuadre, 0.16 / aspect);
			camera.left = (-alto * aspect) / 2;
			camera.right = (alto * aspect) / 2;
			camera.top = alto / 2;
			camera.bottom = -alto / 2;
			camera.updateProjectionMatrix();
			invalidate();
		};
		const observer = new ResizeObserver(resize);
		observer.observe(root);
		scene.add(new THREE.HemisphereLight(0xffffff, 0x807563, 2.8));
		const key = new THREE.DirectionalLight(0xfff4e3, 3.5);
		key.position.set(-1, 2, 3);
		scene.add(key);
		const rim = new THREE.DirectionalLight(0xffffff, 2.5);
		rim.position.set(2, 1, -2);
		scene.add(rim);

		const color = /^#[\da-f]{6}$/i.test(hex ?? "") ? hex! : "#f9f8f4";
		const ceramic = new THREE.MeshPhysicalMaterial({
			color,
			roughness: 0.24,
			metalness: 0,
			clearcoat: 0.8,
			clearcoatRoughness: 0.18,
		});
		api.current.color = (value) => {
			ceramic.color.set(
				/^#[\da-f]{6}$/i.test(value ?? "") ? value! : "#f9f8f4",
			);
			invalidate();
		};
		// Perfil cerrado: base, pared exterior, labio redondeado e interior hueco.
		const profile = [
			[0, -0.047],
			[0.033, -0.047],
			[0.038, -0.045],
			[0.041, -0.041],
			[0.041, 0.043],
			[0.0408, 0.046],
			[0.0395, 0.048],
			[0.0375, 0.048],
			[0.0365, 0.046],
			[0.0365, -0.037],
			[0.034, -0.04],
			[0, -0.04],
		].map(([x, y]) => new THREE.Vector2(x, y));
		const body = new THREE.Mesh(
			new THREE.LatheGeometry(profile, miniatura ? 48 : 96),
			ceramic,
		);
		const mug = new THREE.Group();
		scene.add(mug);
		mug.add(body);
		const handleCurve = new THREE.CatmullRomCurve3([
			new THREE.Vector3(0.038, 0.031, 0),
			new THREE.Vector3(0.065, 0.03, 0),
			new THREE.Vector3(0.077, 0.014, 0),
			new THREE.Vector3(0.077, -0.009, 0),
			new THREE.Vector3(0.063, -0.029, 0),
			new THREE.Vector3(0.038, -0.031, 0),
		]);
		mug.add(
			new THREE.Mesh(
				new THREE.TubeGeometry(handleCurve, 48, 0.006, 12, false),
				ceramic,
			),
		);

		const textures: THREE.Texture[] = [];
		// El wrap conserva exactamente u/v y los márgenes del área editable.
		// NO encajar ni centrar de nuevo: cambiaría tamaño y posición de la tinta.
		const textureCanvas = document.createElement("canvas");
		textureCanvas.width = miniatura ? 512 : 2048;
		textureCanvas.height = miniatura ? 256 : 1024;
		const ctx = textureCanvas.getContext("2d")!;
		const texture = new THREE.CanvasTexture(textureCanvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
		textures.push(texture);
		const bandHeight = 0.077;
		const band = new THREE.Mesh(
			new THREE.CylinderGeometry(
				0.04102,
				0.04102,
				bandHeight,
				miniatura ? 48 : 96,
				1,
				true,
			),
			new THREE.MeshPhysicalMaterial({
				map: texture,
				transparent: true,
				roughness: 0.32,
				clearcoat: 0.65,
				depthWrite: false,
				polygonOffset: true,
				polygonOffsetFactor: -1,
			}),
		);
		mug.add(band);
		let proporcionArte = anchoCm && altoCm ? anchoCm / altoCm : 21 / 8;
		let calibracion: ReferenciaCilindrica | undefined;
		let arteListo = !arte;
		let fotoLista = !referencia?.banda;
		mug.visible = false;
		const ajustarProporcion = () => {
			if (!arteListo || !fotoLista) return;
			const mapeo = mapeoTaza({
				proporcion: proporcionArte,
				centro,
				referencia: calibracion,
			});
			mug.scale.y = mapeo.escalaVertical;
			band.rotation.y = mapeo.giro;
			// Encuadrar también una taza alta sin reducir el diseño por separado.
			const encuadre = Math.max(1, mapeo.escalaVertical);
			altoEncuadre = 0.17 * encuadre;
			camera.position.set(
				0,
				Math.sin(mapeo.elevacion) * 0.4,
				Math.cos(mapeo.elevacion) * 0.4,
			);
			controls.update();
			mug.visible = true;
			setCargando(false);
			resize();
		};
		ajustarProporcion();
		const fotoReferencia = new Image();
		fotoReferencia.onload = () => {
			if (!vigente || !referencia?.banda) return;
			calibracion = {
				anchoFoto: fotoReferencia.naturalWidth,
				altoFoto: fotoReferencia.naturalHeight,
				banda: referencia.banda,
			};
			fotoLista = true;
			ajustarProporcion();
		};
		fotoReferencia.onerror = () => {
			if (!vigente) return;
			fotoLista = true;
			ajustarProporcion();
		};
		// Sólo leer dimensiones, no píxeles: si falla, queda el mapeo de la plantilla.
		if (referencia?.banda) fotoReferencia.src = referencia.url;
		const img = new Image();
		img.onload = () => {
			if (!vigente) return;
			// El exportador conserva la proporción REAL del área, que puede diferir
			// de los cm declarados. Es la referencia cuando no hay foto calibrada.
			proporcionArte = img.naturalWidth / img.naturalHeight;
			arteListo = true;
			ajustarProporcion();
			ctx.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
			ctx.drawImage(img, 0, 0, textureCanvas.width, textureCanvas.height);
			texture.needsUpdate = true;
			invalidate();
		};
		img.onerror = () => {
			if (vigente) {
				setError(true);
				setCargando(false);
			}
		};
		if (arte) {
			img.crossOrigin = "anonymous";
			img.src = arte;
		}
		const lost = (event: Event) => {
			event.preventDefault();
			setError(true);
		};
		renderer.domElement.addEventListener("webglcontextlost", lost);
		resize();
		setZoom(zoom);
		return () => {
			vigente = false;
			api.current = null;
			cancelAnimationFrame(frame);
			observer.disconnect();
			controls.dispose();
			img.onload = null;
			img.onerror = null;
			fotoReferencia.onload = null;
			fotoReferencia.onerror = null;
			renderer.domElement.removeEventListener("webglcontextlost", lost);
			const materials = new Set<THREE.Material>();
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					object.geometry.dispose();
					for (const material of [object.material].flat())
						materials.add(material);
				}
			});
			materials.forEach((material) => material.dispose());
			textures.forEach((item) => item.dispose());
			renderer.dispose();
			renderer.forceContextLoss();
			renderer.domElement.remove();
		};
		// Zoom se actualiza sin reconstruir la escena en el efecto siguiente.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [arte, miniatura, anchoCm, altoCm, centro, referencia]);

	useEffect(() => {
		api.current?.color(hex);
	}, [hex]);

	useEffect(() => {
		api.current?.zoom(zoom);
	}, [zoom]);

	return (
		<div
			className={`relative w-full ${miniatura ? "aspect-square pointer-events-none" : "h-full min-h-[260px]"}`}
		>
			<div
				ref={host}
				className="absolute inset-0"
				role={miniatura ? undefined : "img"}
				aria-label={
					miniatura
						? undefined
						: "Vista 3D de tu diseño en una taza. Arrastra para girar."
				}
			/>
			{cargando && !error && !miniatura && (
				<p
					role="status"
					className="absolute inset-x-0 top-4 text-center text-sm text-tinta/55"
				>
					Preparando tu taza…
				</p>
			)}
			{error && (
				<div
					role="status"
					className="absolute inset-0 flex items-center justify-center bg-hueso-suave p-3 text-center text-xs text-tinta/60"
				>
					{miniatura
						? "3D"
						: "No se pudo cargar la vista 3D. Puedes seleccionar una de las imágenes del producto."}
				</div>
			)}
			{!miniatura && !error && (
				/* SÓLO EN ESCRITORIO. Con el dedo la taza ya se gira arrastrándola
				   encima, así que aquí los botones y su explicación son un estorbo:
				   tapan la parte baja del modelo, que es justo donde cae el arte en
				   una taza. Con ratón sí valen —arrastrar no es tan evidente— y el
				   teclado los sigue necesitando para poder girar sin gesto. */
				<div className="absolute inset-x-0 bottom-16 hidden flex-col items-center gap-2 md:flex">
					<div className="flex items-center gap-2 rounded-full border border-tinta/10 bg-white/90 p-1 shadow-sm">
						<button
							type="button"
							aria-label="Girar taza a la izquierda"
							onClick={() => api.current?.rotate(-Math.PI / 6)}
							className="rounded-full px-3 py-2 text-sm hover:bg-gris"
						>
							↶
						</button>
						<button
							type="button"
							aria-label="Girar taza a la derecha"
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
