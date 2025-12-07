import { Sora } from "next/font/google";
import Image from "next/image";

const sora = Sora({
	subsets: ["latin-ext"],
	weight: ["300", "400", "500", "600", "700", "800"],
	display: "swap",
});

export default function ProductSample() {
	return (
		<div className="w-full flex flex-col items-center">
			{/* ---------- CONTENEDOR DE TARJETAS ---------- */}
			<div
				className="
          w-full 
          max-w-[60%] 
          mx-auto 
          flex 
          flex-col 
          md:flex-row 
          justify-center 
          gap-6 
          mt-10
        "
			>
				{[
					{ img: "/prueba2.png", title: "Productos", subtitle: "Para eventos" },
					{
						img: "/business.png",
						title: "Productos",
						subtitle: "Para negocios",
					},
				].map((card) => (
					<div
						key={`${card.title}-${card.subtitle}`}
						className="
              relative 
              w-full 
              h-72 
              sm:h-80 
              md:h-110 
              bg-[#F2F1EF] 
              overflow-hidden 
              group 
              cursor-pointer
            "
					>
						{/* Imagen */}
						<Image
							src={card.img}
							alt={card.title}
							fill
							className="
                object-cover 
                transition-transform 
                duration-500 
                ease-out 
                group-hover:scale-105
              "
						/>

						{/* Overlay */}
						<div
							className="
                absolute inset-0 
                bg-black/30 
                transition-all 
                duration-500 
                group-hover:bg-black/50
              "
						></div>

						{/* Texto */}
						<h1
							className={`
                absolute 
                z-10 
                text-white 
                font-bold 
                leading-tight 
                text-right
                ${sora.className}
                right-4 
                top-6 
                text-3xl 
                sm:text-4xl 
                md:text-4xl 
                transition-all 
                duration-500 
                group-hover:translate-y-[-4px] 
                group-hover:text-[2.7rem]
              `}
						>
							{card.title}
							<br />
							{card.subtitle}
						</h1>
					</div>
				))}
			</div>

			{/* ---------- TEXTO INFORMATIVO DEBAJO ---------- */}
			<div className="w-full flex flex-col items-center mt-10 gap-2 text-center">
				<p className={`text-lg font-semibold text-[#2A2A26] ${sora.className}`}>
					Tu marca, en buenas manos
				</p>

				<p className={`text-sm text-[#555] ${sora.className}`}>
					Tecnología de impresión moderna y materiales de alta calidad.
				</p>
			</div>
		</div>
	);
}
