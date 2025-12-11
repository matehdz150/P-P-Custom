"use client";

import { ArrowLeft, Layers, Type, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import SidebarPanelManager from "./panels/SidebarPanelManager";

export default function DesignerSidebar() {
	const [activePanel, setActivePanel] = useState<string | null>(null);

	const toggle = (panel: string) => {
		setActivePanel(activePanel === panel ? null : panel);
	};

	return (
		<>
			{/* LEFT ICON BAR */}
			<div
				className="w-[70px] bg-white text-black flex flex-col items-center 
     pt-0  relative z-80 border"
			>
				<SidebarIcon
					icon={<ArrowLeft size={22} />}
					label="Volver"
					onClick={() => toggle("upload")}
				/>
				<SidebarIcon
					icon={<Upload size={22} />}
					label="Upload"
					onClick={() => toggle("upload")}
					active={activePanel === "upload"}
				/>
				<SidebarIcon
					icon={<Type size={22} />}
					label="Text"
					onClick={() => toggle("text")}
					active={activePanel === "text"}
				/>
				<SidebarIcon
					icon={<Layers size={22} />}
					label="Layers"
					onClick={() => toggle("layers")}
					active={activePanel === "layers"}
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
	label?: string;
};

function SidebarIcon({ icon, active, onClick, label }: SidebarIconProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			className={`
        w-full h-[60px] flex items-center justify-center
        transition
        ${active ? "bg-[#fe6241]" : "hover:bg-[#fe6241]"}
      `}
		>
			{icon}
		</button>
	);
}
