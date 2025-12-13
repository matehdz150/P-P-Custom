// hooks/useMobileTextareaFix.ts
"use client";

import type { Canvas } from "fabric";
import { useEffect } from "react";

export function useMobileTextareaFix(canvas: Canvas | null, isMobile: boolean) {
	useEffect(() => {
		if (!canvas || !isMobile) return;

		const fix = () => {
			const textarea = document.querySelector(
				'textarea[data-fabric="textarea"]',
			) as HTMLTextAreaElement | null;

			if (!textarea) return;

			textarea.style.position = "fixed";
			textarea.style.left = "100px";
			textarea.style.top = "120px";
			textarea.style.width = "1px";
			textarea.style.height = "1px";
			textarea.style.opacity = "0";
			textarea.style.zIndex = "-1";
			textarea.style.transform = "none";
			textarea.style.fontSize = "16px";
		};

		const onEnter = () => requestAnimationFrame(fix);
		canvas.on("text:editing:entered", onEnter);

		return () => {
			canvas.off("text:editing:entered", onEnter);
		};
	}, [canvas, isMobile]);
}
