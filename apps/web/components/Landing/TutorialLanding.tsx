import Image from "next/image";

export default function TutorialLanding() {
	return (
		<div
			className="
        w-full 
        flex flex-col md:flex-row 
        items-start md:items-center 
        justify-center 
        gap-12 
        px-6 md:px-10 
        py-10 md:py-20
      "
		>
			{/* --------------------------------- */}
			{/*   LEFT SECTION — TEXT STEPS       */}
			{/* --------------------------------- */}
			<div
				className="
          flex flex-col 
          text-left 
          gap-8 md:gap-10 
          w-full md:w-1/2 
          ml-0 md:ml-35
          text-3xl sm:text-4xl
        "
			>
				<h1 className="font-bold leading-tight">
					Crea productos <br /> en minutos
				</h1>

				{/* STEP 1 */}
				<div className="mt-4 md:mt-12 text-xl sm:text-2xl border-b-2 pb-5 border-black">
					<div className="flex gap-5">
						<h1 className="text-3xl sm:text-4xl font-bold">1</h1>
						<h2>
							Escoge un <br /> producto
						</h2>
					</div>

					<div className="flex-col font-light ml-6 sm:ml-8 mt-1">
						<span className="block text-[1rem] ">
							Explora nuestro catálogo y descubre artículos ideales para tu
							marca.
						</span>
						<span className="block text-[1rem]">
							Tenemos opciones para eventos, negocios y proyectos personales.
						</span>
					</div>
				</div>

				{/* STEP 2 */}
				<div className="mt-6 md:mt-10 text-xl sm:text-2xl border-b-2 pb-5 border-black">
					<div className="flex gap-5">
						<h1 className="text-3xl sm:text-4xl font-bold">2</h1>
						<h2>
							Diseña tu <br /> creacion
						</h2>
					</div>

					<div className="flex-col font-light ml-6 sm:ml-10 mt-1">
						<span className="block text-[1rem]">
							Personaliza colores, textos e imágenes con nuestro editor
							sencillo.
						</span>
						<span className="block text-[1rem]">
							Da tu toque especial y visualiza el resultado en tiempo real.
						</span>
					</div>
				</div>

				{/* STEP 3 */}
				<div className="mt-6 md:mt-10 text-xl sm:text-2xl border-b-2 pb-5 border-black">
					<div className="flex gap-5">
						<h1 className="text-3xl sm:text-4xl font-bold">3</h1>
						<h2>
							Haz tu <br /> pedido
						</h2>
					</div>

					<div className="flex-col font-light ml-6 sm:ml-10 mt-1">
						<span className="block text-[1rem]">
							Finaliza tu compra y nosotros nos encargamos de producirlo.
						</span>
						<span className="block text-[1rem]">
							DRápido, seguro y con calidad garantizada.
						</span>
					</div>
				</div>
				{/* BOTON */}
				<button
					type="button"
					className=" bg-black w-60 h-15 text-sm rounded-[0.2rem] text-white mt-10"
				>
					Empieza a diseñar
				</button>
			</div>

			{/* --------------------------------- */}
			{/*   RIGHT SECTION — IMAGE           */}
			{/* --------------------------------- */}
			<div className="w-full md:w-1/2 flex justify-center mt-6 md:mt-0">
				<div className="relative w-full max-w-[620px] h-[280px] sm:h-[260px] md:h-230 bg-[#F5F5F5] overflow-hidden">
					<Image
						src="/tutorial2.png"
						alt="tutorial-step"
						fill
						className="object-cover"
					/>
				</div>
			</div>
		</div>
	);
}
