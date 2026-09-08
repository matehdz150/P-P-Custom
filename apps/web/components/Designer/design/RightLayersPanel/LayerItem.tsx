"use client";

import { type FabricObject, Path, Textbox } from "fabric";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { CurvedText } from "@/lib/fabric/CurvedText";
import { esObjetoGrafico } from "@/lib/fabric/esObjetoGrafico";

import { RemoveObjectCommand } from "@/lib/history/commands/RemoveObjectCommand";

import { getIcon, getLabel, getSubtitle } from "./helpers";
import ImageControls from "./ImageControls";
import ShapeControls from "./ShapeControls";
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
	};

	useEffect(() => {
		setOpen(isActive);
	}, [isActive]);

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
			<AnimatePresence initial={false}>
				{open && (
					<motion.div
						key="content"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{
							height: { duration: 0.25, ease: "easeInOut" },
							opacity: { duration: 0.15 },
						}}
						className="bg-[#fbfaf6] border-t overflow-hidden"
					>
						<div className="py-2">
							{(obj instanceof Textbox || obj instanceof CurvedText) && (
								<TextControls obj={obj} />
							)}
							{esObjetoGrafico(obj) && !(obj instanceof Path) && (
								<ImageControls obj={obj} />
							)}
							{obj instanceof Path && <ShapeControls obj={obj} />}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
