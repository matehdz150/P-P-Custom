"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { uploadImage } from "@/lib/api/uploads";

type Props = {
	value?: string;
	onChange: (url: string) => void;
};

export function SideMockupUploader({ value, onChange }: Props) {
	const inputId = useId();
	const [uploading, setUploading] = useState(false);

	async function handleFile(file: File) {
		setUploading(true);
		try {
			const res = await uploadImage(file);
			onChange(res.url);
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
		</div>
	);
}
