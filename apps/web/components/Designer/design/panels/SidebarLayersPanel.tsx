"use client";

import { type FabricObject, Textbox } from "fabric";
import { Image as ImageIcon, Trash, Type } from "lucide-react";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { RemoveObjectCommand } from "@/lib/history/commands/RemoveObjectCommand";

interface LayerItem {
	obj: FabricObject;
}

export default function SidebarLayersPanel({ close }: { close: () => void }) {
	const { getCanvas, activeObject, setActiveObject } = useDesigner();
	const { execute } = useHistory();

	const [layers, setLayers] = useState<LayerItem[]>([]);

	useEffect(() => {
		const canvas = getCanvas();
		if (!canvas) return;

		const updateLayers = () => {
			// Tomamos SOLO objetos seleccionables (ignoramos mockups, áreas, etc.)
			const objs = canvas.getObjects().filter((o) => o.selectable !== false);

			// Los invertimos para que el top esté arriba en la lista
			setLayers(
				objs
					.slice()
					.reverse()
					.map((obj) => ({ obj })),
			);
		};

		updateLayers();

		const events = [
			"object:added",
			"object:removed",
			"object:modified",
			"selection:created",
			"selection:updated",
			"selection:cleared",
		] as const;

		events.forEach((ev) => {
			canvas.on(ev, updateLayers);
		});

		return () => {
			events.forEach((ev) => {
				canvas.off(ev, updateLayers);
			});
		};
	}, [getCanvas]);

	const handleSelect = (obj: FabricObject) => {
		const canvas = getCanvas();
		if (!canvas) return;
		canvas.setActiveObject(obj);
		canvas.requestRenderAll();
		setActiveObject(obj);
	};

	const handleDelete = (obj: FabricObject) => {
		execute(new RemoveObjectCommand(obj));
		if (activeObject === obj) {
			setActiveObject(null);
		}
	};

	const renderLabel = (obj: FabricObject) => {
		if (obj instanceof Textbox) {
			const text = (obj.text ?? "").trim();
			return text || "Enter text";
		}
		if (obj.type === "image") return "Image";
		return obj.type || "Layer";
	};

	const renderSubtitle = (obj: FabricObject) => {
		if (obj instanceof Textbox) {
			return obj.fontFamily || undefined;
		}
		return undefined;
	};

	const renderIcon = (obj: FabricObject) => {
		if (obj instanceof Textbox) {
			return <Type size={18} />;
		}
		if (obj.type === "image") {
			return <ImageIcon size={18} />;
		}
		return <div className="w-6 h-6 rounded bg-gray-200" />;
	};

	return (
		<div className="h-full flex flex-col">
			{/* Header */}
			<div className="px-4 py-3 border-b flex items-center justify-between">
				<div>
					<h2 className="text-sm font-semibold text-[#3b3b2f]">
						Variants and layers
					</h2>
					<p className="text-xs text-gray-500">Layers</p>
				</div>

				<button
					type="button"
					onClick={close}
					className="text-gray-500 hover:text-black text-sm"
				>
					✕
				</button>
			</div>

			{/* Lista de layers */}
			<div className="flex-1 overflow-y-auto px-3 py-3">
				{layers.length === 0 && (
					<p className="text-xs text-gray-500">
						No hay capas en este lado todavía.
					</p>
				)}

				<div className="flex flex-col gap-2">
					{layers.map(({ obj }, idx) => {
						const isActive = obj === activeObject;
						const label = renderLabel(obj);
						const subtitle = renderSubtitle(obj);

						return (
							<button
								type="button"
								key={
									(obj as { id?: string | number }).id ??
									obj.type ??
									obj.toString() ??
									idx
								}
								onClick={() => handleSelect(obj)}
								className={`
                  w-full flex items-center justify-between gap-3
                  px-3 py-2 rounded-lg border text-left
                  transition
                  ${
										isActive
											? "border-[#6b6b3a] bg-[#f6f5ee]"
											: "border-gray-200 hover:border-[#a3a380] hover:bg-[#f8f7f2]"
									}
                `}
							>
								<div className="flex items-center gap-3">
									<div
										className={`
                      w-9 h-9 rounded-lg flex items-center justify-center
                      border
                      ${
												isActive
													? "border-[#6b6b3a] bg-white"
													: "border-gray-200 bg-white"
											}
                    `}
									>
										{renderIcon(obj)}
									</div>

									<div className="flex flex-col">
										<span className="text-sm font-medium text-[#3b3b2f]">
											{label}
										</span>
										{subtitle && (
											<span className="text-xs text-gray-500">{subtitle}</span>
										)}
									</div>
								</div>

								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										handleDelete(obj);
									}}
									className="p-1 rounded hover:bg-[#f3e9e4] text-gray-600"
									aria-label="Eliminar capa"
								>
									<Trash size={16} />
								</button>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
