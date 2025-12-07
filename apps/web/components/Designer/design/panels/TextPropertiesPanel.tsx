"use client";

import type { IText } from "fabric";
import { AVAILABLE_FONTS } from "@/lib/fabric/fontList";

export default function TextPropertiesPanel({ active }: { active: IText }) {
	return (
		<div className="flex flex-col gap-5 p-4">
			<h2 className="font-semibold text-sm">Texto</h2>

			{/* Tamaño */}
			<div>
				<label className="text-xs text-gray-600" htmlFor="text-size">
					Tamaño
				</label>
				<input
					id="text-size"
					type="number"
					className="border p-1 w-full"
					value={active.fontSize ?? 20}
					onChange={(e) => {
						active.set("fontSize", Number(e.target.value));
						active.canvas?.requestRenderAll();
					}}
				/>
			</div>

			{/* Fuente */}
			<div>
				<label className="text-xs text-gray-600" htmlFor="text-font-family">
					Fuente
				</label>
				<select
					id="text-font-family"
					className="border p-1 w-full"
					value={active.fontFamily}
					onChange={(e) => {
						active.set("fontFamily", e.target.value);
						active.setCoords();
						active.canvas?.requestRenderAll();
					}}
				>
					{AVAILABLE_FONTS.map((f) => (
						<option key={f.family} value={f.family}>
							{f.label}
						</option>
					))}
				</select>
			</div>

			{/* Peso */}
			<div>
				<label className="text-xs text-gray-600" htmlFor="text-weight">
					Peso
				</label>
				<select
					id="text-weight"
					className="border p-1 w-full"
					value={active.fontWeight as string}
					onChange={(e) => {
						active.set("fontWeight", e.target.value);
						active.canvas?.requestRenderAll();
					}}
				>
					<option value="normal">Normal</option>
					<option value="bold">Bold</option>
					{[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
						<option key={w} value={String(w)}>
							{w}
						</option>
					))}
				</select>
			</div>

			{/* Color */}
			<div>
				<label className="text-xs text-gray-600" htmlFor="text-color">
					Color
				</label>
				<input
					id="text-color"
					type="color"
					className="border p-1 w-full"
					value={(active.fill as string) ?? "#000000"}
					onChange={(e) => {
						active.set("fill", e.target.value);
						active.canvas?.requestRenderAll();
					}}
				/>
			</div>
		</div>
	);
}
