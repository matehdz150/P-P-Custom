import { getProduct } from "@/lib/api/products";
import { ProductDetails } from "@/components/Product/ProductDetails";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // ✅ ESTO ES CLAVE

  console.log("🆔 PRODUCT ID (frontend):", id);

  const product = await getProduct(id);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <ProductDetails product={product} />
    </div>
  );
}