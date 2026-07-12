const styles: Record<string, string> = {
  "รอดำเนินการ": "bg-amber-50 text-amber-700 ring-amber-200",
  "ยืนยันแล้ว": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "เช็คอิน": "bg-blue-50 text-blue-700 ring-blue-200",
  "เช็คเอาท์": "bg-slate-100 text-slate-600 ring-slate-200",
};

export default function Status({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${styles[status] ?? styles["เช็คเอาท์"]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}
