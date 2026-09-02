"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/* =========================
   TYPES
========================= */

export type CustomizationRules = {
	maxDesigns: number;
	allowText: boolean;
	allowImages: boolean;
	maxColorsPerDesign: number;
};

type Props = {
	value?: CustomizationRules;
	onChange: (next: CustomizationRules) => void;
};

/* =========================
   DEFAULTS
========================= */

const DEFAULT_RULES: CustomizationRules = {
	maxDesigns: 3,
	allowText: true,
	allowImages: true,
	maxColorsPerDesign: 6,
};

/* =========================
   COMPONENT
========================= */

export function CustomizationRulesSection({ value, onChange }: Props) {
	const [rules, setRules] = useState<CustomizationRules>(DEFAULT_RULES);

	/* =========================
     LOAD EXISTING / EMIT DEFAULT
  ========================= */
	useEffect(() => {
		if (value) {
			const merged: CustomizationRules = {
				maxDesigns: value.maxDesigns ?? DEFAULT_RULES.maxDesigns,
				allowText: value.allowText ?? DEFAULT_RULES.allowText,
				allowImages: value.allowImages ?? DEFAULT_RULES.allowImages,
				maxColorsPerDesign:
					value.maxColorsPerDesign ?? DEFAULT_RULES.maxColorsPerDesign,
			};

			setRules(merged);
			onChange(merged); // 🔥 asegura persistencia aunque no edite
		} else {
			onChange(DEFAULT_RULES); // 🔥 emite defaults si no hay valor
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/* =========================
     UPDATE + EMIT
  ========================= */
	function update<K extends keyof CustomizationRules>(
		key: K,
		val: CustomizationRules[K],
	) {
		const next: CustomizationRules = {
			...rules,
			[key]:
				typeof val === "number"
					? Math.max(1, Number.isFinite(val) ? val : 1)
					: val,
		};

		setRules(next);
		onChange(next);
	}

	/* =========================
     UI
  ========================= */

	return (
		<Card className="p-4">
			<h3 className="font-semibold mb-4">Reglas de personalización</h3>

			{/* MAX DESIGNS */}
			<div className="flex items-center justify-between mb-4">
				<Label htmlFor="max-designs">Máximo de diseños por producto</Label>

				<Input
					id="max-designs"
					type="number"
					min={1}
					className="w-24"
					value={rules.maxDesigns}
					onChange={(e) => update("maxDesigns", Number(e.target.value))}
				/>
			</div>

			{/* ALLOW TEXT */}
			<div className="flex items-center justify-between mb-4">
				<Label htmlFor="allow-text">Permitir texto</Label>

				<Switch
					id="allow-text"
					checked={rules.allowText}
					onCheckedChange={(v) => update("allowText", v)}
				/>
			</div>

			{/* ALLOW IMAGES */}
			<div className="flex items-center justify-between mb-4">
				<Label htmlFor="allow-images">Permitir imágenes</Label>

				<Switch
					id="allow-images"
					checked={rules.allowImages}
					onCheckedChange={(v) => update("allowImages", v)}
				/>
			</div>

			{/* MAX COLORS */}
			<div className="flex items-center justify-between">
				<Label htmlFor="max-colors">Máx. colores por diseño</Label>

				<Input
					id="max-colors"
					type="number"
					min={1}
					className="w-24"
					value={rules.maxColorsPerDesign}
					onChange={(e) => update("maxColorsPerDesign", Number(e.target.value))}
				/>
			</div>

			<p className="text-xs text-muted-foreground mt-3">
				Estas reglas se guardan como JSON y controlan el editor de diseño.
			</p>
		</Card>
	);
}
