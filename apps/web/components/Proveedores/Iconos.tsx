/**
 * Iconos de la landing de proveedores. Trazo de 1.5 sobre rejilla de 24,
 * el mismo grosor en los cuatro para que la fila se lea pareja.
 */

export function Chevron({ className }: { className?: string }) {
	return (
		<svg
			width="15"
			height="15"
			viewBox="0 0 14 14"
			fill="none"
			aria-hidden="true"
			className={className}
		>
			<path
				d="M5.833 10.5L9.333 7L5.833 3.5"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function Marco({ children }: { children: React.ReactNode }) {
	return (
		<svg
			width="26"
			height="26"
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			className="text-tinta"
		>
			{children}
		</svg>
	);
}

export function IconoCatalogo() {
	return (
		<Marco>
			<path
				d="M12 3.2l8.3 4.6-8.3 4.6-8.3-4.6 8.3-4.6zM3.7 12.4l8.3 4.6 8.3-4.6M3.7 16.6l8.3 4.6 8.3-4.6"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</Marco>
	);
}

export function IconoPrecio() {
	return (
		<Marco>
			<path
				d="M12 4.5v15M15.5 8.2c0-1.5-1.6-2.4-3.5-2.4s-3.5.8-3.5 2.4c0 3.6 7 1.8 7 5.4 0 1.6-1.6 2.5-3.5 2.5s-3.5-.9-3.5-2.5"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</Marco>
	);
}

export function IconoPedido() {
	return (
		<Marco>
			<path
				d="M6.5 3.8h11a1.5 1.5 0 011.5 1.5v13.4a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 18.7V5.3a1.5 1.5 0 011.5-1.5z"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M8.6 9.2h6.8M8.6 12.6h6.8M8.6 16h4"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</Marco>
	);
}

export function IconoPerfil() {
	return (
		<Marco>
			<circle
				cx="12"
				cy="8.4"
				r="3.6"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M5.2 19.4c0-3.2 3-5.4 6.8-5.4s6.8 2.2 6.8 5.4"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</Marco>
	);
}
