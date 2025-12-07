// apps/web/Contexts/DesignerContext.tsx
"use client";

import type { Canvas, Object as FabricObject } from "fabric";
import { createContext, useContext, useState } from "react";

interface DesignerContextType {
	canvas: Canvas | null;
	setCanvas: (c: Canvas | null) => void;
	activeObject: FabricObject | null;
	setActiveObject: (obj: FabricObject | null) => void;
}

const DesignerContext = createContext<DesignerContextType>({
	canvas: null,
	setCanvas: () => {},
	activeObject: null,
	setActiveObject: () => {},
});

export function DesignerProvider({ children }: { children: React.ReactNode }) {
	const [canvas, setCanvas] = useState<Canvas | null>(null);
	const [activeObject, setActiveObject] = useState<FabricObject | null>(null);

	return (
		<DesignerContext.Provider
			value={{ canvas, setCanvas, activeObject, setActiveObject }}
		>
			{children}
		</DesignerContext.Provider>
	);
}

export function useDesigner() {
	return useContext(DesignerContext);
}
