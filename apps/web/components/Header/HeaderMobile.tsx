"use client";

import { ChevronDown, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function HeaderMobile() {
	const [openMenu, setOpenMenu] = useState(false);

	const [dropdown, setDropdown] = useState({
		catalog: false,
		how: false,
		services: false,
		support: false,
	});

	const toggleDropdown = (key: keyof typeof dropdown) => {
		setDropdown((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	return (
		<div className="md:hidden relative w-full">
			{/* TOP BAR */}
			<div className="flex items-center justify-between px-4 h-16 border-b w-full">
				{/* MENU LEFT */}
				<div className="flex">
					<button type="button" onClick={() => setOpenMenu(!openMenu)}>
						<Menu size={26} />
					</button>

					{/* LOGO CENTER */}
					<div className="flex-1 flex ml-2">
						<Link href="/">
							<Image
								src="/logo2.png"
								alt="P&P Custom"
								width={120}
								height={40}
							/>
						</Link>
					</div>
				</div>

				{/* AUTH RIGHT */}
				<div className="flex items-center gap-2">
					<Link
						href="/login"
						className="text-sm font-semibold border px-3 py-1.5 rounded-[0.2rem]"
					>
						Iniciar
					</Link>
					<Link
						href="/register"
						className="bg-[#fe6241] px-3 py-1.5 rounded-[0.2rem] text-sm font-bold"
					>
						Registro
					</Link>
				</div>
			</div>

			{/* MENU PANEL — ALWAYS LEFT ALIGNED */}
			{openMenu && (
				<div className="absolute left-0 top-16 w-full bg-white border-b shadow-lg py-4 z-50">
					<MobileItem
						label="Catalogo"
						open={dropdown.catalog}
						onClick={() => toggleDropdown("catalog")}
					>
						<DropdownLink label="Catalogo" href="/catalogo" />
						<DropdownLink label="Eventos" href="/catalogo/eventos" />
						<DropdownLink label="Bussines" href="/catalogo/caps" />
					</MobileItem>

					<MobileItem
						label="Cómo funciona"
						open={dropdown.how}
						onClick={() => toggleDropdown("how")}
					>
						<DropdownLink label="What is P&P?" href="/como/que-es" />
						<DropdownLink label="Steps" href="/como/pasos" />
						<DropdownLink label="FAQ" href="/faq" />
					</MobileItem>

					<DropdownLink label="Pricing" href="/pricing" />
					<DropdownLink label="Blog" href="/blog" />

					<MobileItem
						label="Bussines"
						open={dropdown.services}
						onClick={() => toggleDropdown("services")}
					>
						<DropdownLink label="Bulk Orders" href="/services/bulk" />
						<DropdownLink label="Corporate" href="/services/corporate" />
					</MobileItem>

					<MobileItem
						label="Soporte"
						open={dropdown.support}
						onClick={() => toggleDropdown("support")}
					>
						<DropdownLink label="Help Center" href="/help" />
						<DropdownLink label="Contact" href="/contact" />
					</MobileItem>
				</div>
			)}
		</div>
	);
}

/* SUBCOMPONENTES */

function MobileItem({
	label,
	open,
	onClick,
	children,
}: {
	label: string;
	open: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<div>
			<button
				type="button"
				className="w-full flex justify-between items-center px-6 py-3 text-[17px] hover:bg-neutral-100"
				onClick={onClick}
			>
				{label}
				<ChevronDown
					size={20}
					className={`transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>

			{open && (
				<div className="pl-10 pr-6 py-2 space-y-2 bg-neutral-50">
					{children}
				</div>
			)}
		</div>
	);
}

function DropdownLink({ label, href }: { label: string; href: string }) {
	return (
		<Link
			href={href}
			className="block px-6 py-3 text-[17px] text-neutral-700 hover:bg-neutral-100"
		>
			{label}
		</Link>
	);
}
