import { SearchProvider } from "@/Contexts/SearchContext";
import SearchBar from "@/components/Catalogo/SearchBar";
import SearchText from "@/components/Catalogo/SearchText";
import SortSelect from "@/components/Catalogo/SortSelect";
import { Header } from "@/components/Header/Header";
import AppBreadcrumb from "@/components/shared/AppBreadCrumb";

export default function Layout({ children }: { children: React.ReactNode }) {
	return (
		<SearchProvider>
			<Header />
			<div className="mt-4 px-37">
				<AppBreadcrumb
					items={[
						{ label: "P&P", href: "/" },
						{ label: "Catálogo", href: "/catalogo" },
					]}
				/>
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
