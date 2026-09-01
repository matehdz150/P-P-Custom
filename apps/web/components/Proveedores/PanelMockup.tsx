import Image from "next/image";

/** Un renglón de la tabla de pedidos del panel. */
type Pedido = {
	producto: string;
	imagen: string;
	ficha: string;
	piezas: string;
	entrega: string;
	estado: string;
	/** El color del estado: lima recién llegado, lavanda en curso, sin fondo cerrado. */
	tono: "nuevo" | "curso" | "cerrado";
};

const PEDIDOS: Pedido[] = [
	{
		producto: "Playera cuello redondo",
		imagen: "/products/tshirt.png",
		ficha: "Serigrafía · frente · negro",
		piezas: "50 pz",
		entrega: "Entrega en 9 días",
		estado: "Nuevo",
		tono: "nuevo",
	},
	{
		producto: "Gorra snapback",
		imagen: "/products/cap.png",
		ficha: "Bordado · frente · marino",
		piezas: "24 pz",
		entrega: "Entrega en 6 días",
		estado: "En producción",
		tono: "curso",
	},
	{
		producto: "Tote bag natural",
		imagen: "/products/totebag.png",
		ficha: "Serigrafía · frente · crudo",
		piezas: "120 pz",
		entrega: "Entregado el 12 de agosto",
		estado: "Cerrado",
		tono: "cerrado",
	},
];

const TONOS: Record<Pedido["tono"], string> = {
	nuevo: "bg-lima text-tinta",
	curso: "bg-lavanda text-tinta",
	cerrado: "border-[1.5px] border-tinta/20 text-tinta/60",
};

/**
 * El panel del proveedor dentro de una ventana de navegador. Es la prueba de
 * la promesa del hero: el pedido llega con todo definido.
 */
export default function PanelMockup() {
	return (
		<div className="overflow-hidden rounded-xl border border-tinta/12 bg-white shadow-[0_18px_40px_0_rgba(43,40,18,0.10)] md:shadow-[0_20px_48px_0_rgba(43,40,18,0.10)]">
			<div className="flex h-[38px] items-center gap-2.5 border-b border-[#e4e4e0] bg-gris px-3 md:h-11 md:gap-3.5 md:px-4">
				<div className="flex items-center gap-[5px] md:gap-[7px]">
					<span className="block h-[9px] w-[9px] rounded-full bg-[#dcdcd6] md:h-[11px] md:w-[11px]" />
					<span className="block h-[9px] w-[9px] rounded-full bg-[#dcdcd6] md:h-[11px] md:w-[11px]" />
					<span className="block h-[9px] w-[9px] rounded-full bg-[#dcdcd6] md:h-[11px] md:w-[11px]" />
				</div>
				<span className="flex-1 text-center text-[11px] text-tinta/55 md:hidden">
					kustto.mx/proveedor
				</span>
				<div className="hidden flex-1 justify-center md:flex">
					<span className="rounded-lg border border-[#e4e4e0] bg-white px-4 py-[5px] text-xs text-tinta/55">
						kustto.mx/proveedor
					</span>
				</div>
				<div className="hidden w-[47px] md:block" />
			</div>

			<div className="flex flex-col gap-3.5 bg-white px-4 pb-5 pt-[18px] md:gap-[22px] md:px-7 md:pb-[30px] md:pt-[26px]">
				<div className="flex items-center justify-between gap-6">
					<span className="font-display text-[18px] font-semibold leading-none tracking-[-0.032em] text-tinta md:text-2xl">
						Pedidos asignados
					</span>
					<div className="hidden items-center gap-2 md:flex">
						<span className="rounded-lg bg-lima px-4 py-2 text-[13px] font-semibold text-tinta">
							Todos
						</span>
						<span className="rounded-lg border-[1.5px] border-tinta/15 px-4 py-2 text-[13px] font-medium text-tinta">
							Nuevos
						</span>
						<span className="rounded-lg border-[1.5px] border-tinta/15 px-4 py-2 text-[13px] font-medium text-tinta">
							En producción
						</span>
					</div>
				</div>

				<div className="flex flex-col">
					{PEDIDOS.map((p, i) => (
						<div
							key={p.producto}
							className={`flex items-center gap-3 border-t border-tinta/14 py-3 md:gap-[18px] md:py-[15px] ${
								i === PEDIDOS.length - 1 ? "border-b border-tinta/14" : ""
							} ${p.tono === "cerrado" ? "hidden md:flex" : ""}`}
						>
							<div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-gris md:h-[52px] md:w-[52px] md:rounded-xl">
								<Image
									src={p.imagen}
									alt=""
									width={80}
									height={100}
									className="max-h-[84%] w-auto max-w-[74%] object-contain"
								/>
							</div>

							<div className="flex min-w-0 flex-1 flex-col gap-0.5 md:w-80 md:flex-none md:gap-[3px]">
								<span className="truncate text-sm font-semibold text-tinta md:text-[15px]">
									{p.producto}
								</span>
								<span className="text-xs text-tinta/55 md:text-[13px]">
									<span className="md:hidden">
										{p.piezas} · {p.entrega.replace("Entrega en ", "")}
									</span>
									<span className="hidden md:inline">{p.ficha}</span>
								</span>
							</div>

							<span className="hidden w-[90px] text-[15px] font-medium text-tinta md:block">
								{p.piezas}
							</span>
							<span className="hidden flex-1 text-[13px] text-tinta/55 md:block">
								{p.entrega}
							</span>

							<span
								className={`shrink-0 rounded-lg px-[11px] py-[5px] text-[11px] font-semibold md:px-3.5 md:py-1.5 md:text-xs ${TONOS[p.tono]}`}
							>
								{p.estado}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
