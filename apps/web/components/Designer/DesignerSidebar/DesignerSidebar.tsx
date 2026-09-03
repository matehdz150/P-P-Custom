"use client";

import { ArrowLeft, Info, Layers, Shapes, Type, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import SidebarPanelManager from "./panels/SidebarPanelManager";

export default function DesignerSidebar({
	onVolverAlCatalogo,
}: {
	onVolverAlCatalogo: () => void;
}) {
	const [activePanel, setActivePanel] = useState<string | null>("info");

	const toggle = (panel: string) => {
		setActivePanel(activePanel === panel ? null : panel);
	};

	return (
		<>
			{/* LEFT ICON BAR */}
			<div
				className="w-[70px] bg-white text-tinta flex flex-col items-center 
     pt-0  relative z-80 border"
			>
				<SidebarIcon
					icon={<ArrowLeft size={22} />}
					label="Regresar al catálogo"
					onClick={onVolverAlCatalogo}
				/>
				<SidebarIcon
					icon={<Upload size={22} />}
					label="Subir imagen"
					onClick={() => toggle("upload")}
					active={activePanel === "upload"}
				/>
				<SidebarIcon
					icon={<Type size={22} />}
					label="Texto"
					onClick={() => toggle("text")}
					active={activePanel === "text"}
				/>
				<SidebarIcon
					icon={<Shapes size={22} />}
					label="Gráficos y formas"
					onClick={() => toggle("shapes")}
					active={activePanel === "shapes"}
				/>
				<SidebarIcon
					icon={<Layers size={22} />}
					label="Capas"
					onClick={() => toggle("layers")}
					active={activePanel === "layers"}
				/>
				<SidebarIcon
					icon={<Info size={22} />}
					label="Información del producto"
					onClick={() => toggle("info")}
					active={activePanel === "info"}
				/>
			</div>

			{/* RIGHT PANEL */}
			<SidebarPanelManager
				activePanel={activePanel}
				close={() => setActivePanel(null)}
			/>
		</>
	);
}

type SidebarIconProps = {
	icon: ReactNode;
	active?: boolean;
	onClick: () => void;
	label: string;
};

function SidebarIcon({ icon, active, onClick, label }: SidebarIconProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			className={`
		group relative flex h-[60px] w-full items-center justify-center
		transition-colors focus-visible:outline-none focus-visible:ring-2
		focus-visible:ring-inset focus-visible:ring-lima
        ${active ? "bg-tinta text-hueso-suave" : "hover:bg-tinta hover:text-hueso-suave"}
      `}
		>
			{icon}
			<span
				aria-hidden="true"
				className="pointer-events-none invisible absolute left-[calc(100%+12px)] top-1/2 z-[100] -translate-y-1/2 whitespace-nowrap rounded-lg bg-tinta px-3 py-2 font-brand text-[13px] font-semibold leading-none text-hueso opacity-0 shadow-[0_8px_24px_rgba(43,40,18,0.22)] transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
			>
				<span
					aria-hidden="true"
					className="absolute right-full top-1/2 -translate-y-1/2 border-y-[6px] border-r-[7px] border-y-transparent border-r-tinta"
				/>
				{label}
			</span>
		</button>
	);
}
