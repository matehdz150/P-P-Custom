"use client";

import { Layers, Palette, Plus } from "lucide-react";
import MobileAddMenu from "./MobileAddMenu"; // 👈 importar nuevo componente
import MobileDrawer from "./MobileDrawer";

export default function DesignerToolbarMobile() {
	return (
		<div className="h-24 border-t bg-white flex items-start justify-around px-10">
			{/* Diseños */}
			<button
				type="button"
				className="flex flex-col items-center justify-center gap-1 mt-4"
			>
				<Palette size={32} strokeWidth={1.5} />
				<p className="text-l font-medium">Diseños</p>
			</button>

			{/* Drawer con nuestro nuevo contenido */}
			<MobileDrawer
				trigger={
					<button
						type="button"
						className="w-16 h-16 flex items-center justify-center rounded-full bg-black text-white mt-1"
					>
						<Plus size={28} />
					</button>
				}
				title="Agregar diseño"
			>
				{({ closeDrawer }) => <MobileAddMenu closeDrawer={closeDrawer} />}
			</MobileDrawer>

			{/* Capas */}
			<button
				type="button"
				className="flex flex-col items-center justify-center gap-1 mt-4"
			>
				<Layers size={32} strokeWidth={1.5} />
				<p className="text-l font-medium">Capas</p>
			</button>
		</div>
	);
}
