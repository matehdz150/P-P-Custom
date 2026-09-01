import Link from "next/link";

const COLUMNAS = [
	{
		titulo: "CATÁLOGO",
		enlaces: [
			{ label: "Todos los productos", href: "/catalogo" },
			{ label: "Para eventos", href: "/catalogo/eventos" },
			{ label: "Para empresas", href: "/catalogo/empresariales" },
			{ label: "Paquetes", href: "/catalogo/eventos" },
			{ label: "Editor de diseño", href: "/design" },
		],
	},
	{
		titulo: "PROVEEDORES",
		enlaces: [
			{ label: "Publica tus productos", href: "/proveedores" },
			{ label: "Panel de proveedor", href: "/proveedor" },
			{ label: "Iniciar sesión", href: "/proveedor/login" },
			{ label: "Crear cuenta", href: "/register" },
		],
	},
	{
		titulo: "CONTACTO",
		enlaces: [
			{ label: "[TU CORREO]", href: "#" },
			{ label: "[TU WHATSAPP]", href: "#" },
			{ label: "[TU INSTAGRAM]", href: "#" },
			{ label: "Rastrea tu pedido", href: "/rastreo" },
		],
	},
];

export default function Footer() {
	return (
		<footer className="bg-tinta px-5 pb-10 pt-14 md:px-8 md:pb-10 md:pt-[76px]">
			<div className="mx-auto flex max-w-[1200px] flex-col gap-10 md:gap-16">
				<div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10">
					<div className="col-span-2 flex flex-col gap-4 md:col-span-1">
						<span className="font-brand text-xl font-bold tracking-[-0.05em] leading-none text-hueso">
							kustto
						</span>
						<p className="max-w-[240px] text-sm leading-6 text-hueso/55">
							Personalización bajo demanda, hecha en México.
						</p>
					</div>

					{COLUMNAS.map((col) => (
						<div key={col.titulo} className="flex flex-col gap-3.5">
							<span className="text-xs font-semibold tracking-[1.1px] text-hueso/45">
								{col.titulo}
							</span>
							{col.enlaces.map((e) => (
								<Link
									key={e.label}
									href={e.href}
									className="text-[15px] text-hueso/80 hover:text-lima"
								>
									{e.label}
								</Link>
							))}
						</div>
					))}
				</div>

				<div className="flex flex-col gap-3 border-t border-hueso/15 pt-6 md:flex-row md:items-center md:justify-between md:gap-8 md:pt-7">
					<span className="text-[13px] text-hueso/50">
						© 2026 kustto · México (es-MX)
					</span>
					<div className="flex items-center gap-7">
						<Link href="#" className="text-[13px] text-hueso/50">
							Aviso de privacidad
						</Link>
						<Link href="#" className="text-[13px] text-hueso/50">
							Términos y condiciones
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
}
