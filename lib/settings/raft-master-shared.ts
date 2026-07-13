export const raftStatusOptions = [
  { value: "AVAILABLE", label: "พร้อมใช้งาน" },
  { value: "MAINTENANCE", label: "ปิดซ่อม / ไม่เปิดจอง" },
] as const;

export type RaftStatusValue = (typeof raftStatusOptions)[number]["value"];

export type RaftMasterRecord = {
  id: string;
  number: string;
  name: string;
  capacity: number;
  basePrice: number;
  status: RaftStatusValue;
};
