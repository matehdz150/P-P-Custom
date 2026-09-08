"use client";

import { extraPorLados } from "@kustto/precios";
import type { Canvas, FabricObject } from "fabric";
import { useEffect, useMemo, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";

const DEFAULT_RULES = {
	allowText: true,
	allowImages: true,
	maxDesigns: undefined as number | undefined,
	maxColorsPerDesign: undefined as number | undefined,
};

export function useDesignRules() {
	const { config } = useDesigner();
	return config?.rules ?? DEFAULT_RULES;
}

function countDesignElements(
	sides: Record<string, { canvas: Canvas | null }>,
): number {
	let total = 0;
	for (const s of Object.values(sides)) {
		if (s.canvas) {
			total += s.canvas
				.getObjects()
				.filter((o) => o.selectable !== false).length;
		}
	}
	return total;
}

// Guard de límite (maxDesigns). canAdd(n) avisa y devuelve false si excede.
export function useElementGuard() {
	const { sides, config, showNotice } = useDesigner();
	const max = config?.rules?.maxDesigns;

	return {
		max,
		canAdd(n = 1): boolean {
			if (max == null) return true;
			const current = countDesignElements(sides);
			if (current + n > max) {
				showNotice(
					"Límite de elementos alcanzado",
					`Este producto permite un máximo de ${max} elemento(s) de diseño. Elimina alguno para agregar más.`,
				);
				return false;
			}
			return true;
		},
	};
}

// objetos "de diseño" = los que agregó el usuario (no las áreas editables)
function userObjects(canvas: Canvas | null): FabricObject[] {
	if (!canvas) return [];
	return canvas.getObjects().filter((o) => o.selectable !== false);
}

export type PriceLine = {
	label: string;
	detail: string;
	amount: number;
};

export function usePriceBreakdown() {
	const { sides, config } = useDesigner();
	const [version, setVersion] = useState(0);

	const canvases = useMemo(
		() =>
			Object.values(sides)
				.map((s) => s.canvas)
				.filter((c): c is Canvas => !!c),
		[sides],
	);

	// re-calcular cuando cambian objetos en cualquier lado
	useEffect(() => {
		if (canvases.length === 0) return;
		const bump = () => setVersion((v) => v + 1);
		const events = [
			"object:added",
			"object:removed",
			"object:modified",
		] as const;
		for (const c of canvases) {
			for (const ev of events) c.on(ev, bump);
		}
		bump();
		return () => {
			for (const c of canvases) {
				for (const ev of events) c.off(ev, bump);
			}
		};
	}, [canvases]);

	return useMemo(() => {
		const pricing = config?.pricing ?? { basePrice: 0 };

		const ladosEditados: string[] = [];
		let sidesEdited = 0;
		let designElements = 0;
		const colors = new Set<string>();

		for (const [clave, side] of Object.entries(sides)) {
			const objs = userObjects(side.canvas);
			if (objs.length > 0) {
				sidesEdited += 1;
				ladosEditados.push(clave);
			}
			designElements += objs.length;
			for (const o of objs) {
				const fill = (o as { fill?: unknown }).fill;
				if (typeof fill === "string") colors.add(fill.toLowerCase());
			}
		}

		const lines: PriceLine[] = [];
		lines.push({
			label: "Precio base",
			detail: "Producto",
			amount: pricing.basePrice,
		});

		/* DOS CORRECCIONES EN LA MISMA LÍNEA.
		
		   Cobraba `perSidePrice × sidesEdited`, y lo que se cobra de verdad son
		   los lados EXTRA: el primero va en el precio base. Con dos lados este
		   panel decía 120 y el pedido cobraba 60, y quien lo notara lo notaría
		   al pagar. Ahora usa la misma función que `aLinea`.
		
		   Y con ella entra el recargo por lado: una manga deja de sumar lo que
		   suma una espalda. */
		const extra = extraPorLados(ladosEditados, config?.lados ?? [], pricing);
		if (extra > 0) {
			lines.push({
				label: "Lados personalizados",
				detail: `${sidesEdited - 1} extra de ${sidesEdited}`,
				amount: extra,
			});
		}

		if (pricing.perDesignPrice && designElements > 0) {
			lines.push({
				label: "Elementos de diseño",
				detail: `${designElements} × $${pricing.perDesignPrice}`,
				amount: pricing.perDesignPrice * designElements,
			});
		}

		if (pricing.perColorPrice && colors.size > 0) {
			lines.push({
				label: "Colores",
				detail: `${colors.size} × $${pricing.perColorPrice}`,
				amount: pricing.perColorPrice * colors.size,
			});
		}

		const total = lines.reduce((a, l) => a + l.amount, 0);

		return {
			lines,
			total,
			sidesEdited,
			designElements,
			colorsUsed: colors.size,
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sides, config, version]);
}
