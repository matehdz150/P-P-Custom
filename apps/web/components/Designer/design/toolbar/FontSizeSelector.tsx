"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const FONT_SIZES = [20, 24, 28, 32, 40, 48, 56, 72, 96];

export function FontSizeSelector({
	value,
	onChange,
}: {
	value: number;
	onChange: (size: number) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<div className="flex items-center gap-2">
			{/* DROPDOWN BUTTON */}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						className="w-20 justify-between px-2 py-1 text-sm rounded-[0.2rem] shadow-none"
					>
						{value}
						<ChevronsUpDown className="h-4 w-4 opacity-50" />
					</Button>
				</PopoverTrigger>

				<PopoverContent className="w-28 p-0 z-310">
					<Command>
						<CommandList>
							<CommandGroup>
								{FONT_SIZES.map((size) => (
									<CommandItem
										key={size}
										value={String(size)}
										onSelect={() => {
											onChange(size);
											setOpen(false);
										}}
										className="cursor-pointer"
									>
										<Check
											className={cn(
												"mr-2 h-4 w-4",
												value === size ? "opacity-100" : "opacity-0",
											)}
										/>
										{size}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
