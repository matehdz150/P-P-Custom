import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { getCategories, Category } from "@/lib/api/categories";

export function CategoriesSelector({
	selected,
	onChange,
}: {
	selected: string[];
	onChange: (ids: string[]) => void;
}) {
	const [categories, setCategories] = useState<Category[]>([]);

	useEffect(() => {
		getCategories().then(setCategories);
	}, []);

	function toggle(id: string) {
		if (selected.includes(id)) {
			onChange(selected.filter((c) => c !== id));
		} else {
			onChange([...selected, id]);
		}
	}

	return (
		<div className="space-y-2">
			<p className="text-sm font-medium">Categorías</p>

			<div className="border rounded-md p-3 space-y-2">
				{categories.map((cat) => (
					<label
						key={cat.id}
						className="flex items-center gap-2 text-sm cursor-pointer"
					>
						<Checkbox
							checked={selected.includes(cat.id)}
							onCheckedChange={() => toggle(cat.id)}
						/>
						{cat.name}
					</label>
				))}

				{categories.length === 0 && (
					<p className="text-xs text-muted-foreground">
						No hay categorías creadas
					</p>
				)}
			</div>
		</div>
	);
}
