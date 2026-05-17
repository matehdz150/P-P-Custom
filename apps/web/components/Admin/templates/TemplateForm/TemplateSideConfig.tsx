"use client";

import { SideLabelInput } from "./SideLabelInput";
import { SideMockupUploader } from "./SideMockupUploader";
import { EditableAreasSection } from "./EditableAreasSection";

import type { EditableArea } from "@/lib/api/templates";

type Props = {
  side: string;
  label?: string;
  mockup?: string;
  areas?: EditableArea[];
  onChange: (partial: {
    label?: string;
    mockup?: string;
    areas?: EditableArea[];
  }) => void;
};

export function TemplateSideConfig({
  side,
  label,
  mockup,
  areas,
  onChange,
}: Props) {
  return (
    <div className="border rounded p-4 space-y-4">
      <h4 className="font-semibold text-lg">
        Side: <span className="uppercase">{side}</span>
      </h4>

      <SideLabelInput
        value={label}
        onChange={(label) => onChange({ label })}
      />

      <SideMockupUploader
        value={mockup}
        onChange={(mockup) => onChange({ mockup })}
      />

      <EditableAreasSection
        value={areas}
        mockup={mockup}
        onChange={(areas) => onChange({ areas })}
      />
    </div>
  );
}