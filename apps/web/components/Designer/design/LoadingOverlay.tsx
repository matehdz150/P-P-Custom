// components/ui/loading-overlay.tsx
"use client";

import { Spinner } from "@/components/ui/spinner";

export function LoadingOverlay({
	label = "Cargando Producto...",
}: {
	label?: string;
}) {
	return (
		<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#f2f3ea]/70">
			<Spinner className="h-6 w-6 text-gray-600" />
			<p className="text-sm text-gray-600">{label}</p>
		</div>
	);
}
