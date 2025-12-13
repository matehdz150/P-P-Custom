"use client";

import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { AVAILABLE_FONTS } from "@/lib/fabric/fontList";
import { cn } from "@/lib/utils";

type FontComboboxProps = {
	value: string;
	onChange: (fontFamily: string) => void;
};

export function FontCombobox({ value, onChange }: FontComboboxProps) {
	const [open, setOpen] = React.useState(false);

	const currentFont =
		AVAILABLE_FONTS.find((f) => f.family === value) ??
		AVAILABLE_FONTS.find((f) => f.family === "Inter");

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className=" min-w-[100px] max-w-[100px] justify-between rounded-[0.2rem] px-3 shadow-none border"
				>
					<span
						className="truncate text-sm"
						style={{ fontFamily: currentFont?.family }}
					>
						{currentFont?.label ?? "Fuente"}
					</span>
					<ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-60 p-0">
				<Command>
					{/* 🔍 INPUT REAL */}
					<CommandInput placeholder="Buscar fuente..." />

					<CommandEmpty>No se encontró la fuente.</CommandEmpty>

					<CommandGroup className="max-h-60 overflow-y-auto">
						{AVAILABLE_FONTS.map((font) => (
							<CommandItem
								key={font.family}
								value={`${font.label} ${font.family}`}
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
				</Command>
			</PopoverContent>
		</Popover>
	);
}
