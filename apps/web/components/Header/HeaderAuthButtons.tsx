"use client";

import Link from "next/link";
import { useAuth } from "@/Contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/api/api";

export default function HeaderAuthButtons() {
	const { user, loading } = useAuth();

	// Mientras carga, no mostramos nada (evita flicker)
	if (loading) return null;

	// ❌ NO LOGEADO
	if (!user) {
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

	// ✅ LOGEADO
	// ✅ LOGEADO
	return (
		<div className="ml-auto hidden md:flex items-center">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button className="flex items-center gap-3 outline-none">
						{/* Avatar */}
						<Avatar className="h-9 w-9">
							<AvatarFallback className="bg-[#fe6241] text-black font-bold">
								{user.name?.[0]?.toUpperCase() ?? user.email[0].toUpperCase()}
							</AvatarFallback>
						</Avatar>

						{/* Nombre + email */}
						<div className="flex flex-col items-start leading-tight">
							<span className="text-sm font-semibold text-black">
								{user.name ?? "Usuario"}
							</span>
							<span className="text-xs text-gray-500">{user.email}</span>
						</div>
					</button>
				</DropdownMenuTrigger>

				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuItem asChild>
						<Link href="/dashboard">Dashboard</Link>
					</DropdownMenuItem>

					<DropdownMenuItem
						className="text-red-600 cursor-pointer"
						onClick={logout}
					>
						Cerrar sesión
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
