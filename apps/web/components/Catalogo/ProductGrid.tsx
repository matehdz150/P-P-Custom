"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

const products = [
	{
		id: 1,
		name: "Playera personalizada",
		description: "Ideal para equipos, marcas o eventos.",
		price: "$249",
		image: "/products/tshirt.png",
	},
	{
		id: 2,
		name: "Termo personalizado",
		description: "Mantén tus bebidas frías o calientes.",
		price: "$329",
		image: "/products/thermo2.png",
	},
	{
		id: 3,
		name: "Tote bag",
		description: "Perfecta para regalos o eventos.",
		price: "$199",
		image: "/products/totebag.png",
	},
	{
		id: 4,
		name: "Gorra tipo baseball",
		description: "Tu marca siempre visible.",
		price: "$279",
		image: "/products/cap.png",
	},
	{
		id: 5,
		name: "Vasos personalizados",
		description: "Todo en un solo paquete.",
		price: "$699",
		image: "/products/vaso2.png",
	},
	{
		id: 6,
		name: "Kit para graduación",
		description: "Todo en un solo paquete.",
		price: "$699",
		image: "/products/grad-kit.png",
	},
];

export default function ProductGrid() {
	const scrollRef = useRef<HTMLDivElement | null>(null);

	const scroll = (direction: "left" | "right") => {
		if (!scrollRef.current) return;
		const amount = 320; // píxeles por click
		scrollRef.current.scrollBy({
			left: direction === "left" ? -amount : amount,
			behavior: "smooth",
		});
	};

	return (
		<section className="w-full mt-10">
			<div className="relative">
				{/* Botón izquierda */}
				<Button
					variant="outline"
					size="icon"
					className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full shadow-sm bg-white/80"
					onClick={() => scroll("left")}
				>
					<ChevronLeft className="w-5 h-5" />
				</Button>

				{/* CONTENEDOR SCROLLEABLE */}
				<div
					ref={scrollRef}
					className="
            flex 
            gap-4 
            overflow-x-auto 
            scroll-smooth 
            pb-2 
            pr-2
          "
				>
					{products.map((product) => (
						<article
							key={product.id}
							className="
                min-w-[220px]
                max-w-[240px]
                flex-shrink-0
                rounded-[0.2rem]
                border 
                bg-[#f5f5f1] 
                py-3 
                hover:shadow-md 
                transition-shadow 
                duration-200
                cursor-pointer
              "
						>
							<div className="relative w-full h-50 mb-3 bg-[#f5f5f1] rounded-sm overflow-hidden">
								<Image
									src={product.image}
									alt={product.name}
									fill
									className="object-contain"
								/>
							</div>

							<h4 className="text-sm font-semibold mb-1 text-center">
								{product.name}
							</h4>
						</article>
					))}
				</div>

				{/* Botón derecha */}
				<Button
					variant="outline"
					size="icon"
					className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full shadow-sm bg-white/80"
					onClick={() => scroll("right")}
				>
					<ChevronRight className="w-5 h-5" />
				</Button>
			</div>
		</section>
	);
}
