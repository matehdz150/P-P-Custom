"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { AVAILABLE_FONTS } from "@/lib/fabric/fontList";
import { cn } from "@/lib/utils";

export function FontSelector({
	value,
	onChange,
}: {
	value: string;
	onChange: (font: string) => void;
}) {
	const [open, setOpen] = React.useState(false);

	const selectedLabel =
		AVAILABLE_FONTS.find((f) => f.family === value)?.label || value;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					className="w-38 justify-between rounded-[0.2rem] overflow-hidden shadow-none text-sm"
				>
					<span style={{ fontFamily: value }}>{selectedLabel}</span>
					<ChevronsUpDown className="h-4 w-4 opacity-50" />
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-56 p-0 z-310">
				<Command>
					<CommandInput placeholder="Search font..." />
					<CommandList>
						<CommandEmpty>No font found.</CommandEmpty>

						<CommandGroup>
							{AVAILABLE_FONTS.map((font) => (
								<CommandItem
									key={font.family}
									value={font.label}
									onSelect={() => {
										onChange(font.family);
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											"mr-2 h-4 w-4",
											font.family === value ? "opacity-100" : "opacity-0",
										)}
									/>
									<span style={{ fontFamily: font.family }}>{font.label}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
