import Link from "next/link";
import Aparece from "./Aparece";

export default function CierreProveedores() {
	return (
		<section className="px-5 pt-14 pb-16 md:px-14 md:pt-24 md:pb-25">
			<Aparece className="flex flex-col gap-[22px] border-t-[1.5px] border-tinta pt-[30px] md:flex-row md:items-end md:justify-between md:gap-16 md:pt-11">
				<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] text-tinta md:max-w-[800px] md:text-[44px] md:leading-[54px]">
					Nada de esto lo produce una sola fábrica
				</h2>
				<Link
					href="/proveedores"
					className="flex h-14 shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-lima px-8 text-base font-semibold text-tinta"
				>
					Conoce a los proveedores
					<svg
						width="15"
						height="15"
						viewBox="0 0 14 14"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M5.833 10.5L9.333 7L5.833 3.5"
							stroke="currentColor"
							strokeWidth="1.7"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</Link>
			</Aparece>
		</section>
	);
}
