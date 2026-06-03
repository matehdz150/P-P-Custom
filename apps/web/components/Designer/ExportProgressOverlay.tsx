"use client";

export default function ExportProgressOverlay({
	open,
	progress,
}: {
	open: boolean;
	progress: { done: number; total: number };
}) {
	if (!open) return null;
	const pct =
		progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
			<div className="w-[320px] max-w-[88vw] rounded-2xl bg-white px-6 py-7 text-center shadow-2xl">
				<div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-[3px] border-[#eee] border-t-[#1a1a1a]" />
				<p className="text-[15px] font-bold text-[#1a1a1a]">
					Preparando tu diseño en alta calidad
				</p>
				<p className="mt-1 text-[12px] text-[#888]">
					{progress.total > 0
						? `Subiendo archivos… ${progress.done}/${progress.total}`
						: "Generando componentes…"}
				</p>
				<div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#f0f0f0]">
					<div
						className="h-full rounded-full bg-[#1a1a1a] transition-all duration-300"
						style={{ width: `${progress.total > 0 ? pct : 15}%` }}
					/>
				</div>
			</div>
		</div>
	);
}
