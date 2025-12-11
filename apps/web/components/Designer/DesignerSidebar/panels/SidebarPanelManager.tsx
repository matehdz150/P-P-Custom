"use client";

import SidebarLayersPanel from "../../design/panels/SidebarLayersPanel";
import SidebarTextPanel from "./TextPanel";
import SidebarUploadPanel from "./UploadPanel";

export default function SidebarPanelManager({
	activePanel,
	close,
}: {
	activePanel: string | null;
	close: () => void;
}) {
	return (
		<div
			className={`
    fixed left-[70px] top-20 h-full w-[360px] bg-white border-r
    transition-transform duration-200 z-60
    ${activePanel ? "translate-x-0" : "-translate-x-[360px]"}
  `}
		>
			{activePanel === "upload" && <SidebarUploadPanel close={close} />}
			{activePanel === "text" && <SidebarTextPanel close={close} />}
			{activePanel === "layers" && <SidebarLayersPanel close={close} />}
		</div>
	);
}
