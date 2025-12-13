"use client";

import type { Canvas } from "fabric";
import { Point } from "fabric";
import { useEffect } from "react";

type Options = {
	minZoom?: number;
	maxZoom?: number;
};

export function useMobilePanZoomGesture(
	canvas: Canvas | null,
	enabled: boolean,
	opts: Options = {},
) {
	const minZoom = opts.minZoom ?? 0.3;
	const maxZoom = opts.maxZoom ?? 3;

	useEffect(() => {
		if (!enabled) return;
		if (!canvas) return;

		const el = canvas.upperCanvasEl;
		if (!el) return;

		// 🔑 Evita que el navegador haga scroll/zoom de página sobre el canvas (Android / browsers modernos)
		// 🔑 Evita scroll / zoom del navegador
		el.style.setProperty("touch-action", "none");

		let isTwoFinger = false;
		let lastDist = 0;
		let lastMid: { x: number; y: number } | null = null;

		const clamp = (z: number) => Math.min(Math.max(z, minZoom), maxZoom);

		const getMid = (t1: Touch, t2: Touch) => ({
			x: (t1.clientX + t2.clientX) / 2,
			y: (t1.clientY + t2.clientY) / 2,
		});

		const getDist = (t1: Touch, t2: Touch) =>
			Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length === 2) {
				isTwoFinger = true;

				// opcional: evita selección rara mientras haces gesto
				canvas.discardActiveObject();
				canvas.selection = false;

				const [t1, t2] = [e.touches[0], e.touches[1]];
				lastDist = getDist(t1, t2);
				lastMid = getMid(t1, t2);

				e.preventDefault();
			}
		};

		const onTouchMove = (e: TouchEvent) => {
			if (!isTwoFinger) return;
			if (e.touches.length !== 2) return;

			const [t1, t2] = [e.touches[0], e.touches[1]];
			const mid = getMid(t1, t2);
			const dist = getDist(t1, t2);

			// 1) PAN (deslizamiento con 2 dedos)
			if (lastMid) {
				const dx = mid.x - lastMid.x;
				const dy = mid.y - lastMid.y;

				// relativePan opera en píxeles de pantalla -> perfecto para gesture
				canvas.relativePan(new Point(dx, dy));
			}

			// 2) ZOOM (pinch)
			if (lastDist) {
				const zoom = canvas.getZoom();
				const scale = dist / lastDist;
				const nextZoom = clamp(zoom * scale);

				// zoom around the midpoint
				const pe = new PointerEvent("pointermove", {
					clientX: mid.x,
					clientY: mid.y,
					pointerType: "touch",
				});

				// ✅ evita "any": usa unknown
				const pointer = canvas.getPointer(pe as unknown as PointerEvent);
				canvas.zoomToPoint(pointer, nextZoom);
			}

			lastDist = dist;
			lastMid = mid;

			canvas.requestRenderAll();
			e.preventDefault();
		};

		const onTouchEnd = () => {
			if (isTwoFinger) {
				isTwoFinger = false;
				lastDist = 0;
				lastMid = null;

				// restaurar selección
				canvas.selection = true;
			}
		};

		el.addEventListener("touchstart", onTouchStart, { passive: false });
		el.addEventListener("touchmove", onTouchMove, { passive: false });
		el.addEventListener("touchend", onTouchEnd);
		el.addEventListener("touchcancel", onTouchEnd);

		return () => {
			el.removeEventListener("touchstart", onTouchStart);
			el.removeEventListener("touchmove", onTouchMove);
			el.removeEventListener("touchend", onTouchEnd);
			el.removeEventListener("touchcancel", onTouchEnd);
		};
	}, [canvas, enabled, minZoom, maxZoom]);
}
