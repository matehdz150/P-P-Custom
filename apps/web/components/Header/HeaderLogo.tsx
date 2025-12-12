"use client";
import Image from "next/image";
import Link from "next/link";

export default function HeaderLogo() {
	return (
		<div className="mr-8">
			<Link href="/">
				<Image src="/logo2.png" alt="P&P Custom" width={160} height={152} />
			</Link>
		</div>
	);
}
