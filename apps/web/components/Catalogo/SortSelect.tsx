"use client";

import { Sora } from "next/font/google";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

const sora = Sora({
	subsets: ["latin"],
	weight: ["400", "500", "600"],
	display: "swap",
});

export default function SortSelect({ mobile = false }: { mobile?: boolean }) {
	return (
		<div
			className={`${sora.className} flex items-center gap-2 ${
				mobile ? "mt-1" : "mt-4"
			}`}
		>
			<span className="text-sm text-[#2A2A26] font-light hidden md:block">
				Ordenar por:
			</span>

			<Select defaultValue="relevancia">
				<SelectTrigger
					className={`
            border bg-white text-sm rounded-[0.2rem]
            ${mobile ? "w-[140px] py-4" : "w-[180px] py-6"}
          `}
				>
					<SelectValue placeholder="Selecciona opción" />
				</SelectTrigger>

				<SelectContent>
					<SelectItem value="relevancia">Más relevantes</SelectItem>
					<SelectItem value="precio-asc">Precio: menor a mayor</SelectItem>
					<SelectItem value="precio-desc">Precio: mayor a menor</SelectItem>
					<SelectItem value="nuevos">Más nuevos</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
