// components/Product/ProductRecommendations.tsx
"use client";

import { ProductRecommendationCard } from "./ProductRecommendationCard";

export function ProductRecommendations() {
  // 🔧 MOCK temporal
  const products = [
    {
      id: "1",
      name: "Tshirt Unisex",
      price: 350,
      image:
        "https://res.cloudinary.com/dzfq2rxzi/image/upload/v1766108240/products/wnn6iomqlvtroqduqksq.png",
    },
    {
      id: "2",
      name: "Hoodie Unisex",
      price: 550,
      image:
        "https://res.cloudinary.com/dzfq2rxzi/image/upload/v1766109128/products/vwbyvyjsrkbo60iqg2pe.png",
    },
    {
      id: "3",
      name: "Gorra Básica",
      price: 250,
      image:
        "https://res.cloudinary.com/dzfq2rxzi/image/upload/v1766108404/products/st79pii1vueyjltcvrgi.png",
    },
  ];

  return (
    <section className="mt-16 space-y-6">
      <header className="flex items-end justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          También te puede interesar
        </h2>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((p) => (
          <ProductRecommendationCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}