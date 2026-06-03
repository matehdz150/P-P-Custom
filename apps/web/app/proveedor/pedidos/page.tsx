"use client";

import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Download,
  ImageIcon,
  Package,
  PackageCheck,
  Shapes,
  Truck,
  Type,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  getProviderOrders,
  updateOrderStatus,
  type DesignAsset,
  type Order,
  type OrderStatus,
} from "@/lib/api/orders";

// Forzar descarga de un archivo (Cloudinary tiene CORS habilitado)
async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, "_blank");
  }
}

const SIDE_LABELS: Record<string, string> = {
  front: "Frente",
  back: "Espalda",
};
const sideLabel = (s: string) => SIDE_LABELS[s] ?? s;

const ASSET_ICON: Record<DesignAsset["type"], React.ComponentType<{ className?: string }>> = {
  text: Type,
  image: ImageIcon,
  shape: Shapes,
};

// ---- Configuración de estados ----
export const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    color: string;
    bg: string;
    ring: string;
    icon: React.ComponentType<{ className?: string }>;
    next: OrderStatus[];
  }
> = {
  pending: {
    label: "Pendiente",
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    icon: Clock,
    next: ["confirmed", "cancelled"],
  },
  confirmed: {
    label: "Confirmado",
    color: "text-blue-700",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    icon: CheckCircle2,
    next: ["in_production", "cancelled"],
  },
  in_production: {
    label: "En producción",
    color: "text-violet-700",
    bg: "bg-violet-50",
    ring: "ring-violet-200",
    icon: Package,
    next: ["shipped", "cancelled"],
  },
  shipped: {
    label: "Enviado",
    color: "text-sky-700",
    bg: "bg-sky-50",
    ring: "ring-sky-200",
    icon: Truck,
    next: ["delivered"],
  },
  delivered: {
    label: "Entregado",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    icon: PackageCheck,
    next: [],
  },
  cancelled: {
    label: "Cancelado",
    color: "text-red-700",
    bg: "bg-red-50",
    ring: "ring-red-200",
    icon: X,
    next: [],
  },
};

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "Todos", value: "" },
  { label: "Pendientes", value: "pending" },
  { label: "Confirmados", value: "confirmed" },
  { label: "En producción", value: "in_production" },
  { label: "Enviados", value: "shipped" },
  { label: "Entregados", value: "delivered" },
  { label: "Cancelados", value: "cancelled" },
];

export default function ProviderOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = (status?: string) => {
    setLoading(true);
    getProviderOrders(status || undefined)
      .then(setOrders)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders(activeFilter);
  }, [activeFilter]);

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus,
    note?: string,
  ) => {
    await updateOrderStatus(orderId, newStatus, note);
    loadOrders(activeFilter);
    setSelectedOrder(null);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#efefec] bg-white px-6 py-5">
        <h1 className="text-[22px] font-bold text-[#1a1a1a]">Pedidos</h1>
        <p className="mt-0.5 text-[13px] text-[#888]">
          Gestiona y actualiza el estado de cada pedido
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-[#efefec] bg-white px-6 py-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setActiveFilter(f.value)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              activeFilter === f.value
                ? "bg-[#1a1a1a] text-white"
                : "text-[#888] hover:bg-[#f3f3f1] hover:text-[#1a1a1a]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {loading ? (
          <OrdersSkeleton />
        ) : orders.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                onSelect={() => setSelectedOrder(order)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

// ---- OrderRow ----
function OrderRow({
  order,
  onSelect,
}: {
  order: Order;
  onSelect: () => void;
}) {
  const cfg = STATUS_CONFIG[order.status];
  const Icon = cfg.icon;
  const img = order.product?.images?.[0]?.url;
  const date = new Date(order.createdAt).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-4 rounded-xl border border-[#efefec] bg-white p-4 text-left transition-all hover:border-[#ddd] hover:shadow-sm active:scale-[0.99]"
    >
      {/* Product thumbnail */}
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#f5f5f3]">
        {img ? (
          <Image src={img} alt={order.product?.name ?? ""} fill className="object-cover" sizes="56px" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-6 w-6 text-[#ccc]" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#1a1a1a]">
          {order.product?.name ?? "Producto"}
        </p>
        <p className="mt-0.5 text-[12px] text-[#888]">
          {order.quantity} unidad{order.quantity !== 1 ? "es" : ""} · {date}
        </p>
        {order.notes && (
          <p className="mt-0.5 truncate text-[11px] text-[#aaa]">
            &ldquo;{order.notes}&rdquo;
          </p>
        )}
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <p className="text-[14px] font-bold text-[#1a1a1a]">
          {order.totalPrice ? `$${order.totalPrice}` : "—"}
        </p>
      </div>

      {/* Status badge */}
      <span
        className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cfg.color} ${cfg.bg} ${cfg.ring}`}
      >
        <Icon className="h-3 w-3" />
        {cfg.label}
      </span>
    </button>
  );
}

// ---- OrderDetailDrawer ----
function OrderDetailDrawer({
  order,
  onClose,
  onStatusChange,
}: {
  order: Order;
  onClose: () => void;
  onStatusChange: (id: string, status: OrderStatus, note?: string) => void;
}) {
  const cfg = STATUS_CONFIG[order.status];
  const Icon = cfg.icon;
  const [note, setNote] = useState(order.providerNote ?? "");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleTransition = async (newStatus: OrderStatus) => {
    setBusy(true);
    try {
      await onStatusChange(order.id, newStatus, note || undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />

      {/* Drawer */}
      <div
        ref={ref}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-[480px] flex-col overflow-y-auto bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#efefec] px-5 py-4">
          <h2 className="text-[15px] font-bold text-[#1a1a1a]">
            Detalle del pedido
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[#f3f3f1] transition-colors"
          >
            <X className="h-4 w-4 text-[#888]" />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-5 py-5">
          {/* Estado actual */}
          <div
            className={`flex items-center gap-2.5 rounded-xl px-4 py-3 ring-1 ${cfg.bg} ${cfg.ring}`}
          >
            <Icon className={`h-5 w-5 ${cfg.color}`} />
            <div>
              <p className={`text-[13px] font-bold ${cfg.color}`}>
                {cfg.label}
              </p>
              <p className="text-[11px] text-[#888]">Estado actual del pedido</p>
            </div>
          </div>

          {/* Diseño personalizado */}
          <DesignSection order={order} />

          {/* Detalles */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#aaa]">
              Información
            </p>
            <div className="divide-y divide-[#f3f3f1] rounded-xl border border-[#efefec]">
              <InfoRow label="Producto" value={order.product?.name ?? "—"} />
              <InfoRow
                label="Cantidad"
                value={`${order.quantity} unidad${order.quantity !== 1 ? "es" : ""}`}
              />
              <InfoRow
                label="Precio total"
                value={order.totalPrice ? `$${order.totalPrice}` : "—"}
              />
              <InfoRow
                label="Fecha"
                value={new Date(order.createdAt).toLocaleDateString("es-MX", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
              {order.notes && (
                <InfoRow label="Nota del cliente" value={order.notes} />
              )}
            </div>
          </div>

          {/* Dirección */}
          {order.shippingAddress &&
            Object.keys(order.shippingAddress).length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#aaa]">
                  Dirección de envío
                </p>
                <div className="rounded-xl border border-[#efefec] px-4 py-3 text-[13px] text-[#555]">
                  {Object.values(order.shippingAddress).join(", ")}
                </div>
              </div>
            )}

          {/* Nota del proveedor */}
          <div>
            <label
              htmlFor="provider-note"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#aaa]"
            >
              Nota interna del proveedor
            </label>
            <textarea
              id="provider-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Agrega una nota interna..."
              className="w-full resize-none rounded-lg border border-[#e8e8e8] px-3.5 py-2.5 text-[13px] text-[#1a1a1a] placeholder:text-[#bbb] focus:border-[#1a1a1a] focus:outline-none"
            />
          </div>

          {/* Historial */}
          {order.statusHistory && order.statusHistory.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#aaa]">
                Historial
              </p>
              <div className="space-y-2">
                {order.statusHistory.map((h) => {
                  const toCfg = STATUS_CONFIG[h.toStatus];
                  const ToIcon = toCfg.icon;
                  return (
                    <div
                      key={h.id}
                      className="flex items-start gap-2.5 text-[12px]"
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${toCfg.bg}`}
                      >
                        <ToIcon className={`h-3 w-3 ${toCfg.color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#1a1a1a]">
                          {h.fromStatus
                            ? `${STATUS_CONFIG[h.fromStatus].label} → ${toCfg.label}`
                            : toCfg.label}
                        </p>
                        {h.note && (
                          <p className="text-[#888]">&ldquo;{h.note}&rdquo;</p>
                        )}
                        <p className="text-[#bbb]">
                          {new Date(h.createdAt).toLocaleString("es-MX")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acciones */}
          {cfg.next.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#aaa]">
                Cambiar estado
              </p>
              <div className="grid grid-cols-2 gap-2">
                {cfg.next.map((nextStatus) => {
                  const nextCfg = STATUS_CONFIG[nextStatus];
                  const NextIcon = nextCfg.icon;
                  const isCancelBtn = nextStatus === "cancelled";
                  return (
                    <button
                      key={nextStatus}
                      type="button"
                      disabled={busy}
                      onClick={() => handleTransition(nextStatus)}
                      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-50 ${
                        isCancelBtn
                          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          : "bg-[#1a1a1a] text-white hover:bg-[#333]"
                      }`}
                    >
                      <NextIcon className="h-3.5 w-3.5" />
                      {nextCfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---- Sección de diseño: compuesto HD + componentes descargables ----
function DesignSection({ order }: { order: Order }) {
  const snapshots = order.designSnapshot ?? {};
  const assets = order.designAssets ?? {};

  const sides = Array.from(
    new Set([...Object.keys(snapshots), ...Object.keys(assets)]),
  ).filter((s) => snapshots[s] || (assets[s]?.length ?? 0) > 0);

  if (sides.length === 0) return null;

  const slug = (order.product?.name ?? "diseno")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (
    <div className="space-y-5">
      {sides.map((side) => {
        const composite = snapshots[side];
        const sideAssets = assets[side] ?? [];
        return (
          <div key={side}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#aaa]">
                Diseño del cliente · {sideLabel(side)}
              </p>
              {composite && (
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(composite, `${slug}-${side}-hd.png`)
                  }
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[#1a1a1a] hover:bg-[#f3f3f1] transition-colors"
                >
                  <Download className="h-3 w-3" />
                  Descargar HD
                </button>
              )}
            </div>

            {composite && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#f5f5f3]">
                <Image
                  src={composite}
                  alt={`Diseño ${sideLabel(side)}`}
                  fill
                  unoptimized
                  className="object-contain p-2"
                  sizes="440px"
                />
              </div>
            )}

            {sideAssets.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-[11px] font-medium text-[#999]">
                  Componentes ({sideAssets.length}) — descarga individual
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {sideAssets.map((asset, i) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      filename={`${slug}-${side}-${asset.type}-${i + 1}.png`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AssetCard({
  asset,
  filename,
}: {
  asset: DesignAsset;
  filename: string;
}) {
  const Icon = ASSET_ICON[asset.type] ?? ImageIcon;
  return (
    <div className="group relative overflow-hidden rounded-lg border border-[#efefec] bg-[#f5f5f3]">
      <div className="relative aspect-square">
        <Image
          src={asset.url}
          alt={asset.label}
          fill
          unoptimized
          className="object-contain p-1.5"
          sizes="140px"
        />
        <button
          type="button"
          onClick={() => downloadFile(asset.url, filename)}
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100"
          title={`Descargar ${asset.label}`}
        >
          <span className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-[#1a1a1a]">
            <Download className="h-3 w-3" />
            Descargar
          </span>
        </button>
      </div>
      <div className="flex items-center gap-1 border-t border-[#efefec] px-1.5 py-1">
        <Icon className="h-2.5 w-2.5 shrink-0 text-[#aaa]" />
        <span className="truncate text-[10px] text-[#888]">{asset.label}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[12px] text-[#888]">{label}</span>
      <span className="max-w-[55%] text-right text-[13px] font-medium text-[#1a1a1a]">
        {value}
      </span>
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-4 rounded-xl border border-[#efefec] p-4"
        >
          <div className="h-14 w-14 shrink-0 rounded-lg bg-[#f3f3f1]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/2 rounded bg-[#f3f3f1]" />
            <div className="h-3 w-1/3 rounded bg-[#f3f3f1]" />
          </div>
          <div className="h-3.5 w-16 rounded bg-[#f3f3f1]" />
          <div className="h-6 w-24 rounded-full bg-[#f3f3f1]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3f3f1]">
        <Circle className="h-7 w-7 text-[#bbb]" />
      </div>
      <p className="mt-4 text-[15px] font-semibold text-[#1a1a1a]">
        No hay pedidos
      </p>
      <p className="mt-1.5 max-w-xs text-[13px] text-[#888]">
        Cuando un cliente compre uno de tus productos, aparecerá aquí.
      </p>
    </div>
  );
}
