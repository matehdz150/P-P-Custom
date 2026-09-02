"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  crearCategoria,
  actualizarCategoria,
  createPackageCategory,
  Category,
} from "@/lib/api/categories";
import { subirImagen } from "@/lib/api/uploads";
import Image from "next/image";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type CategoryType = "product" | "package";

type Props = {
  trigger: React.ReactNode;
  category?: Category;
  defaultType?: CategoryType; // opcional
};

export function CategoryFormDialog({
  trigger,
  category,
  defaultType = "product",
}: Props) {
  const isEdit = Boolean(category);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CategoryType>(defaultType);
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [imageUrl, setImageUrl] = useState(category?.image ?? "");
  const [uploading, setUploading] = useState(false);

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      // A S3 por la Lambda, no a Cloudinary: lo que se guarda es la ruta
      // (`/medios/...`), que se sirve desde nuestro mismo origen.
      setImageUrl(await subirImagen(file, "categorias"));
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!name) {
      alert("El nombre es obligatorio");
      return;
    }

    try {
      // ========== CATEGORÍAS DE PRODUCTO: ya en DynamoDB ==========
      if (type === "product") {
        if (!imageUrl) {
          alert("La imagen es obligatoria para categorías de producto");
          return;
        }

        if (isEdit) {
          await actualizarCategoria(category!.id, {
            name,
            description,
            image: imageUrl,
          });
        } else {
          await crearCategoria({
            name,
            description,
            image: imageUrl,
          });
        }
      }

      // ========== CATEGORÍAS DE PAQUETE: todavía en la API vieja ==========
      if (type === "package") {
        await createPackageCategory({
          name,
          description,
        });
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar la categoría");
      return;
    }

    setOpen(false);
    window.location.reload();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar categoría" : "Nueva categoría"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* CATEGORY TYPE */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Tipo de categoría</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as CategoryType)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="product" id="product" />
                  <Label htmlFor="product">Producto</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="package" id="package" />
                  <Label htmlFor="package">Paquete</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* NAME */}
          <Input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* DESCRIPTION */}
          <Textarea
            placeholder="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* IMAGE (ONLY PRODUCTS) */}
          {type === "product" && (
            <div className="space-y-2">
              <Input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />

              {imageUrl && (
                <div className="relative w-full h-40 rounded-md overflow-hidden border">
                  <Image
                    src={imageUrl}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {/* SUBMIT */}
          <Button
            className="w-full"
            disabled={uploading}
            onClick={handleSubmit}
          >
            {isEdit ? "Guardar cambios" : "Crear categoría"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}