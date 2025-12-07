"use client";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface CrumbItem {
	label: string;
	href?: string;
}

export default function AppBreadcrumb({ items }: { items: CrumbItem[] }) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				{items.map((item, index) => {
					const isLast = index === items.length - 1;

					return (
						<div
							key={`${item.label}-${item.href ?? index}`}
							className="flex items-center"
						>
							<BreadcrumbItem>
								{isLast ? (
									<BreadcrumbPage className="font-semibold text-black">
										{item.label}
									</BreadcrumbPage>
								) : (
									<BreadcrumbLink
										href={item.href}
										className="text-gray-600 hover:text-black transition"
									>
										{item.label}
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>

							{!isLast && <BreadcrumbSeparator />}
						</div>
					);
				})}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
