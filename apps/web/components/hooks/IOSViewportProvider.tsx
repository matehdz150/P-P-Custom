"use client";

import { useFixIOSViewport } from "./useFixIOSViewport";

export default function IOSViewportProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	useFixIOSViewport();
	return <>{children}</>;
}
