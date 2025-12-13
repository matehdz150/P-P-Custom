"use client";

import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DEFAULT_FONT_SIZES = [12, 14, 16, 18, 24, 32, 42, 56, 72];

type FontSizeComboboxProps = {
	value: number;
	onChange: (size: number) => void;
};

export function FontSizeCombobox({ value, onChange }: FontSizeComboboxProps) {
	const [open, setOpen] = React.useState(false);
	const [, setInput] = React.useState(value.toString());

	// sync externo → input
	React.useEffect(() => {
		setInput(String(value));
	}, [value]);

	const applyValue = (v: number) => {
		if (Number.isNaN(v)) return;
		onChange(Math.max(6, Math.min(300, v)));
		setOpen(false);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="h-9 px-2 text-sm gap-1 rounded-[0.2rem] shadow-none"
				>
					{value}
					<ChevronDown className="h-3 w-3 opacity-50" />
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-[72px] p-0">
				<Command className="w-full">
					<CommandGroup>
						{DEFAULT_FONT_SIZES.map((size) => (
							<CommandItem
								key={size}
								value={String(size)}
								onSelect={() => applyValue(size)}
								className="justify-center px-0 relative"
							>
								<Check
									className={cn(
										"absolute left-2 h-3 w-3",
										value === size ? "opacity-100" : "opacity-0",
									)}
								/>
								<span className="text-xs">{size}</span>
							</CommandItem>
						))}
					</CommandGroup>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
