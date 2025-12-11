"use client";

import { usePathname } from "next/navigation";
import { SearchProvider } from "@/Contexts/SearchContext";
import SearchBar from "@/components/Catalogo/SearchBar";
import SearchText from "@/components/Catalogo/SearchText";
import SortSelect from "@/components/Catalogo/SortSelect";
import { Header } from "@/components/Header/Header";
import AppBreadcrumb from "@/components/shared/AppBreadCrumb";

export default function Layout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();

	// /catalogo/eventos → ["catalogo", "eventos"]
	const segments = pathname.split("/").filter(Boolean);

	// Construir breadcrumb dinámico
	const breadcrumbItems = [
		{ label: "P&P", href: "/" },
		...(segments[0] ? [{ label: "Catálogo", href: "/catalogo" }] : []),
		...(segments[1]
			? [{ label: capitalize(segments[1]), href: `/catalogo/${segments[1]}` }]
			: []),
	];

	return (
		<SearchProvider>
			<Header />

			<div className="mt-4 px-37">
				<AppBreadcrumb items={breadcrumbItems} />

				<SearchBar />

				<div className="flex justify-between">
					<SearchText />
					<SortSelect />
				</div>

				<main className="mt-4">{children}</main>
			</div>
		</SearchProvider>
	);
}

function capitalize(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
