"use client";

import { Sora } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

const sora = Sora({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700", "800"],
});

export interface PackageItem {
	id: number;
	label?: string;
	title: string;
	brand: string;
	priceFrom: string;
	details: string;
	sizes: string;
	image: string;
}

interface PackagesSectionProps {
	title: string;
	description: string;
	href: string;
	packages: PackageItem[];
}

export default function PackagesSection({
	title,
	description,
	href,
	packages,
}: PackagesSectionProps) {
	return (
		<section className={`w-full mt-12 ${sora.className}`}>
			{/* HEADER */}
			<div className="flex items-baseline justify-between mb-6">
				<div>
					<h2 className="text-xl font-semibold text-[#2A2A26]">{title}</h2>
					<p className="text-sm text-[#555] mt-1">{description}</p>
				</div>

				<Link
					href={href}
					className="text-sm font-medium underline-offset-4 hover:underline whitespace-nowrap"
				>
					Ver todos
				</Link>
			</div>

			{/* 
        📱 MOBILE → scroll horizontal
        🖥 DESKTOP → grid tradicional
      */}

			{/* MOBILE SCROLL (solo en mobile) */}
			<div
				className="
          flex gap-4 overflow-x-auto pb-3 
          -mx-4 px-4 md:hidden
          scrollbar-hide
        "
			>
				{packages.map((pack) => (
					<article
						key={pack.id}
						className="
              bg-white rounded-[0.2rem] overflow-hidden 
              hover:shadow-md transition-shadow duration-200 cursor-pointer

              min-w-[220px] max-w-[240px] flex-shrink-0
            "
					>
						<div className="relative w-full aspect-[4/3] bg-[#f5f5f1]">
							<Image
								src={pack.image}
								alt={pack.title}
								fill
								className="object-cover"
							/>
						</div>

						<div className="p-4 space-y-1">
							<h3 className="text-sm font-semibold leading-snug">
								{pack.title}
							</h3>
							<p className="text-xs text-muted-foreground">Por {pack.brand}</p>
							<p className="text-sm font-semibold mt-2">{pack.priceFrom}</p>
							<p className="text-xs text-muted-foreground">{pack.details}</p>
							<p className="text-xs text-muted-foreground mt-1">{pack.sizes}</p>
						</div>
					</article>
				))}
			</div>

			{/* DESKTOP GRID (solo en md+) */}
			<div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
				{packages.map((pack) => (
					<article
						key={pack.id}
						className="
              bg-white rounded-[0.2rem] overflow-hidden 
              hover:shadow-md transition-shadow duration-200 cursor-pointer
            "
					>
						<div className="relative w-full aspect-[4/3] bg-[#f5f5f1]">
							<Image
								src={pack.image}
								alt={pack.title}
								fill
								className="object-cover"
							/>
						</div>

						<div className="p-4 space-y-1">
							<h3 className="text-sm font-semibold leading-snug">
								{pack.title}
							</h3>
							<p className="text-xs text-muted-foreground">Por {pack.brand}</p>
							<p className="text-sm font-semibold mt-2">{pack.priceFrom}</p>
							<p className="text-xs text-muted-foreground">{pack.details}</p>
							<p className="text-xs text-muted-foreground mt-1">{pack.sizes}</p>
						</div>
					</article>
				))}
			</div>
		</section>
	);
}
