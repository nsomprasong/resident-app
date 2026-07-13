const styles: Record<string, string> = {
  "รอดำเนินการ": "bg-warning/10 text-warning ring-warning/30",
  "ยืนยันแล้ว": "bg-success/10 text-success ring-success/30",
  "เช็คอิน": "bg-info/10 text-info ring-info/30",
  "เช็คเอาท์": "bg-muted text-muted-foreground ring-border",
};

export default function Status({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${styles[status] ?? styles["เช็คเอาท์"]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}
