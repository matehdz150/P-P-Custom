"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

/* =========================
   TYPES
========================= */

type EditableArea = {
	id: string;
	type: "rect" | "ellipse" | "triangle";
	left: number;
	top: number;
	width: number;
	height: number;
};

type ProductPrintSide = {
	sideKey: string;
	widthCm: number;
	heightCm: number;
	dpi?: number;
	enabled?: boolean;
};

type TemplateData = {
	sides: string[];
	sideLabels: Record<string, string>;
	mockups: Record<string, string>;
	editableAreas: Record<string, EditableArea[]>;
};

type Props = {
	templateData?: TemplateData; // ⬅️ ahora es opcional
	value: ProductPrintSide[];
	onChange: (next: ProductPrintSide[]) => void;
};

/* =========================
   COMPONENT
========================= */

export function PrintSidesSection({ templateData, value, onChange }: Props) {
	if (!templateData) {
		return (
			<section className="border p-4 rounded">
				<h3 className="font-semibold">Áreas de impresión</h3>
				<p className="text-sm text-muted-foreground">
					Selecciona un template para configurar las áreas de impresión
				</p>
			</section>
		);
	}

	function toggle(side: string) {
		const exists = value.some((s) => s.sideKey === side);

		onChange(
			exists
				? value.filter((s) => s.sideKey !== side)
				: [...value, { sideKey: side, widthCm: 30, heightCm: 40, dpi: 300 }],
		);
	}

	const enabledSides = value.map((s) => s.sideKey);

	return (
		<section className="border p-4 rounded space-y-4">
			<h3 className="font-semibold">Áreas de impresión</h3>

			<div className="flex gap-2 flex-wrap">
				{templateData.sides.map((side) => (
					<Button
						key={side}
						type="button"
						variant={enabledSides.includes(side) ? "default" : "outline"}
						onClick={() => toggle(side)}
					>
						{templateData.sideLabels[side] ?? side}
					</Button>
				))}
			</div>
		</section>
	);
}
