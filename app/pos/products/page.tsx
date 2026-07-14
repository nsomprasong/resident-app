import { PosProductsBoard } from "@/components/pos/PosProductsBoard";
import { PosShell } from "@/components/pos/PosShell";

export const dynamic = "force-dynamic";
export default function PosProductsPage() {
  return <PosShell title="สินค้าและหมวดหมู่" description="จัดการทะเบียนสินค้า POS และสถานะการขาย"><PosProductsBoard /></PosShell>;
}
