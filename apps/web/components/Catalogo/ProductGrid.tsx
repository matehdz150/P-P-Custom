"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type Category } from "@/lib/api/categories";
import { getCategoriasPublicas } from "@/lib/api/catalogo";

/* =========================
   COMPONENT
========================= */

export default function ProductGrid() {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [categories, setCategories] = useState<Category[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getCategoriasPublicas()
			.then(setCategories)
			.catch(() => setCategories([]))
			.finally(() => setLoading(false));
	}, []);

	const scroll = (direction: "left" | "right") => {
		if (!scrollRef.current) return;
		scrollRef.current.scrollBy({
			left: direction === "left" ? -320 : 320,
			behavior: "smooth",
		});
	};

	if (loading) {
		return <div className="py-8 text-center text-sm">Cargando categorías…</div>;
	}

	return (
		<section className="w-full mt-8">
			<div className="relative">
				{/* Flecha izquierda */}
				<Button
					variant="outline"
					size="icon"
					className="
            hidden md:flex
            absolute left-0 top-1/2 -translate-y-1/2
            z-10 rounded-full
            bg-white/80 shadow-sm
          "
					onClick={() => scroll("left")}
				>
					<ChevronLeft className="w-5 h-5" />
				</Button>

				{/* Grid */}
				<div
					ref={scrollRef}
					className="
            flex
            gap-3
            overflow-x-auto
            scroll-smooth
            pb-2
            pr-1
          "
				>
					{categories.map((category) => (
						<Link
							key={category.id}
							href={`/catalogo/productos/${category.id}`}
							className="block"
						>
							<article
								className="
                  group
                  min-w-[170px]
                  md:min-w-[220px]
                  max-w-[240px]
                  flex-shrink-0
                  rounded-[0.25rem]
                  border
                  bg-[#f5f5f1]
                  py-3
                  cursor-pointer
                  transition-shadow
                  hover:shadow-md
                "
							>
								{/* Imagen */}
								<div
									className="
                    relative
                    w-full
                    h-40
                    md:h-52
                    mb-3
                    rounded-sm
                    overflow-hidden
                  "
								>
									{/* La categoría puede no tener imagen, y `next/image` no
                      acepta `undefined`: rompía el build. */}
									<Image
										src={category.image ?? "/products/tshirt.png"}
										alt={category.name}
										fill
										className="
                      object-contain
                      transition-transform
                      duration-300
                      ease-out
                      group-hover:scale-105
                    "
									/>
								</div>

								{/* Nombre */}
								<h4 className="text-sm font-semibold text-center px-2">
									{category.name}
								</h4>
							</article>
						</Link>
					))}
				</div>

				{/* Flecha derecha */}
				<Button
					variant="outline"
					size="icon"
					className="
            hidden md:flex
            absolute right-0 top-1/2 -translate-y-1/2
            z-10 rounded-full
            bg-white/80 shadow-sm
          "
					onClick={() => scroll("right")}
				>
					<ChevronRight className="w-5 h-5" />
				</Button>
			</div>
		</section>
	);
}
