"use client";

import { useEffect } from "react";

export function useFixIOSViewport() {
	useEffect(() => {
		const updateVH = () => {
			const vh = window.innerHeight * 0.01;
			document.documentElement.style.setProperty("--vh", `${vh}px`);
		};

		updateVH();
		window.addEventListener("resize", updateVH);
		window.addEventListener("orientationchange", updateVH);

		return () => {
			window.removeEventListener("resize", updateVH);
			window.removeEventListener("orientationchange", updateVH);
		};
	}, []);
}
