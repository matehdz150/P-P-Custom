"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { useSearch } from "@/Contexts/SearchContext";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function SearchBar({
	className,
	onFocusChange,
}: {
	className?: string;
	onFocusChange?: (focused: boolean) => void;
}) {
	const { query, setQuery } = useSearch();
	const [_focused, setFocused] = useState(false);

	const handleFocus = () => {
		setFocused(true);
		onFocusChange?.(true);
	};

	const handleBlur = () => {
		setFocused(false);
		onFocusChange?.(false);
	};

	return (
		<div
			className={cn(
				"w-full flex items-center gap-2 bg-[#f5f5f1] border rounded-[0.2rem] mt-5",
				"h-12 px-3", // << altura fija y padding consistente
				className,
			)}
		>
			<Search className="w-5 h-5 text-gray-500" />

			<Input
				type="text"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Busca productos personalizados.."
				onFocus={handleFocus}
				onBlur={handleBlur}
				className="border-none shadow-none focus-visible:ring-0 text-sm bg-transparent"
			/>
		</div>
	);
}
