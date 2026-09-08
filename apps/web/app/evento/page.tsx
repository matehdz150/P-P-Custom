import { Suspense } from "react";
import EventoPublico from "@/components/Eventos/EventoPublico";

export default function EventoPage() {
	return (
		<Suspense
			fallback={
				<div className="min-h-screen bg-hueso p-8">Abriendo evento…</div>
			}
		>
			<EventoPublico />
		</Suspense>
	);
}
