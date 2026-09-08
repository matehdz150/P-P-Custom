"use client";

import { useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { FotoRealDePrenda } from "@/lib/api/catalogo";
import { esGorra3D } from "@/lib/prenda/mapeoGorra";
import { esPlayera3D } from "@/lib/prenda/mapeoPlayera";
import { esTermo3D } from "@/lib/prenda/mapeoTermo";
import type { ProductTemplate } from "@/lib/products/types";
import DesignerCanvasSide from "./DesignerCanvasSide";
import DesignerNoticeModal from "./DesignerNoticeModal";
import type { ModoDelEditor } from "./design/PreviewEditButtons";
import { useDescargarVista } from "./hooks/useDescargarVista";
import { useZoomDeVista } from "./hooks/useZoomDeVista";
import DesignerHeaderMobile from "./MobileControllers/DesignerHeaderMobile";
import DesignerSideSwitcher from "./MobileControllers/DesignerSideSwitcherMobile";
import DesignerToolbarMobile from "./MobileControllers/DesignerToolbarMobile";
import MobileImageToolbarContainer from "./MobileControllers/MobileTextToolbar/MobileImageToolbar/ImageToolbarContainer";
import MobileTextToolbarContainer from "./MobileControllers/MobileTextToolbar/MobiletextToolbarContainer";
import VistaDeLaPrenda, { type VistaActual } from "./VistaDeLaPrenda";

export default function MobileDesignerShell({
	product,
	fotosReales,
	onVolverAlCatalogo,
}: {
	product: ProductTemplate;
	fotosReales: FotoRealDePrenda[];
	onVolverAlCatalogo: () => void;
}) {
	const { activeSide, setActiveSide } = useDesigner();
	/* El modo vive AQUÍ y no en la cabecera, que es donde estaba.
	   Allí era estado local suyo: el botón se pintaba de otro color y no lo leía
	   nadie, así que "Previsualizar" no hacía nada. Es el mismo sitio donde lo
	   tiene el escritorio, y por el mismo motivo: quien lo consume es el lienzo,
	   no el botón. */
	const [modo, setModo] = useState<ModoDelEditor>("editar");
	const probando = modo === "probar";
	/* Zoom propio para "Probar", igual que en escritorio: compartir el del
	   lienzo movería la cámara del editor al ir a mirar. */
	const mirar = useZoomDeVista();
	/* Qué combinación se está mirando, para poder bajarla. Antes iba un
	   `onVista={() => {}}`: la vista lo reportaba y nadie lo recogía, así que en
	   el teléfono no había forma de descargar la imagen. */
	const [vista, setVista] = useState<VistaActual | null>(null);
	const descargar = useDescargarVista(vista);
	const esTaza =
		product.sides.includes("wrap") &&
		product.forma !== "cono" &&
		/\b(tazas?|mugs?)\b/i.test(product.name ?? "");
	const medidaWrap = product.printSides?.find((s) => s.sideKey === "wrap");

	return (
		<div
			className="
    fixed inset-0       /* 🔒 evita scroll del viewport */
    w-full
    h-[calc(var(--vh,1vh)*100)]
    flex flex-col
    overflow-hidden
    bg-[#f2f3ea]
  "
		>
			{/* 🔙 Header superior */}
			<DesignerHeaderMobile
				modo={modo}
				onModo={setModo}
				onVolver={onVolverAlCatalogo}
			/>

			{/* 🎨 Canvas */}
			<div className="flex-1 relative flex items-center justify-center bg-[#f2f3ea]">
				{product.sides.map((side) => (
					<DesignerCanvasSide key={side} side={side} product={product} />
				))}
				{/* Los lienzos siguen montados debajo: desmontarlos perdería el
				    diseño, que sólo vive ahí. Esto se pinta encima con fondo opaco. */}
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
						onAcercar={mirar.acercar}
						onAlejar={mirar.alejar}
						onReiniciarZoom={mirar.reiniciar}
						onDescargar={vista ? descargar : undefined}
						onVista={setVista}
					/>
				)}

				{/* Lo que EDITA no pinta nada en "Probar". */}
				{!probando && (
					<>
						<MobileTextToolbarContainer openFontDrawer={() => {}} />
						<MobileImageToolbarContainer />
					</>
				)}
			</div>

			<DesignerSideSwitcher
				currentSide={activeSide}
				sides={product.sides}
				product={product}
				onChange={setActiveSide}
			/>

			{/* 🧰 Toolbar inferior. En "Probar" no hay nada que editar. */}
			{!probando && <DesignerToolbarMobile />}

			<DesignerNoticeModal />
		</div>
	);
}
