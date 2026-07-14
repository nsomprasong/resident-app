import { PosShell } from "@/components/pos/PosShell";
import { PosTerminal } from "@/components/pos/PosTerminal";

export const dynamic = "force-dynamic";
export default function PosPage() {
  return (
    <PosShell
      title="ขายหน้าร้าน"
      description="ค้นหาหรือสแกนสินค้า จัดตะกร้า รับชำระ และพิมพ์ใบเสร็จได้ในจอเดียว"
    >
      <PosTerminal />
    </PosShell>
  );
}
