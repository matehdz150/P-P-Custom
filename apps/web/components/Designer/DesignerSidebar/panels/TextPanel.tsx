"use client";

import { Textbox } from "fabric";
import { ChevronDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { AVAILABLE_FONTS } from "@/lib/fabric/fontList";

export default function SidebarTextPanel({ close }: { close: () => void }) {
	const { getCanvas, setActiveObject } = useDesigner();

	const [search, setSearch] = useState("");

	// -------------------------
	// 🔍 FILTER FONTS
	// -------------------------
	const filteredFonts = useMemo(() => {
		if (!search.trim()) return AVAILABLE_FONTS;

		return AVAILABLE_FONTS.filter(
			(font) =>
				font.label.toLowerCase().includes(search.toLowerCase()) ||
				font.family.toLowerCase().includes(search.toLowerCase()),
		);
	}, [search]);

	// -------------------------
	// ADD TEXT
	// -------------------------
	const addTextWithFont = (font: string) => {
		const canvas = getCanvas();
		if (!canvas) return;

		const text = new Textbox("Nuevo texto", {
			left: canvas.getWidth() / 2,
			top: canvas.getHeight() / 2,
			originX: "center",
			originY: "center",
			fontSize: 32,
			fontFamily: font,
			fill: "#000",
		});

		canvas.add(text);
		canvas.setActiveObject(text);
		canvas.requestRenderAll();
		setActiveObject(text);
	};

	return (
		<div className="h-[80%] flex flex-col">
			{/* HEADER */}
			<div className="p-6 flex justify-between items-center border-b bg-white">
				<h2 className="font-semibold text-xl text-black">Añadir texto</h2>
				<button type="button" onClick={close}>
					<X size={22} />
				</button>
			</div>

			{/* CONTENT (scrollable) */}
			<div className="flex-1 overflow-y-auto p-6">
				{/* Search */}
				<div className="mb-4">
					<input
						type="text"
						placeholder="Buscar fuentes"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full px-4 py-2 rounded-[0.2rem] border text-sm bg-[#faf9f5] placeholder:text-gray-500"
					/>
				</div>

				{/* Fonts Section */}
				<h3 className="mt-8 mb-2 text-md font-semibold">Fuentes</h3>

				<div className="space-y-1 pb-10">
					{filteredFonts.length === 0 && (
						<p className="text-sm text-gray-500">No fonts found.</p>
					)}

					{filteredFonts.map((font) => (
						<button
							key={font.family}
							type="button"
							onClick={() => addTextWithFont(font.family)}
							className="
              w-full flex justify-between items-center
              px-3 py-3 rounded-[0.2rem] hover:bg-neutral-100 transition
              text-left
            "
						>
							<span style={{ fontFamily: font.family }} className="text-[15px]">
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
