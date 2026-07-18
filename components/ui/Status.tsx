const styles: Record<string, string> = {
  "รอดำเนินการ": "bg-warning/10 text-warning ring-warning/30",
  "ยืนยันแล้ว": "bg-success/10 text-success ring-success/30",
  "เช็กอิน": "bg-sky-500/10 text-sky-700 ring-sky-500/30",
  "เช็คอิน": "bg-sky-500/10 text-sky-700 ring-sky-500/30",
  "เช็กเอาต์": "bg-amber-500/10 text-amber-700 ring-amber-500/30",
  "เช็คเอาท์": "bg-amber-500/10 text-amber-700 ring-amber-500/30",
  "ปิดงานแล้ว": "bg-emerald-600/10 text-emerald-700 ring-emerald-600/30",
  "ยกเลิก": "bg-destructive/10 text-destructive ring-destructive/30",
};

export default function Status({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${styles[status] ?? styles["เช็คเอาท์"]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}
