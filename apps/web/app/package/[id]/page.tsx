import Image from "next/image";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPackage } from "@/lib/api/packages";
import { PackageProductsAccordion } from "@/components/Package/PackageProductsAccordion";
import { ProductRecommendations } from "@/components/Product/ProductRecommendations";

type Props = {
  params: { id: string };
};

export default async function PackagePage({ params }: Props) {

    const { id } = await params;

  const pkg = await getPackage(id);

  return (
    <main className="px-6 md:px-12 lg:px-20 py-10 space-y-16">
      {/* ================= HERO ================= */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
        {/* IMAGE */}
        <div className="relative w-full aspect-4/3 bg-[#f5f5f1] rounded-md overflow-hidden flex items-center justify-center">
          {pkg.image ? (
            <Image
              src={pkg.image}
              alt={pkg.name}
              width={800}
              height={600}
              className="object-contain"
              priority
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              Imagen no disponible
            </span>
          )}
        </div>

        {/* INFO */}
        <div className="flex flex-col h-full space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">{pkg.name}</h1>

          {pkg.description && (
            <p className="text-sm text-muted-foreground max-w-xl">
              {pkg.description}
            </p>
          )}

          {/* DESGLOSE */}
          {pkg.pricing?.basePrice != null && (() => {
            const itemsTotal =
              pkg.items?.reduce((acc, item) => {
                const unitPrice = item.product?.pricing?.basePrice ?? 0;
                return acc + unitPrice * item.quantity;
              }, 0) ?? 0;

            return (
              <div className="bg-[#e8f7d2] border border-green-300 rounded-md p-4 space-y-4">
                {/* HEADER */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-green-800">
                    Desglose del paquete
                  </p>
                  <Sparkles className="text-green-600" />
                </div>

                {/* ITEMS */}
                <div className="space-y-2">
                  {pkg.items?.map((item) => {
                    const unitPrice =
                      item.product?.pricing?.basePrice ?? 0;
                    const total = unitPrice * item.quantity;

                    return (
                      <div
                        key={item.id}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {item.product?.name} × {item.quantity}
                        </span>
                        <span className="font-medium">
                          MXN {total.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}

                  {/* ORIGINAL */}
                  <div className="pt-3 mt-3 border-t flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Precio original
                    </span>
                    <span className="text-sm line-through text-muted-foreground">
                      MXN {itemsTotal.toLocaleString()}
                    </span>
                  </div>

                  {/* TOTAL */}
                  <div className="pt-3 border-t flex justify-between items-center">
                    <span className="text-sm font-semibold">
                      Total paquete
                    </span>
                    <span className="text-lg font-bold text-green-800">
                      MXN {pkg.pricing.basePrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* CTA — pegado abajo */}
          <div className="mt-auto flex justify-end">
            <Button size="lg" className="w-full lg:w-auto py-6 font-semibold cursor-pointer">
              Comenzar a diseñar paquete
            </Button>
          </div>
        </div>
      </section>

      <PackageProductsAccordion items={pkg.items ?? []} />
      <ProductRecommendations/>
    </main>
  );
}