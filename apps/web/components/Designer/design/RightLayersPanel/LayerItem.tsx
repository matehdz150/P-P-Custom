"use client";

import { FabricImage, type FabricObject, Textbox } from "fabric";
import { ChevronDown, ChevronUp, Trash } from "lucide-react";
import { useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";

import { RemoveObjectCommand } from "@/lib/history/commands/RemoveObjectCommand";

import { getIcon, getLabel, getSubtitle } from "./helpers";
import ImageControls from "./ImageControls";
import TextControls from "./TextControls";

export default function LayerItem({ obj }: { obj: FabricObject }) {
	const { getCanvas, activeObject, setActiveObject } = useDesigner();
	const { execute } = useHistory();

	const [open, setOpen] = useState(false);

	const isActive = obj === activeObject;

	const toggle = () => {
		const canvas = getCanvas();
		if (!canvas) return;

		canvas.setActiveObject(obj);
		canvas.requestRenderAll();
		setActiveObject(obj);

		setOpen(!open);
	};

	return (
		<div className="border border-gray-300 rounded-[0.2rem]">
			{/* HEADER */}
			<button
				type="button"
				onClick={toggle}
				className={`flex w-full items-center justify-between px-3 py-4 cursor-pointer ${
					isActive ? "bg-[#f6f5ee]" : "bg-white"
				}`}
			>
				<div className="flex items-center gap-3">
					{/* ICON */}
					<div className="w-8 h-8 flex items-center justify-center border rounded bg-white">
						{getIcon(obj)}
					</div>

					{/* LABEL */}
					<div>
						<p className="text-sm font-medium">{getLabel(obj)}</p>
						<p className="text-xs text-gray-500">{getSubtitle(obj)}</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{/* DELETE */}
					<Trash
						size={16}
						className="text-gray-500 hover:text-red-600"
						onClick={(e) => {
							e.stopPropagation();
							execute(new RemoveObjectCommand(obj));
						}}
					/>

					{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
				</div>
			</button>

			{/* PANEL CONTENT */}
			{open && (
				<div className="bg-[#fbfaf6] border-t">
					{obj instanceof Textbox && <TextControls obj={obj} />}
					{obj instanceof FabricImage && <ImageControls obj={obj} />}
				</div>
			)}
		</div>
	);
}
