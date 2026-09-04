"use client";

import { ArrowLeft, Info, Layers, Shapes, Type, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import SidebarPanelManager from "./panels/SidebarPanelManager";

export default function DesignerSidebar({
	onVolverAlCatalogo,
	inhabilitado,
}: {
	onVolverAlCatalogo: () => void;
	/**
	 * En "Probar" no se edita: las herramientas se apagan.
	 *
	 * La flecha de volver NO se apaga con ellas. Es la salida de la pantalla, y
	 * dejar a alguien sin salida por estar mirando cómo le queda sería encerrarlo
	 * en el modo de vista.
	 */
	inhabilitado?: boolean;
}) {
	const [activePanel, setActivePanel] = useState<string | null>("info");
	// Armando una plantilla la flecha no vuelve al catálogo, sino a la
	// plantilla a medio armar; la etiqueta tiene que decirlo o parece una
	// salida en falso.
	const { plantilla } = useDesigner();

	const toggle = (panel: string) => {
		setActivePanel(activePanel === panel ? null : panel);
	};

	/* El panel abierto se cierra al entrar a "Probar" y se recuerda para cuando
	   se vuelva: reabrir "Información del producto" a mano cada vez que uno mira
	   la prenda sería un peaje por mirar. */
	const panelVisible = inhabilitado ? null : activePanel;

	return (
		<>
			{/* LEFT ICON BAR */}
			<div
				className="w-[70px] bg-white text-tinta flex flex-col items-center 
     pt-0  relative z-80 border"
			>
				<SidebarIcon
					icon={<ArrowLeft size={22} />}
					label={plantilla ? "Regresar a la plantilla" : "Regresar al catálogo"}
					onClick={onVolverAlCatalogo}
				/>
				<SidebarIcon
					icon={<Upload size={22} />}
					label="Subir imagen"
					inhabilitado={inhabilitado}
					onClick={() => toggle("upload")}
					active={panelVisible === "upload"}
				/>
				<SidebarIcon
					icon={<Type size={22} />}
					label="Texto"
					inhabilitado={inhabilitado}
					onClick={() => toggle("text")}
					active={panelVisible === "text"}
				/>
				<SidebarIcon
					icon={<Shapes size={22} />}
					label="Gráficos y formas"
					inhabilitado={inhabilitado}
					onClick={() => toggle("shapes")}
					active={panelVisible === "shapes"}
				/>
				<SidebarIcon
					icon={<Layers size={22} />}
					label="Capas"
					inhabilitado={inhabilitado}
					onClick={() => toggle("layers")}
					active={panelVisible === "layers"}
				/>
				<SidebarIcon
					icon={<Info size={22} />}
					label="Información del producto"
					inhabilitado={inhabilitado}
					onClick={() => toggle("info")}
					active={panelVisible === "info"}
				/>
			</div>

			{/* RIGHT PANEL */}
			<SidebarPanelManager
				activePanel={panelVisible}
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
	inhabilitado?: boolean;
};

function SidebarIcon({
	icon,
	active,
	onClick,
	label,
	inhabilitado,
}: SidebarIconProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			disabled={inhabilitado}
			className={`
		disabled:cursor-not-allowed disabled:opacity-35
		disabled:hover:bg-transparent disabled:hover:text-tinta
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
