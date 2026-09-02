"use client";

import { useEffect, useState } from "react";
import { createProduct } from "@/lib/api/products";
import { getTemplates } from "@/lib/api/templates";

import { GeneralInfoSection } from "./FormCreate/GeneralInfoSection";
import { ImagesSection } from "./FormCreate/ImageSection";
import { PricingSection } from "./FormCreate/PricingSection";
import { SizesSection } from "./FormCreate/SizesSection";
import { ColorsSection } from "./FormCreate/ColorsSection";
import { PrintSidesSection } from "./FormCreate/PrintSidesSection";
import { ProductionSection } from "./FormCreate/ProductionSection";
import { CustomizationRulesSection } from "./FormCreate/CustomizationRulesSection";
import { TemplateSelector } from "./FormCreate/TemplateSelector";

import type { ProductTemplate } from "@/lib/api/templates";
import type {
	ProductColor,
	ProductImage,
	ProductPrintSide,
	ProductSize,
} from "@/lib/api/products";
import type { GeneralInfo } from "./FormCreate/GeneralInfoSection";
import type { CustomizationRules } from "./FormCreate/CustomizationRulesSection";
import { useRouter } from "next/navigation";

export function ProductForm() {
  /* =========================
     STATE
  ========================= */

  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ProductTemplate | null>(null);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* El estado tipado a mano. Sin esto, `useState` infiere `never[]` de los
     arreglos vacíos y `s.sideKey` deja de existir; y `categoryIds` hace falta
     para que `update` encaje con lo que espera GeneralInfoSection. */
  const [form, setForm] = useState<
    GeneralInfo & {
      templateId: string;
      isCustomizable: boolean;
      category: string;
      images: ProductImage[];
      pricing: { basePrice: number };
      sizes: ProductSize[];
      colors: ProductColor[];
      printSides: ProductPrintSide[];
      production: undefined;
      customizationRules?: CustomizationRules;
    }
  >({
    slug: "",
    name: "",
    internalName: "",
    sku: "",
    description: "",
    brand: "",
    category: "",
    categoryIds: [],
    status: "draft" as "draft" | "active" | "archived",

    templateId: "",
    isCustomizable: true,

    images: [],
    pricing: { basePrice: 0 },
    sizes: [],
    colors: [],
    printSides: [],

    production: undefined,
    customizationRules: undefined,
  });

  function update<K extends keyof typeof form>(key: K, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* =========================
     LOAD TEMPLATES
  ========================= */

  useEffect(() => {
    getTemplates().then(setTemplates);
  }, []);

  /* =========================
     SUBMIT
  ========================= */

  async function onSubmit() {
  if (!selectedTemplate) {
    alert("Selecciona un template");
    return;
  }

  if (form.printSides.length === 0) {
    alert("Selecciona al menos un lado de impresión");
    return;
  }

  if (form.images.length < 2) {
    alert("Mínimo 2 imágenes");
    return;
  }

  if (!form.pricing?.basePrice) {
    alert("Precio obligatorio");
    return;
  }

  // 🔥 CONSTRUIMOS EL PAYLOAD EXPLÍCITO
  const payload = {
    ...form,
    templateId: selectedTemplate.id,
    templateSides: form.printSides.map((s) => s.sideKey),
  };

  // 🧠 DEBUG CLARO
  console.log("🚀 CREATE PRODUCT PAYLOAD:");
  console.log(JSON.stringify(payload, null, 2));

  try {
    setIsSubmitting(true);

    await createProduct(payload);

    alert("✅ Producto creado correctamente");
    router.push("/admin/productos");
  } catch (err) {
    console.error("❌ ERROR CREATE PRODUCT:", err);
    alert("❌ Error al crear el producto");
  } finally {
    setIsSubmitting(false);
  }
}

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="space-y-6">
      {/* TEMPLATE BASE */}
      <TemplateSelector
        templates={templates}
        value={form.templateId}
        onChange={(tpl) => {
          setSelectedTemplate(tpl);
          update("templateId", tpl.id);
          update("printSides", []); // reset al cambiar template
        }}
      />

      {/* GENERAL */}
      <GeneralInfoSection value={form} onChange={update} />

      {/* IMAGES */}
      <ImagesSection
        value={form.images}
        onChange={(v) => update("images", v)}
      />

      {/* PRICING */}
      <PricingSection
        value={form.pricing}
        onChange={(v) => update("pricing", v)}
      />

      {/* SIZES */}
      <SizesSection value={form.sizes} onChange={(v) => update("sizes", v)} />

      {/* COLORS */}
      <ColorsSection
        value={form.colors}
        onChange={(v) => update("colors", v)}
      />

      {/* PRINT SIDES (SOLO SI HAY TEMPLATE) */}
      {selectedTemplate && (
        <PrintSidesSection
          templateData={selectedTemplate.data}
          value={form.printSides}
          onChange={(v) => update("printSides", v)}
        />
      )}

      {/* CUSTOM RULES */}
      <CustomizationRulesSection
        value={form.customizationRules}
        onChange={(v) => update("customizationRules", v)}
      />

      {/* PRODUCTION */}
      <ProductionSection
        value={form.production}
        onChange={(v) => update("production", v)}
      />

      {/* SUBMIT */}
      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {isSubmitting ? "Creando..." : "Crear producto"}
      </button>
    </div>
  );
}
