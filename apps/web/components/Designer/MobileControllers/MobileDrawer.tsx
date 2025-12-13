"use client";

import { useState } from "react";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";

export default function MobileDrawer({
	trigger,
	title,
	children,
}: {
	trigger: React.ReactNode;
	title: string;
	children: (controls: { closeDrawer: () => void }) => React.ReactNode;
}) {
	const [open, setOpen] = useState(false);

	const closeDrawer = () => setOpen(false);

	return (
		<Drawer open={open} onOpenChange={setOpen}>
			<DrawerTrigger asChild>{trigger}</DrawerTrigger>

			<DrawerContent className="rounded-t-2xl pb-6 max-h-[85vh]">
				<DrawerHeader className="shrink-0">
					<DrawerTitle className="text-xl font-semibold">{title}</DrawerTitle>
				</DrawerHeader>

				{/* ✅ Área scrolleable */}
				<div
					className="px-4 pb-6 overflow-y-auto overscroll-contain"
					style={{ WebkitOverflowScrolling: "touch" }}
				>
					{children({ closeDrawer })}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
