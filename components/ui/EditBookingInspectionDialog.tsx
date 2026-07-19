"use client";

import { Camera, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import Modal from "@/components/ui/Modal";
import { prepareImageForUpload } from "@/lib/media/prepare-image-upload";

type ItemType = "MINIBAR" | "DAMAGE" | "STAIN" | "MISSING" | "OTHER";

interface Catalog {
  id: string;
  name: string;
  type: ItemType;
  unitPrice: number;
}

export interface EditableInspectionItem {
  catalogId?: string | null;
  type: ItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
}

const typeLabels: Record<ItemType, string> = {
  MINIBAR: "มินิบาร์",
  DAMAGE: "ชำรุด",
  STAIN: "คราบเปื้อน",
  MISSING: "ของหาย",
  OTHER: "อื่น ๆ",
};

export default function EditBookingInspectionDialog({
  open,
  onClose,
  inspectionId,
  roomLabel,
  initialNotes,
  initialItems,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  inspectionId: string;
  roomLabel: string;
  initialNotes?: string | null;
  initialItems: EditableInspectionItem[];
  onSaved: () => void;
}) {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [items, setItems] = useState<EditableInspectionItem[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!open) return;
    setItems(
      initialItems.map((item) => ({
        catalogId: item.catalogId ?? undefined,
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        imageUrl: item.imageUrl ?? null,
      })),
    );
    setNotes(initialNotes ?? "");
    setError("");
    setLoading(true);
    void fetch("/api/inspection-catalog", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as Catalog[] | { message?: string };
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(
            !Array.isArray(data) && data.message
              ? data.message
              : "โหลดราคากลางไม่สำเร็จ",
          );
        }
        setCatalogs(data);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "โหลดราคากลางไม่สำเร็จ",
        );
      })
      .finally(() => setLoading(false));
    // Reset form only when opening a specific inspection.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, inspectionId]);

  const selectType = (index: number, type: ItemType) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              type,
              catalogId: undefined,
              description: "",
              unitPrice: 0,
              imageUrl: item.imageUrl ?? null,
            }
          : item,
      ),
    );
  };

  const selectCatalog = (index: number, catalogId: string) => {
    const catalog = catalogs.find((item) => item.id === catalogId);
    if (!catalog) return;
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              catalogId: catalog.id,
              type: catalog.type,
              description: catalog.name,
              unitPrice: catalog.unitPrice,
              quantity: item.quantity,
              imageUrl: item.imageUrl ?? null,
            }
          : item,
      ),
    );
  };

  const uploadItemImage = async (index: number, file: File | null) => {
    if (!file) return;
    setUploadingIndex(index);
    setError("");
    try {
      const prepared = await prepareImageForUpload(file);
      const body = new FormData();
      body.set("file", prepared);
      const response = await fetch("/api/housekeeping/inspection-images", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as {
        imageUrl?: string;
        message?: string;
      };
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.message ?? "อัปโหลดรูปไม่สำเร็จ");
      }
      setItems((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, imageUrl: data.imageUrl } : item,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploadingIndex(null);
      const input = fileInputRefs.current[index];
      if (input) input.value = "";
    }
  };

  const save = async () => {
    if (items.some((item) => !item.catalogId)) {
      setError("กรุณาเลือกรายละเอียดให้ครบทุกหัวข้อ");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/housekeeping/inspections/${inspectionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes, items }),
        },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "บันทึกไม่สำเร็จ");
      onClose();
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`แก้ไขรายการตรวจห้อง ${roomLabel}`}
      size="lg"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Save size={17} />
            {saving ? "กำลังบันทึก..." : "บันทึกรายการ"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-foreground">
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลดราคากลาง...</p>
        ) : null}
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_40px]">
                <select
                  value={item.type}
                  onChange={(event) =>
                    selectType(index, event.target.value as ItemType)
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
                  onChange={(event) => selectCatalog(index, event.target.value)}
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
                  type="button"
                  onClick={() =>
                    setItems((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                  aria-label="ลบรายการ"
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
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...value,
                                quantity: Math.max(
                                  1,
                                  Number(event.target.value),
                                ),
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={(element) => {
                    fileInputRefs.current[index] = element;
                  }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) =>
                    void uploadItemImage(
                      index,
                      event.target.files?.[0] ?? null,
                    )
                  }
                />
                {item.imageUrl ? (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={`รูปประกอบ ${item.description || "รายการ"}`}
                      className="h-16 w-16 rounded-lg object-cover ring-1 ring-border"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.map((value, itemIndex) =>
                            itemIndex === index
                              ? { ...value, imageUrl: null }
                              : value,
                          ),
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-muted"
                    >
                      <X size={14} />
                      ลบรูป
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={uploadingIndex === index || saving}
                  onClick={() => fileInputRefs.current[index]?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                >
                  <Camera size={14} />
                  {uploadingIndex === index
                    ? "กำลังอัปโหลด..."
                    : item.imageUrl
                      ? "เปลี่ยนรูป"
                      : "แนบรูปถ่าย"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!catalogs.length) {
              setError("ยังไม่มีรายการราคากลาง");
              return;
            }
            setItems((current) => [
              ...current,
              {
                catalogId: undefined,
                type: "MINIBAR",
                description: "",
                quantity: 1,
                unitPrice: 0,
                imageUrl: null,
              },
            ]);
          }}
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
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-20 w-full rounded-xl border border-border bg-surface p-3 text-foreground"
          placeholder="หมายเหตุการตรวจ"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </Modal>
  );
}
