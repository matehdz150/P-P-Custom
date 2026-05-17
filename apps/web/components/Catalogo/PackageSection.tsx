"use client";

import { useEffect, useState } from "react";
import { Sora } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import {
  getPackageCategoryWithPackagesByName,
} from "@/lib/api/categories";

const sora = Sora({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export interface PackageItem {
  id: string;
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
  categoryName: string; // ✅ NAME
  limit?: number;
}

export default function PackagesSection({
  title,
  description,
  href,
  categoryName,
  limit = 4,
}: PackagesSectionProps) {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const category =
        await getPackageCategoryWithPackagesByName(categoryName);

      const mapped: PackageItem[] = (category.packages ?? [])
        .slice(0, limit)
        .map((pkg) => ({
          id: pkg.id,
          title: pkg.name,
          brand: "P&P Custom",
          priceFrom: "—", // si luego quieres pricing, lo agregamos
          details: pkg.description ?? "",
          sizes: "",
          image: pkg.image ?? "/placeholder-package.jpg",
        }));

      setPackages(mapped);
      setLoading(false);
    }

    load();
  }, [categoryName, limit]);

  if (loading || packages.length === 0) return null;

  return (
    <section className={`w-full mt-12 ${sora.className}`}>
      {/* HEADER */}
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[#2A2A26]">
            {title}
          </h2>
          <p className="text-sm text-[#555] mt-1">{description}</p>
        </div>

        <Link
          href={href}
          className="text-sm font-medium underline-offset-4 hover:underline whitespace-nowrap"
        >
          Ver todos
        </Link>
      </div>

      {/* MOBILE */}
      <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 md:hidden scrollbar-hide">
        {packages.map((pack) => (
          <PackageCard key={pack.id} pack={pack} />
        ))}
      </div>

      {/* DESKTOP */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {packages.map((pack) => (
          <PackageCard key={pack.id} pack={pack} />
        ))}
      </div>
    </section>
  );
}

/* =========================
   CARD
========================= */

function PackageCard({ pack }: { pack: PackageItem }) {
  return (
    <article className="bg-white rounded-[0.2rem] overflow-hidden hover:shadow-md transition-shadow duration-200 cursor-pointer">
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
        <p className="text-xs text-muted-foreground">
          Por P&P Custom
        </p>
        <p className="text-xs text-muted-foreground">
          {pack.details}
        </p>
      </div>
    </article>
  );
}