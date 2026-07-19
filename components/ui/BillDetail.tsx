import { ImageIcon, Pencil } from "lucide-react";

export default function BillDetail({
  title,
  price,
  isEdit,
  summarize = false,
  imageUrl,
  onViewImage,
  onEdit,
}: {
  title: string;
  price: number;
  isEdit: boolean;
  summarize?: boolean;
  imageUrl?: string | null;
  onViewImage?: (imageUrl: string, title: string) => void;
  onEdit?: () => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-1 ${summarize ? "font-semibold" : "text-sm"}`}
    >
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="truncate">{title}</span>
        {imageUrl && onViewImage ? (
          <button
            type="button"
            onClick={() => onViewImage(imageUrl, title)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-foreground hover:border-primary/40 hover:bg-primary/5"
            aria-label={`ดูรูป ${title}`}
          >
            <ImageIcon size={14} />
            ดูรูป
          </button>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs text-foreground hover:border-primary/40 hover:bg-primary/5"
            aria-label={`แก้ไข ${title}`}
          >
            <Pencil size={14} />
            แก้ไข
          </button>
        ) : null}
      </span>
      {isEdit ? (
        <input
          aria-label={`ราคา ${title}`}
          type="number"
          defaultValue={price}
          className="w-28 rounded-lg border border-border px-2 py-1 text-right outline-none focus:border-primary"
        />
      ) : (
        <span className="shrink-0">฿{price.toLocaleString()}</span>
      )}
    </div>
  );
}
