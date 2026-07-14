import { PosShell } from "@/components/pos/PosShell";
import { PosStockBoard } from "@/components/pos/PosStockBoard";

export const dynamic = "force-dynamic";
export default function PosStockPage() {
  return <PosShell title="จัดการสต๊อก" description="รับเข้า ปรับยอด ตรวจนับ และดูประวัติสินค้า"><PosStockBoard /></PosShell>;
}
