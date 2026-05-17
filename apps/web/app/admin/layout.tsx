import { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Package,
  SlidersHorizontal,
  Truck,
} from "lucide-react";

type AdminLayoutProps = {
  children: ReactNode;
};

const navItems = [
  {
    label: "Productos",
    href: "/admin/productos",
    icon: Package,
  },
  {
    label: "Paquetes",
    href: "/admin/paquetes",
    icon: Package,
  },
  {
    label: "Mockups",
    href: "/admin/mockups",
    icon: LayoutGrid,
  },
  {
    label: "Categorias",
    href: "/admin/categorias",
    icon: SlidersHorizontal,
  },
  {
    label: "Proveedores",
    href: "/admin/proveedores",
    icon: Truck,
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-muted/40">
      {/* SIDEBAR */}
      <aside
        className="
          fixed left-0 top-0 z-40
          h-screen w-64
          border-r bg-background
        "
      >
        {/* HEADER */}
        <div className="h-16 flex items-center px-6 border-b">
          <span className="font-semibold text-lg">
            Admin
          </span>
        </div>

        {/* NAV */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                  "transition-colors"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* CONTENT */}
      <main
        className="
          ml-64
          min-h-screen
          p-6
        "
      >
        {children}
      </main>
    </div>
  );
}