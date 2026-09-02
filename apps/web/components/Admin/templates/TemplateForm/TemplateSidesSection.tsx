"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
	value: string[];
	onChange: (next: string[]) => void;
};

export function TemplateSidesSection({ value, onChange }: Props) {
	const [side, setSide] = useState("");

	function add() {
		if (!side.trim() || value.includes(side)) return;
		onChange([...value, side.trim()]);
		setSide("");
	}

	function remove(s: string) {
		onChange(value.filter((v) => v !== s));
	}

	return (
		<div className="border p-4 rounded space-y-3">
			<h3 className="font-semibold">Sides</h3>

			<div className="flex gap-2">
				<Input
					placeholder="front, back, sleeve..."
					value={side}
					onChange={(e) => setSide(e.target.value)}
				/>
				<Button type="button" onClick={add}>
					Agregar
				</Button>
			</div>

			<div className="flex gap-2 flex-wrap">
				{value.map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => remove(s)}
						className="px-3 py-1 border rounded text-sm"
					>
						{s} ✕
					</button>
				))}
			</div>
		</div>
	);
}
