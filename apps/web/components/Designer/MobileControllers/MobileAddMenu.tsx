"use client";

import { Type, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useAddImageLogic } from "../DesignerSidebar/SidebarAddImage";
import MobileAddTextPanel from "./MobileAddTextPanel";

export default function MobileAddMenu({
	closeDrawer,
}: {
	closeDrawer: () => void;
}) {
	const { addImage } = useAddImageLogic();
	const fileRef = useRef<HTMLInputElement | null>(null);

	const [view, setView] = useState<"menu" | "text">("menu");

	if (view === "text") {
		return (
			<MobileAddTextPanel
				goBack={() => setView("menu")}
				closeDrawer={closeDrawer}
			/>
		);
	}

	return (
		<div className="space-y-4">
			{/* MI DISPOSITIVO */}
			<button
				type="button"
				onClick={() => fileRef.current?.click()}
				className="w-full text-left px-4 py-6 border rounded-lg flex gap-3 items-center"
			>
				<Upload />
				Mi dispositivo
			</button>

			<input
				ref={fileRef}
				type="file"
				className="hidden"
				accept="image/*"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) {
						addImage(file);
						closeDrawer(); // 👈 cerrar drawer después de agregar imagen
					}
				}}
			/>

			{/* TEXTO */}
			<button
				type="button"
				onClick={() => setView("text")}
				className="w-full text-left px-4 py-6 border rounded-lg flex gap-3 items-center"
			>
				<Type />
				Texto
			</button>
		</div>
	);
}
