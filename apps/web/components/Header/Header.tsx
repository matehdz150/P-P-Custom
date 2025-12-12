"use client";

import HeaderAuthButtons from "./HeaderAuthButtons";
import HeaderDesktopNav from "./HeaderDesktopNav";
import HeaderMobile from "./HeaderMobile";

export function Header() {
	return (
		<header className="w-full border-b bg-white">
			{/* 🖥 DESKTOP HEADER (centrado y con max-width) */}
			<div className="hidden md:flex h-16 items-center mx-auto max-w-7xl w-full px-6">
				<HeaderDesktopNav />
				<HeaderAuthButtons />
			</div>

			{/* 📱 MOBILE HEADER (full width, independiente) */}
			<div className="md:hidden w-full">
				<HeaderMobile />
			</div>
		</header>
	);
}
