"use client";

import { Circle, type FabricObject, Rect, Textbox } from "fabric";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { AVAILABLE_FONTS } from "@/lib/fabric/fontList";

export default function MobileAddTextPanel({
	goBack,
	closeDrawer,
}: {
	goBack: () => void;
	closeDrawer: () => void;
}) {
	const { getCanvas, getEditableAreas, setActiveObject } = useDesigner();

	const [search, setSearch] = useState("");

	// 🔍 FILTER FONTS (igual que desktop)
	const filteredFonts = useMemo(() => {
		if (!search.trim()) return AVAILABLE_FONTS;

		return AVAILABLE_FONTS.filter(
			(font) =>
				font.label.toLowerCase().includes(search.toLowerCase()) ||
				font.family.toLowerCase().includes(search.toLowerCase()),
		);
	}, [search]);

	// ➕ Add text with selected font
	const addTextWithFont = (font: string) => {
		const canvas = getCanvas();
		if (!canvas) return;

		const area = getEditableAreas()[0] ?? null;

		const text = new Textbox("Nuevo texto", {
			originX: "center",
			originY: "center",
			fontSize: 32,
			fontFamily: font,
			fill: "#000",
			textAlign: "center",
		});

		let centerX = canvas.getWidth() / 2;
		let centerY = canvas.getHeight() / 2;
		let maxW = 300;

		if (area) {
			const b = area.getBoundingRect();
			centerX = b.left + b.width / 2;
			centerY = b.top + b.height / 2;
			maxW = b.width * 0.8;
		}

		text.set({
			left: centerX,
			top: centerY,
			width: maxW,
		});

		// 🔒 CLIP PATH (IGUAL QUE IMÁGENES / DESKTOP)
		if (area) {
			let clip: FabricObject;

			if (area instanceof Rect) {
				clip = new Rect({
					left: area.left,
					top: area.top,
					width: area.width,
					height: area.height,
					absolutePositioned: true,
				});
			} else if (area instanceof Circle) {
				clip = new Circle({
					left: area.left,
					top: area.top,
					radius: area.radius,
					absolutePositioned: true,
				});
			} else {
				// fallback seguro (no debería pasar en tu sistema)
				return;
			}

			clip.set({ selectable: false, evented: false });
			text.clipPath = clip;

			clip.set({ selectable: false, evented: false });
			text.clipPath = clip;
		}

		canvas.add(text);
		canvas.setActiveObject(text);
		setActiveObject(text);
		canvas.requestRenderAll();

		closeDrawer();
		goBack();
	};

	return (
		<div className="h-full flex flex-col bg-white">
			{/* CONTENT */}
			<div className="flex-1 overflow-y-auto p-4 space-y-6">
				{/* INPUT SEARCH */}
				<input
					type="text"
					placeholder="Buscar fuentes"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="w-full px-4 py-3 rounded-[0.2rem] border text-sm bg-[#faf9f5] placeholder:text-gray-500"
				/>

				{/* LISTA DE FUENTES */}
				<h3 className="text-2xl font-semibold">Fuentes</h3>

				<div className="space-y-1 pb-10">
					{filteredFonts.length === 0 && (
						<p className="text-sm text-gray-500">No se encontraron fuentes.</p>
					)}

					{filteredFonts.map((font) => (
						<button
							key={font.family}
							type="button"
							onClick={() => addTextWithFont(font.family)}
							className="
                w-full flex justify-between items-center
                px-3 py-3 rounded-[0.2rem]
                hover:bg-neutral-100 active:bg-neutral-200
                transition text-left
              "
						>
							<span style={{ fontFamily: font.family }} className="text-[16px]">
								{font.label}
							</span>

							<ChevronDown size={18} className="text-gray-500" />
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
