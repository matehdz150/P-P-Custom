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
		if (!enabled || !canvas) return;

		const el = canvas.upperCanvasEl;
		if (!el) return;

		el.style.setProperty("touch-action", "none");

		let isTwoFinger = false;
		let lastDist = 0;
		let lastMid: { x: number; y: number } | null = null;

		// 🔥 velocities for smooth pan + inertia
		let vx = 0;
		let vy = 0;
		let rafId: number | null = null;

		const clamp = (z: number) => Math.min(Math.max(z, minZoom), maxZoom);

		const getMid = (t1: Touch, t2: Touch) => ({
			x: (t1.clientX + t2.clientX) / 2,
			y: (t1.clientY + t2.clientY) / 2,
		});

		const getDist = (t1: Touch, t2: Touch) =>
			Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

		const applyPan = () => {
			const vpt = canvas.viewportTransform;
			if (!vpt) return;

			vpt[4] += vx;
			vpt[5] += vy;
			canvas.requestRenderAll();
		};

		const onTouchStart = (e: TouchEvent) => {
			if (e.touches.length !== 2) return;

			isTwoFinger = true;
			canvas.discardActiveObject();
			canvas.selection = false;

			const [t1, t2] = e.touches;
			lastDist = getDist(t1, t2);
			lastMid = getMid(t1, t2);

			vx = 0;
			vy = 0;

			if (rafId) cancelAnimationFrame(rafId);
			e.preventDefault();
		};

		const onTouchMove = (e: TouchEvent) => {
			if (!isTwoFinger || e.touches.length !== 2) return;

			const [t1, t2] = e.touches;
			const mid = getMid(t1, t2);
			const dist = getDist(t1, t2);

			if (!lastMid || !lastDist) {
				lastMid = mid;
				lastDist = dist;
				return;
			}

			// ----------------
			// 🔵 PAN (smooth)
			// ----------------
			const zoom = canvas.getZoom();
			const dx = (mid.x - lastMid.x) / zoom;
			const dy = (mid.y - lastMid.y) / zoom;

			const SMOOTH = 0.25;
			vx += (dx - vx) * SMOOTH;
			vy += (dy - vy) * SMOOTH;

			if (rafId) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(applyPan);

			// ----------------
			// 🔵 ZOOM
			// ----------------
			const scale = dist / lastDist;
			if (Math.abs(scale - 1) > 0.01) {
				const nextZoom = clamp(zoom * scale);
				const rect = el.getBoundingClientRect();

				const canvasPoint = new Point(mid.x - rect.left, mid.y - rect.top);

				canvas.zoomToPoint(canvasPoint, nextZoom);
			}

			lastMid = mid;
			lastDist = dist;

			e.preventDefault();
		};

		const onTouchEnd = () => {
			if (!isTwoFinger) return;

			isTwoFinger = false;
			lastMid = null;
			lastDist = 0;
			canvas.selection = true;

			// ----------------
			// 🔵 INERTIA
			// ----------------
			const FRICTION = 0.92;

			const inertia = () => {
				vx *= FRICTION;
				vy *= FRICTION;

				if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) {
					vx = 0;
					vy = 0;
					return;
				}

				applyPan();
				requestAnimationFrame(inertia);
			};

			inertia();
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
			if (rafId) cancelAnimationFrame(rafId);
		};
	}, [canvas, enabled, minZoom, maxZoom]);
}
