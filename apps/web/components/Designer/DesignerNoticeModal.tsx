"use client";

import { AlertTriangle } from "lucide-react";
import { useDesigner } from "@/Contexts/DesignerContext";

export default function DesignerNoticeModal() {
	const { notice, clearNotice } = useDesigner();

	if (!notice) return null;

	return (
		<div
			role="presentation"
			onClick={clearNotice}
			className="fixed inset-0 z-[1000] bg-tinta/40 flex items-center justify-center p-4"
		>
			<div
				role="alertdialog"
				aria-modal="true"
				aria-label={notice.title}
				onClick={(e) => e.stopPropagation()}
				className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 flex flex-col items-center text-center gap-3"
			>
				<div className="w-12 h-12 rounded-full bg-tinta/10 flex items-center justify-center">
					<AlertTriangle className="text-tinta" size={24} />
				</div>

				<h2 className="text-lg font-bold text-[#2b2812]">
					{notice.title}
				</h2>
				<p className="text-sm text-gray-500 leading-relaxed">
					{notice.message}
				</p>

				<button
					type="button"
					onClick={clearNotice}
					className="mt-2 w-full py-3 rounded-xl bg-tinta text-hueso-suave font-bold text-sm hover:bg-[#3a3618] transition"
				>
					Entendido
				</button>
			</div>
		</div>
	);
}
