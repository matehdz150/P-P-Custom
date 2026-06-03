import type { Canvas, FabricObject } from "fabric";
import { FabricImage } from "fabric";
import { uploadImageBlob } from "@/lib/api/uploads";
import type { EditableShape, ProductTemplate } from "@/lib/products/types";

export type DesignAssetType = "text" | "image" | "shape";

export interface DesignAsset {
	id: string;
	type: DesignAssetType;
	label: string;
	url: string;
	width: number;
	height: number;
	text?: string;
	fontFamily?: string;
	fontSize?: number;
	color?: string;
}

export interface OrderDesignExport {
	/** side -> URL de la imagen compuesta en HD (Cloudinary) */
	snapshots: Record<string, string>;
	/** side -> lista de componentes exportados por separado */
	assets: Record<string, DesignAsset[]>;
}

export interface ExportSideState {
	canvas: Canvas | null;
	editableAreas: FabricObject[];
}

export type ExportProgress = (done: number, total: number) => void;

// Resolución objetivo (lado más largo en px) para mantener todo en HD.
const COMPOSITE_TARGET_PX = 2400;
const COMPONENT_TARGET_PX = 2000;
const MAX_MULTIPLIER = 8;
const UPLOAD_CONCURRENCY = 5;

function clamp(n: number, min: number, max: number) {
	return Math.min(max, Math.max(min, n));
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
	const res = await fetch(dataUrl);
	return res.blob();
}

/**
 * Renderiza un PNG del canvas SIN fondo: quita el mockup (backgroundImage) y el
 * color de fondo opaco justo antes de exportar, dejando el resultado 100%
 * transparente. Es SÍNCRONO a propósito: el mockup se re-aplica mediante un
 * watcher con setInterval(200ms), pero como toDataURL no cede el hilo, el
 * watcher no puede colarse entre el "quitar fondo" y el render. Restauramos el
 * fondo en finally para no afectar el canvas en vivo.
 */
function exportTransparentDataUrl(
	c: Canvas,
	opts: Parameters<Canvas["toDataURL"]>[0],
): string {
	// biome-ignore lint/suspicious/noExplicitAny: props internas de fabric
	const cc = c as any;
	const bgImg = cc.backgroundImage;
	const bgColor = cc.backgroundColor;
	cc.backgroundImage = undefined;
	cc.backgroundColor = undefined;
	try {
		return c.toDataURL(opts);
	} finally {
		cc.backgroundImage = bgImg;
		cc.backgroundColor = bgColor;
	}
}

function cropFromArea(area: EditableShape | undefined) {
	if (!area) return undefined;
	if (area.type === "circle") {
		return {
			left: area.cx - area.radius,
			top: area.cy - area.radius,
			width: area.radius * 2,
			height: area.radius * 2,
		};
	}
	return {
		left: area.left,
		top: area.top,
		width: area.width,
		height: area.height,
	};
}

function newId() {
	return typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type AssetMeta = Omit<DesignAsset, "url" | "width" | "height">;

function assetMetaFor(
	obj: FabricObject,
	counters: { text: number; image: number; shape: number },
): AssetMeta {
	const t = obj as unknown as {
		text?: string;
		fontFamily?: string;
		fontSize?: number;
		fill?: unknown;
	};

	if (obj instanceof FabricImage) {
		counters.image += 1;
		return { id: newId(), type: "image", label: `Imagen ${counters.image}` };
	}

	if (typeof t.text === "string") {
		counters.text += 1;
		const label =
			(t.text || "").trim().slice(0, 40) || `Texto ${counters.text}`;
		return {
			id: newId(),
			type: "text",
			label,
			text: t.text,
			fontFamily: t.fontFamily,
			fontSize: t.fontSize,
			color: typeof t.fill === "string" ? t.fill : undefined,
		};
	}

	counters.shape += 1;
	return { id: newId(), type: "shape", label: `Forma ${counters.shape}` };
}

type RenderedComposite = { side: string; blob: Blob; filename: string };
type RenderedAsset = {
	side: string;
	meta: AssetMeta;
	width: number;
	height: number;
	blob: Blob;
	filename: string;
};

async function runWithConcurrency(
	jobs: Array<() => Promise<void>>,
	limit: number,
) {
	let index = 0;
	const worker = async () => {
		while (index < jobs.length) {
			const current = index;
			index += 1;
			await jobs[current]();
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(limit, jobs.length) }, worker),
	);
}

/**
 * Genera, en el cliente y en HD, la imagen compuesta de cada lado y cada
 * componente del diseño POR SEPARADO, tal cual se ven (incluyendo el recorte
 * del área editable), los sube a Cloudinary y devuelve sus URLs.
 *
 * Cada componente se renderiza desde el canvas completo ocultando los demás
 * objetos — así el clipPath (absolutePositioned) se aplica correctamente y el
 * resultado es WYSIWYG (el texto se ve, las imágenes salen recortadas como en
 * el diseño). El render es local; las subidas se hacen en paralelo para que la
 * confirmación no se quede "preparando" demasiado tiempo.
 */
export async function buildOrderDesignExport(
	sides: Record<string, ExportSideState>,
	product: ProductTemplate,
	onProgress?: ExportProgress,
): Promise<OrderDesignExport> {
	// ---- Fase A: render local (sin red) → blobs ----
	const composites: RenderedComposite[] = [];
	const renderedAssets: RenderedAsset[] = [];

	for (const [side, state] of Object.entries(sides)) {
		const c = state.canvas;
		// biome-ignore lint/suspicious/noExplicitAny: comprobar que el canvas sigue montado
		if (!c || !(c as any).contextContainer) continue;

		c.discardActiveObject();

		const areaSet = new Set<FabricObject>(state.editableAreas ?? []);
		const userObjects = c
			.getObjects()
			.filter(
				(o) =>
					!areaSet.has(o) &&
					// biome-ignore lint/suspicious/noExplicitAny: flag de fabric
					(o as any).excludeFromExport !== true &&
					o.visible !== false,
			);
		if (userObjects.length === 0) continue;

		// Resetear viewport. El fondo (mockup + color) se quita por-render dentro
		// de exportTransparentDataUrl para vencer al watcher del mockup.
		const savedVP = c.viewportTransform;
		c.setViewportTransform([1, 0, 0, 1, 0, 0]);
		c.requestRenderAll();
		await new Promise((r) => setTimeout(r, 60));

		// 1) Compuesto HD del lado (recortado al área editable)
		const cropOpts = cropFromArea(
			product.editableAreas[side as keyof typeof product.editableAreas]?.[0],
		);
		const compLongest = cropOpts
			? Math.max(cropOpts.width, cropOpts.height)
			: Math.max(c.getWidth(), c.getHeight());
		const compMult = clamp(
			COMPOSITE_TARGET_PX / (compLongest || 1),
			1,
			MAX_MULTIPLIER,
		);
		try {
			const durl = exportTransparentDataUrl(c, {
				format: "png",
				multiplier: compMult,
				...cropOpts,
			});
			composites.push({
				side,
				blob: await dataUrlToBlob(durl),
				filename: `design-${side}.png`,
			});
		} catch (e) {
			console.warn(`Error generando compuesto (${side}):`, e);
		}

		// 2) Cada componente por separado: ocultamos TODO (incl. áreas editables)
		//    y revelamos uno a uno para obtener un PNG limpio de cada componente.
		const allObjects = c.getObjects();
		const originalVisibility = allObjects.map((o) => o.visible !== false);
		for (const o of allObjects) o.visible = false;

		const counters = { text: 0, image: 0, shape: 0 };
		for (const obj of userObjects) {
			obj.visible = true;
			try {
				const meta = assetMetaFor(obj, counters);
				const br = obj.getBoundingRect();
				const crop = {
					left: br.left,
					top: br.top,
					width: Math.max(1, br.width),
					height: Math.max(1, br.height),
				};
				const objLongest = Math.max(crop.width, crop.height) || 1;

				// Para imágenes apuntamos a su resolución nativa (sin pérdida);
				// para texto/formas (vectoriales) usamos el objetivo HD.
				let mult: number;
				if (obj instanceof FabricImage) {
					const orig = obj.getOriginalSize?.();
					mult = orig?.width
						? clamp(orig.width / crop.width, 1, MAX_MULTIPLIER)
						: clamp(COMPONENT_TARGET_PX / objLongest, 1, MAX_MULTIPLIER);
				} else {
					mult = clamp(COMPONENT_TARGET_PX / objLongest, 1, MAX_MULTIPLIER);
				}

				const durl = exportTransparentDataUrl(c, {
					format: "png",
					multiplier: mult,
					...crop,
				});
				renderedAssets.push({
					side,
					meta,
					width: Math.round(crop.width * mult),
					height: Math.round(crop.height * mult),
					blob: await dataUrlToBlob(durl),
					filename: `design-${side}-${meta.type}.png`,
				});
			} catch (e) {
				console.warn(`Error exportando componente (${side}):`, e);
			}
			obj.visible = false;
		}
		allObjects.forEach((o, i) => {
			o.visible = originalVisibility[i];
		});

		// Restaurar viewport (el fondo nunca se tocó en el canvas en vivo).
		c.setViewportTransform(savedVP);
		c.requestRenderAll();
	}

	// ---- Fase B: subidas a Cloudinary en paralelo (con tope de concurrencia) ----
	const total = composites.length + renderedAssets.length;
	let done = 0;
	onProgress?.(0, total);
	const bump = () => {
		done += 1;
		onProgress?.(done, total);
	};

	const snapshots: Record<string, string> = {};
	const assetUrls: Array<string | null> = new Array(renderedAssets.length).fill(
		null,
	);

	const compJobs = composites.map((comp) => async () => {
		try {
			const { url } = await uploadImageBlob(comp.blob, comp.filename);
			snapshots[comp.side] = url;
		} catch (e) {
			console.warn(`Error subiendo compuesto (${comp.side}):`, e);
		} finally {
			bump();
		}
	});

	const assetJobs = renderedAssets.map((asset, i) => async () => {
		try {
			const { url } = await uploadImageBlob(asset.blob, asset.filename);
			assetUrls[i] = url;
		} catch (e) {
			console.warn(`Error subiendo componente (${asset.side}):`, e);
		} finally {
			bump();
		}
	});

	await runWithConcurrency([...compJobs, ...assetJobs], UPLOAD_CONCURRENCY);

	// Ensamblar respetando el orden de render
	const assets: Record<string, DesignAsset[]> = {};
	renderedAssets.forEach((asset, i) => {
		const url = assetUrls[i];
		if (!url) return;
		(assets[asset.side] ??= []).push({
			...asset.meta,
			width: asset.width,
			height: asset.height,
			url,
		});
	});

	return { snapshots, assets };
}
