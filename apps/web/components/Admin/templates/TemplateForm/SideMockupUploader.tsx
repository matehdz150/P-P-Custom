"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { subirMockup } from "@/lib/api/uploads";

type Props = {
	value?: string;
	onChange: (url: string) => void;
	/** Con qué llave se guarda en S3: mockups/<templateId>/<side>-… */
	templateId: string;
	side: string;
};

export function SideMockupUploader({
	value,
	onChange,
	templateId,
	side,
}: Props) {
	const inputId = useId();
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleFile(file: File) {
		setUploading(true);
		setError(null);
		try {
			// Devuelve la ruta /mockups/…, no una URL de S3: los mockups se
			// leen desde el mismo origen o el teñido de prenda deja de servir.
			onChange(await subirMockup(file, { templateId, side }));
		} catch (e) {
			setError(e instanceof Error ? e.message : "No se pudo subir");
		} finally {
			setUploading(false);
		}
	}

	return (
		<div className="space-y-2">
			<label className="text-sm font-medium" htmlFor={inputId}>
				Mockup
			</label>

			{value && (
				<div className="relative w-32 h-32 border rounded overflow-hidden bg-[#f2f3ea]">
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={value}
						alt="mockup"
						className="w-full h-full object-contain"
					/>
				</div>
			)}

			<Input
				id={inputId}
				type="file"
				accept="image/*"
				disabled={uploading}
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) handleFile(file);
				}}
			/>

			{uploading && (
				<p className="text-xs text-muted-foreground">Subiendo…</p>
			)}

			{error && <p className="text-xs text-red-600">{error}</p>}
		</div>
	);
}
