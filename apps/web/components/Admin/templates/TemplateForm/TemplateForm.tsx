"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import type {
	ProductTemplateData,
	CreateTemplateInput,
} from "@/lib/api/templates";

import { TemplateSidesSection } from "./TemplateSidesSection";
import { TemplateSideConfig } from "./TemplateSideConfig";
import { JSONPreview } from "./JSONPreview";

const EMPTY_DATA: ProductTemplateData = {
	sides: [],
	sideLabels: {},
	mockups: {},
	editableAreas: {},
};

type Props = {
	initialValue?: CreateTemplateInput;
	onSubmit: (data: CreateTemplateInput) => void;
};

export function TemplateForm({ initialValue, onSubmit }: Props) {
	const [id, setId] = useState(initialValue?.id ?? "");
	const [name, setName] = useState(initialValue?.name ?? "");
	const [data, setData] = useState<ProductTemplateData>(
		initialValue?.data ?? EMPTY_DATA,
	);

	function submit(e: React.FormEvent) {
		e.preventDefault();

		if (!id.trim() || !name.trim()) {
			alert("ID y nombre son obligatorios");
			return;
		}

		if (!data.sides.length) {
			alert("Debe haber al menos un side");
			return;
		}

		for (const side of data.sides) {
			if (!data.sideLabels[side]) {
				alert(`Falta label para ${side}`);
				return;
			}
			if (!data.mockups[side]) {
				alert(`Falta mockup para ${side}`);
				return;
			}
			if (!data.editableAreas[side]?.length) {
				alert(`Falta área editable en ${side}`);
				return;
			}
		}

		onSubmit({
			id: id.trim(),
			name: name.trim(),
			data,
		});
	}

	return (
		<form onSubmit={submit} className="space-y-6 max-w-3xl">
			<Input
				placeholder="ID (ej. tshirt)"
				value={id}
				onChange={(e) => setId(e.target.value)}
				disabled={!!initialValue}
			/>

			<Input
				placeholder="Nombre (ej. Basic T-Shirt)"
				value={name}
				onChange={(e) => setName(e.target.value)}
			/>

			<TemplateSidesSection
				value={data.sides}
				onChange={(sides) =>
					setData((prev) => ({
						...prev,
						sides,
					}))
				}
			/>

			{data.sides.map((side) => (
				<TemplateSideConfig
					key={side}
					side={side}
					label={data.sideLabels[side]}
					mockup={data.mockups[side]}
					areas={data.editableAreas[side]}
					onChange={(partial) =>
						setData((prev) => ({
							...prev,
							sideLabels: {
								...prev.sideLabels,
								...(partial.label !== undefined && {
									[side]: partial.label,
								}),
							},
							mockups: {
								...prev.mockups,
								...(partial.mockup !== undefined && {
									[side]: partial.mockup,
								}),
							},
							editableAreas: {
								...prev.editableAreas,
								...(partial.areas !== undefined && {
									[side]: partial.areas,
								}),
							},
						}))
					}
				/>
			))}

			<JSONPreview data={{ id, name, ...data }} />

			<Button type="submit">Guardar template</Button>
		</form>
	);
}
