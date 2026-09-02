"use client";

/**
 * "Vas a perder tu diseño."
 *
 * Sale al intentar salir del editor con algo dibujado. El botón que se ve
 * primero es el de quedarse: quien llegó aquí apretando "atrás" por reflejo
 * casi nunca quería tirar su trabajo.
 */
export default function AvisoDeSalida({
	onSalir,
	onQuedarse,
}: {
	onSalir: () => void;
	onQuedarse: () => void;
}) {
	return (
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-tinta/50 px-6"
			role="dialog"
			aria-modal="true"
			aria-labelledby="titulo-aviso-salida"
		>
			<div className="w-full max-w-[400px] rounded-2xl bg-hueso p-6">
				<h2
					id="titulo-aviso-salida"
					className="font-display text-[20px] font-bold leading-7 tracking-[-0.02em] text-tinta"
				>
					Si sales, se pierde tu diseño
				</h2>
				<p className="pt-2 text-[15px] leading-[24px] text-tinta/70">
					Todavía no lo has pedido, así que no está guardado en ningún lado. Si
					sales ahora tendrás que volver a hacerlo desde cero.
				</p>

				<div className="flex flex-col gap-2.5 pt-6">
					<button
						type="button"
						onClick={onQuedarse}
						className="flex h-12 items-center justify-center rounded-lg bg-tinta text-[15px] font-semibold text-lima"
					>
						Seguir editando
					</button>
					<button
						type="button"
						onClick={onSalir}
						className="flex h-12 items-center justify-center rounded-lg text-[15px] font-semibold text-tinta/60 hover:text-tinta"
					>
						Salir y perder el diseño
					</button>
				</div>
			</div>
		</div>
	);
}
