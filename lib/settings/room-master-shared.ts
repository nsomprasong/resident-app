export const roomStatusOptions = [
  { value: "AVAILABLE", label: "พร้อมใช้งาน" },
  { value: "OCCUPIED", label: "มีผู้เข้าพัก" },
  { value: "CLEANING", label: "ทำความสะอาด" },
  { value: "MAINTENANCE", label: "ปิดซ่อม / ไม่เปิดจอง" },
] as const;

export type RoomStatusValue = (typeof roomStatusOptions)[number]["value"];

export type RoomMasterRecord = {
  id: string;
  number: string;
  floor: number | null;
  status: RoomStatusValue;
  zone: { id: string; name: string; isActive: boolean };
  roomType: { id: string; name: string; isActive: boolean };
};
