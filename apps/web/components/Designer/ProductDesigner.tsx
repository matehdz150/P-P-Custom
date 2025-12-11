"use client";

import DesignerCanvas from "./DesignerCanvas";

export default function ProductDesigner({ productId }: { productId: string }) {
	return (
		<div className="w-full flex gap-6">
			<DesignerCanvas productId={productId} />
		</div>
	);
}
