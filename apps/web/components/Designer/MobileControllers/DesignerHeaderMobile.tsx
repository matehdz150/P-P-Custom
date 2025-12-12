"use client";

import { ArrowLeft, Eye, Pencil } from "lucide-react";
import { useState } from "react";

export default function DesignerHeaderMobile() {
	const [mode, setMode] = useState<"edit" | "preview">("edit");

	return (
		<div className="relative h-20 w-full border-b flex items-center px-4 bg-white rounded-[0.2rem]">
			{/* ⬅ Flecha izquierda */}
			<ArrowLeft className="z-10" />

			{/* 🔘 Botones centrados */}
			<div className="absolute left-1/2 -translate-x-1/2 flex border rounded-[0.2rem] overflow-hidden">
				{/* EDIT BUTTON */}
				<button
					type="button"
					onClick={() => setMode("edit")}
					className={`px-3 py-1.5 ${
						mode === "edit" ? "bg-black text-white" : "bg-white"
					}`}
				>
					<Pencil />
				</button>

				{/* PREVIEW BUTTON */}
				<button
					type="button"
					onClick={() => setMode("preview")}
					className={`px-3 py-1.5 ${
						mode === "preview" ? "bg-black text-white" : "bg-white"
					}`}
				>
					<Eye />
				</button>
			</div>

			{/* 🟧 Botón Guardar alineado a la derecha */}
			<button
				type="button"
				className="ml-auto px-3 py-1.5 bg-[#fe6241] rounded-[0.2rem] font-medium z-10"
			>
				Guardar
			</button>
		</div>
	);
}
