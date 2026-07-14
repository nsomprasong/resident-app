import { PosShell } from "@/components/pos/PosShell";
import { PosShiftsBoard } from "@/components/pos/PosShiftsBoard";

export const dynamic = "force-dynamic";
export default function PosShiftsPage() {
  return <PosShell title="กะขายและเงินสด" description="ตรวจสอบกะ เงินเข้าออก ปิดกะ และอนุมัติผลต่าง"><PosShiftsBoard /></PosShell>;
}
