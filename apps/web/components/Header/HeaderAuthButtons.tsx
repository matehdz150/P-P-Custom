import Link from "next/link";

export default function HeaderAuthButtons() {
	return (
		<div className="ml-auto hidden md:flex items-center gap-4 whitespace-nowrap">
			<Link href="/login" className="rounded-sm border p-3 text-sm font-bold">
				Iniciar sesión
			</Link>

			<Link
				href="/register"
				className="rounded-[0.2rem] bg-[#fe6241] p-3 text-sm font-bold text-black"
			>
				Registrarse
			</Link>
		</div>
	);
}
