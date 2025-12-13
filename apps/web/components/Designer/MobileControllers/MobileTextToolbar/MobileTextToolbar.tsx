"use client";

import type { Textbox } from "fabric";
import { Bold, Copy, Italic, Trash2 } from "lucide-react";
import { useState } from "react";
import { DEFAULT_COLORS } from "@/lib/fabric/defaultColors";
import { ColorPickerButton } from "./ColorPickerButton";
import { ColorPickerPanel } from "./ColorPickerPanel";
import { FontCombobox } from "./FontCombobox";
import { FontSizeCombobox } from "./FontSizeCombobox";
import { TextAlignGroup } from "./TextAlignGroup";
import { TextToggleButton } from "./TextToggleButton";

function normalizeAlign(
	value: string | undefined,
): "left" | "center" | "right" {
	if (value === "center" || value === "right") return value;
	return "left";
}

export default function MobileTextToolbar({
	text,
	apply,
	onDuplicate,
	onRemove,
}: {
	text: Textbox;
	openFontDrawer: () => void;
	apply: (props: Record<string, unknown>) => void;
	onDuplicate: () => void;
	onRemove: () => void;
}) {
	const [showColorPanel, setShowColorPanel] = useState(false);

	const currentColor = typeof text.fill === "string" ? text.fill : "#000000";

	return (
		<>
			<div
				className={`
    relative
    bg-white rounded-[0.2rem]
    px-2 py-2
	border

    flex flex-nowrap items-center gap-2
    w-full max-w-[92vw]

    whitespace-nowrap

    ${
			showColorPanel
				? "overflow-x-hidden overscroll-x-none touch-none"
				: "overflow-x-auto overscroll-x-contain touch-pan-x"
		}
  `}
				style={{ WebkitOverflowScrolling: "touch" }}
			>
				{/* Fuente */}
				<div className="shrink-0">
					<FontCombobox
						value={text.fontFamily ?? "Inter"}
						onChange={(font) => apply({ fontFamily: font })}
					/>
				</div>

				{/* Font size */}
				<div className="shrink-0">
					<FontSizeCombobox
						value={(text.fontSize ?? 32) as number}
						onChange={(size: number) => apply({ fontSize: size })}
					/>
				</div>

				{/* Bold / Italic */}
				<div className="shrink-0 flex gap-1">
					<TextToggleButton
						active={text.fontWeight === "bold"}
						ariaLabel="Negritas"
						onClick={() =>
							apply({
								fontWeight: text.fontWeight === "bold" ? "normal" : "bold",
							})
						}
					>
						<Bold size={18} strokeWidth={2.5} />
					</TextToggleButton>

					<TextToggleButton
						active={text.fontStyle === "italic"}
						ariaLabel="Itálica"
						onClick={() =>
							apply({
								fontStyle: text.fontStyle === "italic" ? "normal" : "italic",
							})
						}
					>
						<Italic size={18} strokeWidth={2.5} />
					</TextToggleButton>
				</div>

				{/* Align */}
				<div className="shrink-0">
					<TextAlignGroup
						value={normalizeAlign(text.textAlign)}
						onChange={(align) => apply({ textAlign: align })}
					/>
				</div>

				{/* Color */}
				<ColorPickerButton
					color={currentColor}
					active={showColorPanel}
					onClick={() => setShowColorPanel((s) => !s)}
				/>

				{/* Duplicate */}
				<button type="button" className="shrink-0 px-2" onClick={onDuplicate}>
					<Copy size={22} />
				</button>

				{/* Delete */}
				<button type="button" className="shrink-0 px-2" onClick={onRemove}>
					<Trash2 size={22} />
				</button>
			</div>
			<div className="relative">
				{showColorPanel && (
					<div className="absolute top-full right-0  z-5000">
						<ColorPickerPanel
							colors={DEFAULT_COLORS}
							value={currentColor}
							onChange={(color) => {
								apply({ fill: color });
							}}
						/>
					</div>
				)}
			</div>
		</>
	);
}
