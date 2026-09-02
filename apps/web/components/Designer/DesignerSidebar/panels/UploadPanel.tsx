"use client";

import { HardDrive, ImageOff, Upload, X } from "lucide-react";
import { useAddImage } from "@/components/Designer/hooks/useAddImage";
import { useDesignRules } from "@/components/Designer/hooks/useProductConfig";

export default function SidebarUploadPanel({ close }: { close: () => void }) {
	const { addImage } = useAddImage();
	const { allowImages } = useDesignRules();

	const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) addImage(file);
	};

	return (
		<div className="p-6 h-full overflow-y-auto">
			<div className="flex justify-between items-center mb-4">
				<h2 className="font-semibold text-lg">New upload</h2>
				<button type="button" onClick={close}>
					<X size={20} />
				</button>
			</div>

			{!allowImages ? (
				<div className="border border-dashed rounded-xl p-8 text-center flex flex-col items-center gap-3 text-neutral-500">
					<ImageOff size={36} />
					<p className="font-medium text-neutral-700">
						Este producto no permite imágenes
					</p>
					<p className="text-sm">
						El proveedor configuró este producto para personalizarse solo con
						texto.
					</p>
				</div>
			) : (
				<>
					{/* ZONA DE DROP */}
					<div className="border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center">
						<Upload size={40} className="mx-auto mb-2 text-neutral-500" />
						<p className="text-neutral-600">Drag & drop your image here</p>
						<p className="text-neutral-400 text-sm mb-4">or</p>

						<label className="cursor-pointer inline-block bg-tinta text-hueso-suave px-4 py-2 rounded-lg text-sm">
							Upload from device
							<input
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleFileInput}
							/>
						</label>
					</div>

					{/* OTRAS OPCIONES */}
					<div className="mt-6 space-y-3">
						<label className="w-full border p-3 rounded-lg flex items-center gap-3 hover:bg-neutral-100 cursor-pointer">
							<HardDrive size={20} />
							My device
							<input
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleFileInput}
							/>
						</label>

						<button
							type="button"
							className="w-full border p-3 rounded-lg hover:bg-neutral-100"
						>
							Dropbox
						</button>

						<button
							type="button"
							className="w-full border p-3 rounded-lg hover:bg-neutral-100"
						>
							Google Drive
						</button>
					</div>
				</>
			)}
		</div>
	);
}
