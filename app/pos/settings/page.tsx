import { PosSettingsBoard } from "@/components/pos/PosSettingsBoard";
import { PosShell } from "@/components/pos/PosShell";

export const dynamic = "force-dynamic";
export default function PosSettingsPage() {
  return <PosShell title="ตั้งค่า POS" description="กำหนดร้าน ใบเสร็จ การคืนสินค้า และการควบคุมสต๊อก"><PosSettingsBoard /></PosShell>;
}
