"use client";

import { useEffect, useState } from "react";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type ProductImage,
} from "@/lib/api/products";
import { uploadImage } from "@/lib/api/uploads";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  /* =========================
     CORE
  ========================= */

  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [internalName, setInternalName] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] =
    useState<"draft" | "active" | "archived">("draft");

  const [templateId, setTemplateId] = useState("tshirt");

  /* =========================
     PRICE (CATALOG REQUIRED)
  ========================= */

  const [basePrice, setBasePrice] = useState<number | "">("");

  /* =========================
     IMAGES
  ========================= */

  const [images, setImages] = useState<ProductImage[]>([]);

  /* =========================
     LOAD
  ========================= */

  async function load() {
    setLoading(true);
    setProducts(await getProducts());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  /* =========================
     IMAGE UPLOAD
  ========================= */

  async function onFilesSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files;
    if (!files) return;

    setUploading(true);

    const uploaded: ProductImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const res = await uploadImage(files[i]);
      uploaded.push({
        url: res.url,
        order: images.length + i,
      });
    }

    setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
  }

  /* =========================
     SUBMIT
  ========================= */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (images.length < 2) {
      alert("El producto debe tener mínimo 2 imágenes");
      return;
    }

    if (basePrice === "" || basePrice <= 0) {
      alert("El producto debe tener un precio válido");
      return;
    }

    const payload = {
      name,
      internalName,
      sku,
      description: description || undefined,
      brand: brand || undefined,
      category: category || undefined,
      status,
      templateId,
      images,
      pricing: {
        basePrice,
      },
    };

    if (editingId) {
      await updateProduct(editingId, payload);
    } else {
      await createProduct(payload);
    }

    resetForm();
    load();
  }

  /* =========================
     HELPERS
  ========================= */

  function resetForm() {
    setEditingId(null);
    setName("");
    setInternalName("");
    setSku("");
    setDescription("");
    setBrand("");
    setCategory("");
    setStatus("draft");
    setTemplateId("tshirt");
    setBasePrice("");
    setImages([]);
  }

  function onEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setInternalName(p.internalName);
    setSku(p.sku);
    setDescription(p.description ?? "");
    setBrand(p.brand ?? "");
    setCategory(p.category ?? "");
    setStatus(p.status);
    setTemplateId(p.templateId);
    setBasePrice(p.pricing?.basePrice ?? "");
    setImages(p.images ?? []);
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar producto?")) return;
    await deleteProduct(id);
    load();
  }

  if (loading) return <div className="p-6">Cargando…</div>;

  /* =========================
     UI
  ========================= */

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Admin · Productos</h1>

      <form onSubmit={onSubmit} className="border p-4 rounded space-y-3 mb-8">
        <h2 className="font-semibold">
          {editingId ? "Editar producto" : "Nuevo producto"}
        </h2>

        <input
          className="border p-2 w-full"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          className="border p-2 w-full"
          placeholder="Internal name"
          value={internalName}
          onChange={(e) => setInternalName(e.target.value)}
          required
        />

        <input
          className="border p-2 w-full"
          placeholder="SKU"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          required
        />

        <textarea
          className="border p-2 w-full"
          placeholder="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          className="border p-2 w-full"
          placeholder="Marca"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />

        <input
          className="border p-2 w-full"
          placeholder="Categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <input
          type="number"
          min="0"
          step="0.01"
          className="border p-2 w-full"
          placeholder="Precio base (MXN)"
          value={basePrice}
          onChange={(e) =>
            setBasePrice(e.target.value === "" ? "" : Number(e.target.value))
          }
          required
        />

        <select
          className="border p-2 w-full"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>

        <input
          type="file"
          multiple
          accept="image/*"
          className="border p-2 w-full"
          onChange={onFilesSelected}
        />

        {uploading && <p className="text-sm">Subiendo imágenes…</p>}

        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <img
                key={i}
                src={img.url}
                className="h-20 w-20 object-cover border rounded"
              />
            ))}
          </div>
        )}

        <button className="bg-black text-white px-4 py-2 rounded">
          {editingId ? "Guardar cambios" : "Crear producto"}
        </button>
      </form>

      {/* LIST */}
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Nombre</th>
            <th className="p-2">SKU</th>
            <th className="p-2">Precio</th>
            <th className="p-2">Status</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.name}</td>
              <td className="p-2">{p.sku}</td>
              <td className="p-2">
                ${p.pricing?.basePrice?.toFixed(2) ?? "—"}
              </td>
              <td className="p-2">{p.status}</td>
              <td className="p-2 flex gap-2">
                <button
                  className="text-blue-600"
                  onClick={() => onEdit(p)}
                >
                  Editar
                </button>
                <button
                  className="text-red-600"
                  onClick={() => onDelete(p.id)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}