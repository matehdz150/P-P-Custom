// hooks/useFabricMockup.ts
"use client";

import { type Canvas, Image as FabricImage } from "fabric";
import { useEffect, useRef, useState } from "react";

export function useFabricMockup(
	getCanvas: () => Canvas | null,
	mockupUrl?: string,
	debugDelayMs = 0,
) {
	const [isLoading, setIsLoading] = useState(false);

	// ✅ evita bucle por identidad cambiante de getCanvas()
	const getCanvasRef = useRef(getCanvas);
	useEffect(() => {
		getCanvasRef.current = getCanvas;
	}, [getCanvas]);

	// ✅ evita recargar si ya cargaste este url
	const lastLoadedUrlRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (!mockupUrl) return;
		if (lastLoadedUrlRef.current === mockupUrl) return;

		let cancelled = false;
		let timeoutId: number | null = null;

		const run = () => {
			const canvas = getCanvasRef.current();
			if (!canvas) {
				// si aún no existe canvas, reintenta en el siguiente frame
				requestAnimationFrame(() => {
					if (!cancelled) run();
				});
				return;
			}

			queueMicrotask(() => {
				if (!cancelled) setIsLoading(true);
			});

			FabricImage.fromURL(mockupUrl)
				.then((img) => {
					if (cancelled) return;

					img.scaleToWidth(700);
					img.originX = "center";
					img.originY = "center";
					img.left = canvas.getWidth() / 2;
					img.top = canvas.getHeight() / 2;
					img.selectable = false;

					canvas.backgroundImage = img;
					canvas.requestRenderAll();

					lastLoadedUrlRef.current = mockupUrl;
				})
				.finally(() => {
					const finish = () => {
						if (!cancelled) setIsLoading(false);
					};

					if (debugDelayMs > 0) {
						timeoutId = window.setTimeout(finish, debugDelayMs);
					} else {
						queueMicrotask(finish);
					}
				});
		};

		run();

		return () => {
			cancelled = true;
			if (timeoutId) window.clearTimeout(timeoutId);
		};
	}, [mockupUrl, debugDelayMs]);

	return { isLoading };
}
