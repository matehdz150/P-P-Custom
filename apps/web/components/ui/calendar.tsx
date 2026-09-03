"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: React.ComponentProps<typeof DayPicker>) {
	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn("w-fit p-3", className)}
			classNames={{
				months: "flex flex-col",
				month: "space-y-3",
				month_caption: "relative flex h-9 items-center justify-center",
				caption_label: "text-sm font-semibold capitalize text-tinta",
				nav: "absolute inset-x-3 top-3 flex items-center justify-between",
				button_previous:
					"inline-flex size-9 items-center justify-center rounded-full text-tinta/55 hover:bg-gris hover:text-tinta",
				button_next:
					"inline-flex size-9 items-center justify-center rounded-full text-tinta/55 hover:bg-gris hover:text-tinta",
				month_grid: "w-full border-collapse",
				weekdays: "flex",
				weekday:
					"w-10 py-1 text-center text-[11px] font-medium uppercase text-tinta/35",
				week: "mt-1 flex w-full",
				day: "relative size-10 p-0 text-center text-sm",
				day_button:
					"inline-flex size-10 items-center justify-center rounded-full text-[13px] text-tinta hover:bg-gris focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tinta/20",
				today: "[&>button]:font-bold [&>button]:ring-1 [&>button]:ring-tinta/20",
				outside: "opacity-30",
				disabled: "opacity-25",
				range_start: "rounded-l-full bg-tinta/8 [&>button]:bg-tinta [&>button]:text-white",
				range_middle:
					"bg-tinta/8 [&>button]:rounded-none [&>button]:!bg-transparent [&>button]:!text-tinta",
				range_end: "rounded-r-full bg-tinta/8 [&>button]:bg-tinta [&>button]:text-white",
				selected: "[&>button]:bg-tinta [&>button]:text-white",
				hidden: "invisible",
				...classNames,
			}}
			components={{
				Chevron: ({ orientation, ...chevronProps }) =>
					orientation === "left" ? (
						<ChevronLeft className="size-4" {...chevronProps} />
					) : (
						<ChevronRight className="size-4" {...chevronProps} />
					),
			}}
			{...props}
		/>
	);
}

export { Calendar };
