"use client";

import { Image as FabricImage } from "fabric";
import { Copy, FlipHorizontal2, FlipVertical2, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { DuplicateObjectCommand } from "@/lib/history/commands/DuplicateObjectCommand";
// Commands
import { FlipObjectCommand } from "@/lib/history/commands/FlipObjectCommand";
import { RemoveObjectCommand } from "@/lib/history/commands/RemoveObjectCommand";

export default function ImageToolbar() {
	const { activeObject, getCanvas, setActiveObject } = useDesigner();
	const { execute } = useHistory();
	const canvas = getCanvas();

	const [isImage, setIsImage] = useState(false);

	useEffect(() => {
		setIsImage(activeObject instanceof FabricImage);
	}, [activeObject]);

	if (!canvas || !isImage || !activeObject) return null;

	const img = activeObject as FabricImage;

	const flipHorizontal = () => {
		execute(new FlipObjectCommand(img, "flipX"));
	};

	const flipVertical = () => {
		execute(new FlipObjectCommand(img, "flipY"));
	};

	const duplicate = () => {
		execute(new DuplicateObjectCommand(img));
	};

	const remove = () => {
		execute(new RemoveObjectCommand(img));
		setActiveObject(null);
	};

	return (
		<div
			className="
        absolute top-0 left-1/2 -translate-x-1/2
        flex items-center gap-3 w-full py-[1.1rem]
        bg-white/90 border-b z-300 pl-30
      "
		>
			{/* SEPARATOR */}
			<div className="w-px h-8 bg-[#d6d6c8]" />

			{/* FLIP HORIZONTAL */}
			<button
				type="button"
				onClick={flipHorizontal}
				className="p-1 rounded hover:bg-gray-200"
				title="Flip horizontal"
			>
				<FlipHorizontal2 size={22} />
			</button>

			{/* FLIP VERTICAL */}
			<button
				type="button"
				onClick={flipVertical}
				className="p-1 rounded hover:bg-gray-200"
				title="Flip vertical"
			>
				<FlipVertical2 size={22} />
			</button>

			{/* SEPARATOR */}
			<div className="w-px h-8 bg-[#d6d6c8]" />

			{/* DUPLICAR */}
			<button
				type="button"
				onClick={duplicate}
				className="p-1 rounded hover:bg-gray-200"
				title="Duplicate"
			>
				<Copy size={22} />
			</button>

			{/* BORRAR */}
			<button
				type="button"
				onClick={remove}
				className="p-1 rounded hover:bg-gray-200"
				title="Delete"
			>
				<Trash size={22} className="text-black" />
			</button>
		</div>
	);
}
