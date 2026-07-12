export default function BillDetail({ title, price, isEdit, summarize = false }: { title: string; price: number; isEdit: boolean; summarize?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 py-1 ${summarize ? "font-semibold" : "text-sm"}`}><span>{title}</span>{isEdit ? <input aria-label={`ราคา ${title}`} type="number" defaultValue={price} className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right outline-none focus:border-indigo-500" /> : <span>฿{price.toLocaleString()}</span>}</div>;
}
