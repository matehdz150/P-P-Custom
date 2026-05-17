"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EditableArea } from "@/lib/api/templates";
import {
	CANVAS_H,
	CANVAS_W,
	MOCKUP_W,
	MockupAreaEditor,
} from "./MockupAreaEditor";

type Props = {
	value?: EditableArea[];
	onChange: (areas: EditableArea[]) => void;
	mockup?: string;
};

export function EditableAreasSection({
	value = [],
	onChange,
	mockup,
}: Props) {
	const [id, setId] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	// mantener una selección válida
	useEffect(() => {
		if (value.length && !value.some((a) => a.id === selectedId)) {
			setSelectedId(value[0].id);
		}
		if (!value.length && selectedId) setSelectedId(null);
	}, [value, selectedId]);

	function add() {
		const trimmed = id.trim();
		if (!trimmed) return;
		if (value.some((a) => a.id === trimmed)) {
			alert("Ya existe un área con ese ID");
			return;
		}
		// por defecto: centrada en el canvas, tamaño visible
		const w = 360;
		const h = 360;
		onChange([
			...value,
			{
				id: trimmed,
				type: "rect",
				left: Math.round(CANVAS_W / 2 - w / 2),
				top: Math.round(CANVAS_H / 2 - h / 2),
				width: w,
				height: h,
			},
		]);
		setSelectedId(trimmed);
		setId("");
	}

	function patch(areaId: string, p: Partial<EditableArea>) {
		onChange(value.map((a) => (a.id === areaId ? { ...a, ...p } : a)));
	}

	function update(areaId: string, field: keyof EditableArea, val: number) {
		patch(areaId, { [field]: Number.isFinite(val) ? val : 0 });
	}

	function remove(areaId: string) {
		onChange(value.filter((a) => a.id !== areaId));
	}

	// estimar rect del mockup (asumiendo cuadrado si aún no carga); el editor
	// visual usa la proporción real, esto es solo para el botón de ayuda
	function fitToMockup(areaId: string) {
		const mW = MOCKUP_W;
		const mH = MOCKUP_W; // aproximado; ajusta visualmente luego si hace falta
		patch(areaId, {
			left: Math.round(CANVAS_W / 2 - mW / 2),
			top: Math.round(CANVAS_H / 2 - mH / 2),
			width: mW,
			height: mH,
		});
	}

	function centerArea(areaId: string) {
		const a = value.find((x) => x.id === areaId);
		if (!a) return;
		patch(areaId, {
			left: Math.round(CANVAS_W / 2 - a.width / 2),
			top: Math.round(CANVAS_H / 2 - a.height / 2),
		});
	}

	return (
		<div className="space-y-4">
			<h5 className="font-medium">Áreas editables</h5>

			<p className="text-xs text-muted-foreground">
				Arrastra el recuadro naranja sobre el mockup y usa los tiradores
				para ajustar el área imprimible. Los números se actualizan solos.
			</p>

			{/* EDITOR VISUAL */}
			<MockupAreaEditor
				mockup={mockup}
				areas={value}
				selectedId={selectedId}
				onSelect={setSelectedId}
				onChange={patch}
			/>

			{/* AGREGAR ÁREA */}
			<div className="flex gap-2">
				<Input
					placeholder="ID del área (ej. front-main)"
					value={id}
					onChange={(e) => setId(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							add();
						}
					}}
				/>
				<Button type="button" onClick={add}>
					Agregar área
				</Button>
			</div>

			{/* LISTA / EDICIÓN NUMÉRICA */}
			{value.map((a) => {
				const isSel = a.id === selectedId;
				return (
					<div
						role="button"
						tabIndex={0}
						key={a.id}
						onClick={() => setSelectedId(a.id)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setSelectedId(a.id);
							}
						}}
						className={`w-full text-left rounded-md border p-3 space-y-2 transition cursor-pointer ${
							isSel
								? "border-[#fe6241] bg-[#fe6241]/5"
								: "border-gray-200 hover:border-gray-300"
						}`}
					>
						<div className="flex items-center justify-between">
							<span className="text-sm font-semibold">{a.id}</span>
							<div className="flex gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										fitToMockup(a.id);
									}}
								>
									Ajustar al mockup
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										centerArea(a.id);
									}}
								>
									Centrar
								</Button>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										remove(a.id);
									}}
								>
									Quitar
								</Button>
							</div>
						</div>

						{/* SELECTOR DE FORMA */}
						<div className="flex gap-2">
							{(
								[
									{ t: "rect", label: "▭ Rectángulo" },
									{ t: "ellipse", label: "◯ Óvalo" },
									{ t: "triangle", label: "△ Triángulo" },
								] as const
							).map((opt) => (
								<button
									key={opt.t}
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										patch(a.id, { type: opt.t });
									}}
									className={`flex-1 py-1.5 text-xs rounded border font-medium transition ${
										a.type === opt.t
											? "bg-[#fe6241] text-white border-[#fe6241]"
											: "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
									}`}
								>
									{opt.label}
								</button>
							))}
						</div>

						<div className="grid grid-cols-4 gap-2">
							{(["left", "top", "width", "height"] as const).map(
								(field) => (
									<label key={field} className="flex flex-col gap-1">
										<span className="text-[10px] uppercase text-gray-500">
											{field}
										</span>
										<Input
											type="number"
											value={a[field]}
											onClick={(e) => e.stopPropagation()}
											onChange={(e) =>
												update(a.id, field, Number(e.target.value))
											}
										/>
									</label>
								),
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
