export const inspectionItemTypeOptions = [
  { value: "MINIBAR", label: "มินิบาร์" },
  { value: "DAMAGE", label: "ความเสียหาย" },
  { value: "STAIN", label: "คราบสกปรก" },
  { value: "MISSING", label: "ของหาย" },
  { value: "OTHER", label: "อื่นๆ" },
] as const;

export type InspectionItemTypeValue =
  (typeof inspectionItemTypeOptions)[number]["value"];

export type InspectionCatalogMasterRecord = {
  id: string;
  name: string;
  type: InspectionItemTypeValue;
  unitPrice: number;
  isActive: boolean;
};
