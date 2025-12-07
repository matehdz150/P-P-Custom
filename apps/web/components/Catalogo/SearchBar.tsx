"use client";

import { Search } from "lucide-react";
import { useSearch } from "@/Contexts/SearchContext";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SearchBar({ className }: { className?: string }) {
	const { query, setQuery } = useSearch();

	return (
		<div
			className={cn(
				"w-full flex items-center gap-2 p-1 bg-[#f5f5f1] border rounded-[0.2rem] mt-5",
				className,
			)}
		>
			<Search className="w-5 h-5 text-gray-500" />

			<Input
				type="text"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Busca productos personalizados.."
				className="border-none shadow-none focus-visible:ring-0 text-sm bg-transparent"
			/>
		</div>
	);
}
