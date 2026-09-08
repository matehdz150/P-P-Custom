"use client";

import { Textbox } from "fabric";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { FotoRealDePrenda } from "@/lib/api/catalogo";
import { esGorra3D } from "@/lib/prenda/mapeoGorra";
import { esPlayera3D } from "@/lib/prenda/mapeoPlayera";
import { esTermo3D } from "@/lib/prenda/mapeoTermo";
import type { ProductTemplate } from "@/lib/products/types";
import DesignerCanvasSide from "./DesignerCanvasSide";
import DesignerNoticeModal from "./DesignerNoticeModal";
import DesignerSidebar from "./DesignerSidebar/DesignerSidebar";
import CurvedTextEditor from "./design/CurvedTextEditor";
import DesignerBottomBar from "./design/DesignerBottomBar";
import DesignerSideSwitcher from "./design/DesignerSideSwitcher";
import PreviewEditButtons, {
	type ModoDelEditor,
} from "./design/PreviewEditButtons";
import RightLayersPanel from "./design/RightLayersPanel/RightLayersPanel";
import ImageToolbar from "./design/toolbar/ImageToolbar";
import ShapeToolbar from "./design/toolbar/ShapeToolbar";
import TextToolbar from "./design/toolbar/TextToolbar";
import UndoRedoButtons from "./design/UndoRedoButtons";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useDescargarVista } from "./hooks/useDescargarVista";
import { useZoomDeVista } from "./hooks/useZoomDeVista";
import VistaDeLaPrenda, { type VistaActual } from "./VistaDeLaPrenda";

export default function DesktopDesignerShell({
	product,
	fotosReales,
	onVolverAlCatalogo,
}: {
	product: ProductTemplate;
	/**
	 * Las fotos de la prenda de verdad, por lado y color.
	 *
	 * Viaja aparte de `product` porque ese objeto entra con un `as unknown as`
	 * desde la ficha: meterlo ahí obligaría a ensanchar `ProductTemplate`, que
	 * es el tipo de las plantillas de mockup y no sabe nada de fotos.
	 */
	fotosReales: FotoRealDePrenda[];
	onVolverAlCatalogo: () => void;
}) {
	const { activeSide, setActiveSide, getCanvas } = useDesigner();

	const canvas = getCanvas();
	const { zoom, zoomIn, zoomOut } = useCanvasZoom(canvas);
	const [isPanning, setIsPanning] = useState(false);
	useCanvasPan({ fabricCanvas: canvas, isPanning });
	const [layersOpen, setLayersOpen] = useState(true);
	const [modo, setModo] = useState<ModoDelEditor>("editar");
	const probando = modo === "probar";
	/* Qué combinación de lado y color se está mirando. La sube la vista y la
	   consume la barra de abajo, que es su hermana y no lo sabría de otro modo. */
	const [vista, setVista] = useState<VistaActual | null>(null);
	/* Zoom propio para "Probar": compartir el del lienzo movería la cámara del
	   editor al acercarse a mirar, y al volver el diseño estaría desplazado. */
	const mirar = useZoomDeVista();
	const esTaza =
		product.sides.includes("wrap") &&
		product.forma !== "cono" &&
		/\b(tazas?|mugs?)\b/i.test(product.name ?? "");
	const medidaWrap = product.printSides?.find(
		(side) => side.sideKey === "wrap",
	);

	const descargar = useDescargarVista(vista);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Delete" && e.key !== "Backspace") return;

			// 🛑 No borrar el objeto si el usuario está escribiendo en un campo
			// (input del panel derecho, editor de texto curvo, etc.)
			const t = e.target as HTMLElement | null;
			if (
				t &&
				(t.tagName === "INPUT" ||
					t.tagName === "TEXTAREA" ||
					t.isContentEditable)
			) {
				return;
			}

			const canvas = getCanvas();
			if (!canvas) return;

			const activeObjects = canvas.getActiveObjects();
			if (activeObjects.length === 0) return;

			// 🛑 No borrar si algún Textbox está en edición
			const isEditingText = activeObjects.some(
				(obj) => obj instanceof Textbox && obj.isEditing,
			);

			if (isEditingText) return;

			// 🗑️ Borrar selección
			canvas.discardActiveObject();
			activeObjects.forEach((obj) => {
				canvas.remove(obj);
			});

			canvas.requestRenderAll();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [getCanvas]);

	return (
		<div className="w-full h-screen flex overflow-hidden">
			<DesignerSidebar
				onVolverAlCatalogo={onVolverAlCatalogo}
				inhabilitado={probando}
			/>

			<div className="flex-1 h-full w-full relative overflow-hidden">
				{product.sides.map((side) => (
					<DesignerCanvasSide key={side} side={side} product={product} />
				))}

				{/* Se monta y se desmonta con el modo, y NO se esconde con una clase:
				    al montarse es cuando exporta los lienzos, así que lo que se ve
				    es siempre el diseño de este momento. Los canvas siguen debajo —
				    desmontarlos perdería el diseño, que sólo vive ahí. */}
				{probando && (
					<VistaDeLaPrenda
						playera3D={esPlayera3D(product)}
						gorra3D={esGorra3D(product)}
						termo3D={
							esTermo3D(product)
								? { anchoCm: medidaWrap?.widthCm, altoCm: medidaWrap?.heightCm }
								: undefined
						}
						medidasPlayera={product.printSides}
						taza3D={
							esTaza
								? { anchoCm: medidaWrap?.widthCm, altoCm: medidaWrap?.heightCm }
								: undefined
						}
						fotosReales={fotosReales}
						sideLabels={product.sideLabels ?? {}}
						zoom={mirar.zoom}
						desplazamiento={mirar.desplazamiento}
						alArrastrar={mirar.alArrastrar}
						onVista={setVista}
					/>
				)}

				<PreviewEditButtons
					isLayersOpen={layersOpen}
					onToggleLayers={() => setLayersOpen((v) => !v)}
					modo={modo}
					onModo={setModo}
				/>

				{/* Lo que EDITA se va en "Probar": deshacer, capas, las barras de
				    texto y de imagen y el cambiador de lado. Ahí no hay nada que
				    deshacer ni que ordenar, y el lado se elige en el panel de vistas. */}
				{!probando && (
					<>
						<UndoRedoButtons />

						<RightLayersPanel
							open={layersOpen}
							onClose={() => setLayersOpen(false)}
						/>

						<DesignerSideSwitcher
							currentSide={activeSide}
							sides={product.sides}
							product={product}
							onChange={setActiveSide}
						/>

						<TextToolbar />
						<ImageToolbar />
						<ShapeToolbar />
						<CurvedTextEditor />
					</>
				)}

				{/* La barra de abajo se queda en los DOS modos: agregar al carrito o
				    pedir es lo que uno quiere hacer justo después de ver cómo queda.
				    Lo único que cambia es su lado izquierdo — el zoom no sirve
				    mirando, y ahí va la descarga. */}
				{/* El mismo control, dos cámaras: en "Editar" mueve el lienzo de
				    Fabric; en "Probar", la foto de la prenda. */}
				<DesignerBottomBar
					zoom={probando ? mirar.zoom : zoom}
					zoomIn={probando ? mirar.acercar : zoomIn}
					zoomOut={probando ? mirar.alejar : zoomOut}
					isPanning={isPanning}
					togglePan={() => setIsPanning((p) => !p)}
					probando={probando}
					onReiniciarZoom={mirar.reiniciar}
					onDescargar={vista ? descargar : undefined}
				/>
			</div>
			<DesignerNoticeModal />
		</div>
	);
}
