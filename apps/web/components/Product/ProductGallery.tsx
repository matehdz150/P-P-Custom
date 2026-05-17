"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
	images: string[];
};

export function ProductGallery({ images }: Props) {
	const [active, setActive] = useState(images[0]);

	return (
		<div className="flex flex-col gap-4">
			{/* MAIN IMAGE */}
			<div className="relative aspect-square rounded-2xl overflow-hidden bg-[#f5f5f3] flex items-center justify-center">
				{active && (
					<Image
						src={active}
						alt="Producto"
						fill
						priority
						sizes="(max-width: 1024px) 100vw, 50vw"
						className="object-contain p-8"
					/>
				)}
			</div>

			{/* THUMBNAILS */}
			{images.length > 1 && (
				<div className="flex gap-3 flex-wrap">
					{images.map((img) => (
						<button
							key={img}
							type="button"
							onClick={() => setActive(img)}
							className={cn(
								"relative h-20 w-20 rounded-xl overflow-hidden bg-[#f5f5f3] transition",
								active === img
									? "ring-2 ring-[#fe6241]"
									: "ring-1 ring-gray-200 hover:ring-gray-300",
							)}
						>
							<Image
								src={img}
								alt="Miniatura"
								fill
								sizes="80px"
								className="object-contain p-2"
							/>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
