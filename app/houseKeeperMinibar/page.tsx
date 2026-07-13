"use client";
import { CheckCircle2, ClipboardCheck, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
type ItemType = "MINIBAR" | "DAMAGE" | "STAIN" | "MISSING" | "OTHER";
interface Catalog {
  id: string;
  name: string;
  type: ItemType;
  unitPrice: number;
}
interface Item {
  catalogId?: string;
  type: ItemType;
  description: string;
  quantity: number;
  unitPrice: number;
}
interface Inspection {
  id: string;
  status: string;
  notes?: string;
  room: string;
  customerName: string;
  items: Item[];
}
const typeLabels: Record<ItemType, string> = {
  MINIBAR: "มินิบาร์",
  DAMAGE: "ชำรุด",
  STAIN: "คราบเปื้อน",
  MISSING: "ของหาย",
  OTHER: "อื่น ๆ",
};
export default function HousekeepingPage() {
  const [list, setList] = useState<Inspection[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inspectionResponse, catalogResponse] = await Promise.all([
        fetch("/api/housekeeping/inspections", { cache: "no-store" }),
        fetch("/api/inspection-catalog", { cache: "no-store" }),
      ]);
      const inspectionData = (await inspectionResponse.json()) as
        Inspection[] | { message: string };
      const catalogData = (await catalogResponse.json()) as Catalog[];
      if (!inspectionResponse.ok || !Array.isArray(inspectionData))
        throw new Error(
          "message" in inspectionData
            ? inspectionData.message
            : "โหลดงานตรวจไม่สำเร็จ",
        );
      setList(inspectionData);
      if (catalogResponse.ok) setCatalogs(catalogData);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const open = (inspection: Inspection) => {
    setSelected(inspection);
    setItems(inspection.items);
    setNotes(inspection.notes ?? "");
    setError("");
  };
  const addItem = () => {
    if (!catalogs.length) return setError("ยังไม่มีรายการราคากลาง");
    setItems([
      ...items,
      {
        catalogId: undefined,
        type: "MINIBAR",
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };
  const selectType = (index: number, type: ItemType) => {
    setItems(
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              type,
              catalogId: undefined,
              description: "",
              unitPrice: 0,
            }
          : item,
      ),
    );
  };
  const selectCatalog = (index: number, catalogId: string) => {
    const catalog = catalogs.find((item) => item.id === catalogId);
    if (!catalog) return;
    setItems(
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              catalogId: catalog.id,
              type: catalog.type,
              description: catalog.name,
              unitPrice: catalog.unitPrice,
              quantity: item.quantity,
            }
          : item,
      ),
    );
  };
  const save = async (complete: boolean) => {
    if (!selected) return;
    if (items.some((item) => !item.catalogId))
      return setError("กรุณาเลือกรายละเอียดให้ครบทุกหัวข้อ");
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/housekeeping/inspections/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes, items, complete }),
        },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      setSelected(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-primary">HOUSEKEEPING</p>
        <h1 className="text-2xl font-semibold text-foreground">
          ห้องรอตรวจหลังเช็กเอาต์
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          เลือกรายการจากราคากลาง แล้วระบุเฉพาะจำนวน
        </p>
      </div>
      {error && !selected && (
        <p className="mb-4 rounded-xl bg-destructive/10 p-3 text-destructive">{error}</p>
      )}
      {loading ? (
        <p className="rounded-2xl bg-surface p-8 text-center text-muted-foreground">
          กำลังโหลด...
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((inspection) => (
            <article
              key={inspection.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    ห้อง {inspection.room}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {inspection.customerName}
                  </p>
                </div>
                <span
                  className={`h-fit rounded-full px-2.5 py-1 text-xs ${inspection.status === "COMPLETED" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
                >
                  {inspection.status === "COMPLETED"
                    ? "ตรวจสอบแล้ว"
                    : "รอตรวจห้อง"}
                </span>
              </div>
              {inspection.items.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {inspection.items.map((item, index) => (
                    <li key={index}>
                      {item.description} × {item.quantity} — ฿
                      {(item.quantity * item.unitPrice).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => open(inspection)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
              >
                <ClipboardCheck size={18} />
                {inspection.status === "COMPLETED"
                  ? "แก้ไขผลตรวจ"
                  : "เปิดรายการตรวจ"}
              </button>
            </article>
          ))}
          {list.length === 0 && (
            <p className="col-span-full rounded-2xl bg-surface p-8 text-center text-muted-foreground">
              ไม่มีห้องรอตรวจ
            </p>
          )}
        </div>
      )}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={`ตรวจห้อง ${selected?.room ?? ""}`}
      >
        <div className="space-y-4 text-foreground">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="rounded-xl border border-border bg-background p-3"
              >
                <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_40px]">
                  <select
                    value={item.type}
                    onChange={(e) =>
                      selectType(index, e.target.value as ItemType)
                    }
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
                  >
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={item.catalogId ?? ""}
                    onChange={(e) => selectCatalog(index, e.target.value)}
                    className="min-w-0 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
                  >
                    <option value="">เลือกรายละเอียด</option>
                    {catalogs
                      .filter((catalog) => catalog.type === item.type)
                      .map((catalog) => (
                        <option key={catalog.id} value={catalog.id}>
                          {catalog.name}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() =>
                      setItems(
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="text-xs text-muted-foreground">
                    จำนวน
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        setItems(
                          items.map((value, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...value,
                                  quantity: Math.max(1, Number(e.target.value)),
                                }
                              : value,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
                    />
                  </label>
                  <div className="rounded-lg bg-surface px-3 py-2">
                    <p className="text-xs text-muted-foreground">ราคาต่อหน่วย</p>
                    <p className="font-semibold text-foreground">
                      ฿{item.unitPrice.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-primary/10 px-3 py-2">
                    <p className="text-xs text-muted-foreground">รวมรายการ</p>
                    <p className="font-semibold text-primary">
                      ฿{(item.quantity * item.unitPrice).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addItem}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 px-3 py-2 text-sm text-primary"
          >
            <Plus size={17} />
            เพิ่มรายการจากราคากลาง
          </button>
          <div className="flex justify-between rounded-xl bg-primary/10 p-4">
            <span>ค่าใช้จ่ายเพิ่มทั้งหมด</span>
            <strong className="text-primary">
              ฿
              {items
                .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
                .toLocaleString()}
            </strong>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-20 w-full rounded-xl border border-border bg-surface p-3 text-foreground"
            placeholder="หมายเหตุการตรวจ"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={saving}
              onClick={() => save(false)}
              className="rounded-xl border border-border px-4 py-3"
            >
              บันทึกไว้ก่อน
            </button>
            <button
              disabled={saving}
              onClick={() => save(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-primary-foreground"
            >
              <CheckCircle2 size={18} />
              ตรวจเสร็จ
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
