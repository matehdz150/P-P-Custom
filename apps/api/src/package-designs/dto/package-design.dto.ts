export interface EnsurePackageDesignDto {
  packageId: string;
}

export interface SetUnitDto {
  packageItemId: string;
  unitIndex: number;
  designId: string | null;
}

export interface SetUnitsDto {
  units: SetUnitDto[];
}
