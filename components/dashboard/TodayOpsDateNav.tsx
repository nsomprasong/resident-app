import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

type TodayOpsDateNavProps = {
  selectedKey: string;
  todayKey: string;
  nextKey: string;
};

export default function TodayOpsDateNav({
  selectedKey,
  todayKey,
  nextKey,
}: TodayOpsDateNavProps) {
  const isToday = selectedKey === todayKey;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/today"
        aria-current={isToday ? "page" : undefined}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
          isToday
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-surface text-foreground hover:bg-muted"
        }`}
      >
        <CalendarDays size={16} />
        วันนี้
      </Link>
      <Link
        href={`/today?date=${nextKey}`}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        วันถัดไป
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}
