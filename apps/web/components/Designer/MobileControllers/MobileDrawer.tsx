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
	children, // ahora es UNA FUNCIÓN
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

			<DrawerContent className="rounded-t-2xl pb-10">
				<DrawerHeader>
					<DrawerTitle className="text-xl font-semibold">{title}</DrawerTitle>
				</DrawerHeader>

				<div className="px-4 mt-3">
					{children({ closeDrawer })} {/* ← PASANDO la función */}
				</div>
			</DrawerContent>
		</Drawer>
	);
}
