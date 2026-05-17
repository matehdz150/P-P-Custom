"use client";

import { createPackage } from "@/lib/api/packages";
import { PackageForm } from "@/components/Admin/paquetes/PackageForm";
import { useRouter } from "next/navigation";

export default function NewPackagePage() {
  const router = useRouter();

  async function onSubmit(data) {
    await createPackage(data);
    router.push("/admin/paquetes");
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Nuevo paquete</h1>
      <PackageForm onSubmit={onSubmit} />
    </div>
  );
}