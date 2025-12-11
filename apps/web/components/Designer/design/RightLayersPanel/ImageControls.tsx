"use client";

import type { FabricImage } from "fabric";
import { useId } from "react";
import { useHistory } from "@/Contexts/HistoryContext";
import OpacityControl from "@/components/Icons/OpacityControls";
import RotationInput from "@/components/Icons/RotateControls";
import { Checkbox } from "@/components/ui/checkbox";
import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";

export default function ImageControls({ obj }: { obj: FabricImage }) {
	const { execute } = useHistory();
	const visibilityId = useId();

	return (
		<div className="pl-14 pr-4 pb-4 mt-2 space-y-4">
			{/* OPACITY */}
			<OpacityControl
				value={obj.opacity ?? 1}
				onChange={(v) => execute(new ChangePropertyCommand(obj, "opacity", v))}
			/>

			{/* ROTATE */}
			<RotationInput obj={obj} />

			{/* VISIBILITY */}
			<div className="flex items-center gap-3">
				<Checkbox
					id={visibilityId}
					checked={obj.visible}
					onCheckedChange={(checked) => {
						// shadcn devuelve true | false | "indeterminate"
						const value = checked === true;
						execute(new ChangePropertyCommand(obj, "visible", value));
					}}
				/>
				<label className="text-sm font-medium" htmlFor={visibilityId}>
					Visible
				</label>
			</div>
		</div>
	);
}
