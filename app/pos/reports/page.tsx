import { PosReportsBoard } from "@/components/pos/PosReportsBoard";
import { PosShell } from "@/components/pos/PosShell";

export const dynamic = "force-dynamic";
export default function PosReportsPage() {
  return <PosShell title="รายงาน POS" description="สรุปยอดขาย ช่องทางชำระ สินค้าใกล้หมด และส่งออก CSV"><PosReportsBoard /></PosShell>;
}
