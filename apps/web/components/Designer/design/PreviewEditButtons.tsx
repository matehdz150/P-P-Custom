"use client";

export default function PreviewEditButtons() {
	return (
		<div className="absolute top-1 right-4 flex items-center py-2  z-400">
			<button
				type="button"
				className={
					"px-12 py-2.5 rounded-l-md w-full bg-black text-white border border-r-0"
				}
				title="Deshacer"
			>
				<span className="font-semibold">Editar</span>
			</button>

			<button
				type="button"
				className={
					"px-12 py-2.5 rounded-r-md w-full bg-white border border-l-0"
				}
				title="Rehacer"
			>
				<span className="font-semibold">Probar</span>
			</button>
		</div>
	);
}
