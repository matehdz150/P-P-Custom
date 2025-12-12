"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { SearchProvider, useSearch } from "@/Contexts/SearchContext";
import SearchBar from "@/components/Catalogo/SearchBar";
import SearchText from "@/components/Catalogo/SearchText";
import SortSelect from "@/components/Catalogo/SortSelect";
import { Header } from "@/components/Header/Header";
import AppBreadcrumb from "@/components/shared/AppBreadCrumb";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<SearchProvider>
			<Header />
			<CatalogLayoutContent>{children}</CatalogLayoutContent>
		</SearchProvider>
	);
}

function CatalogLayoutContent({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const { query } = useSearch();
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	const segments = pathname.split("/").filter(Boolean);
	const isSearching = query.trim().length > 0;

	const breadcrumbItems = [
		{ label: "P&P", href: "/" },
		...(segments[0] ? [{ label: "Catálogo", href: "/catalogo" }] : []),
		...(segments[1]
			? [{ label: capitalize(segments[1]), href: `/catalogo/${segments[1]}` }]
			: []),
	];

	// ⚡ condiciones para ocultar SortSelect en mobile
	const hideSortMobile = isSearching || isSearchFocused;

	return (
		<div className="mt-4 w-full px-4 sm:px-6 md:px-10 lg:px-20 xl:px-32">
			<AppBreadcrumb items={breadcrumbItems} />

			{/* ------------------- 📱 MOBILE ------------------- */}
			<div className="mt-1 flex items-center gap-2 md:hidden mb-5">
				<SearchBar
					className={`
            transition-all duration-200
            ${hideSortMobile ? "flex-[1_0_100%]" : "flex-1"}
          `}
					onFocusChange={setIsSearchFocused}
				/>

				{!hideSortMobile && (
					<div className="w-[140px] transition-all duration-200">
						<SortSelect />
					</div>
				)}
			</div>
			<SearchText mobile />

			{/* ------------------- 🖥 DESKTOP ------------------- */}
			<div className="hidden md:block mt-4">
				<SearchBar />

				<div className="flex justify-between items-center mt-3">
					<SearchText />
					<SortSelect />
				</div>
			</div>

			<main className="mt-4">{children}</main>
		</div>
	);
}

function capitalize(str: string) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
