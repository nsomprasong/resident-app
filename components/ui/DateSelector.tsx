import { CalendarDays } from "lucide-react";

export default function DateSelector({ date, setDate }: { date: string; setDate: (date: string) => void }) {
  return <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"><CalendarDays size={18} className="text-indigo-600" /><input aria-label="เลือกวันที่" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="bg-transparent outline-none" /></label>;
}
