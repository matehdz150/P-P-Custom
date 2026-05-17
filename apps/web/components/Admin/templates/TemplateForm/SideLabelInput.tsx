"use client";

import { Input } from "@/components/ui/input";

type Props = {
  value?: string;
  onChange: (next: string) => void;
};

export function SideLabelInput({ value, onChange }: Props) {
  return (
    <Input
      placeholder="Label (ej. Delante)"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}