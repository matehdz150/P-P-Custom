"use client";

import { uploadImage } from "@/lib/api/uploads";
import { Button } from "@/components/ui/button";

type Props = {
	sides: string[];
	value: Record<string, string>;
	onChange: (next: Record<string, string>) => void;
};

export function TemplateMockupsSection({ sides, value, onChange }: Props) {
	async function onFile(side: string, file: File) {
		const res = await uploadImage(file);

		onChange({
			...value,
			[side]: res.url,
		});
	}

	return (
		<div className="space-y-4">
			<h3 className="font-semibold">Mockups por lado</h3>

			{sides.map((side) => (
				<div key={side} className="border rounded p-4 space-y-2">
					<div className="font-medium capitalize">{side}</div>

					{value[side] && (
						<img
							src={value[side]}
							alt={side}
							className="h-40 object-contain border rounded"
						/>
					)}

					<input
						type="file"
						accept="image/*"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) onFile(side, file);
						}}
					/>
				</div>
			))}
		</div>
	);
}
