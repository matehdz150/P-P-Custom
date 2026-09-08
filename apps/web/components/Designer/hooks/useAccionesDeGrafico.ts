"use client";

import type { FabricObject } from "fabric";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";
import { DuplicateObjectCommand } from "@/lib/history/commands/DuplicateObjectCommand";
import { GroupCommand } from "@/lib/history/commands/GroupCommand";
import { RemoveObjectCommand } from "@/lib/history/commands/RemoveObjectCommand";

export function useAccionesDeGrafico(objeto: FabricObject | null | undefined) {
	const { setActiveObject } = useDesigner();
	const { execute } = useHistory();

	const aplicar = (propiedades: Record<string, unknown>) => {
		if (!objeto) return;
		// Un cambio de tamaño se deshace completo, con ambos ejes juntos.
		execute(
			new GroupCommand(
				Object.entries(propiedades).map(
					([propiedad, valor]) =>
						new ChangePropertyCommand(objeto, propiedad, valor),
				),
			),
		);
	};

	const duplicar = () => {
		if (objeto) execute(new DuplicateObjectCommand(objeto));
	};

	const borrar = () => {
		if (!objeto) return;
		execute(new RemoveObjectCommand(objeto));
		setActiveObject(null);
	};

	return { aplicar, duplicar, borrar };
}
