"use client";

import { RotateCcw, UtensilsCrossed } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import BookingFoodSelect, { type BookingFoodItem } from "./BookingFoodSelect";
import type { FoodSetRecord } from "@/lib/settings/food-sets";

type Step = "pick" | "edit";

export type BookingFoodSetMeta = {
  name: string;
  sourceFoodSetId: string | null;
};

function itemsFromFoodSet(
  foodSet: FoodSetRecord,
  defaultIsExtra: boolean,
): BookingFoodItem[] {
  return foodSet.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    isExtra: defaultIsExtra,
    requireOptions: item.requireOptions,
    note: undefined,
  }));
}

/**
 * Pick a master food set, then customize/replace line items.
 * Customization does not mutate Settings food sets.
 */
export default function BookingFoodSetPanel({
  items,
  onChange,
  included,
  allowPackagePricing = false,
  defaultIsExtra = true,
  resetToken,
  groupScoped = false,
  onMetaChange,
}: {
  items: BookingFoodItem[];
  onChange: (items: BookingFoodItem[]) => void;
  included: boolean;
  allowPackagePricing?: boolean;
  defaultIsExtra?: boolean;
  /** Change when parent dialog opens to reset pick/edit state */
  resetToken?: string | number | boolean;
  /** Emphasize that edits apply only to this tour group / booking */
  groupScoped?: boolean;
  onMetaChange?: (meta: BookingFoodSetMeta) => void;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [foodSets, setFoodSets] = useState<FoodSetRecord[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [selectedSetName, setSelectedSetName] = useState("");
  const [sourceFoodSetId, setSourceFoodSetId] = useState<string | null>(null);

  const emitMeta = useCallback(
    (name: string, sourceId: string | null) => {
      onMetaChange?.({ name, sourceFoodSetId: sourceId });
    },
    [onMetaChange],
  );

  const loadSets = useCallback(async () => {
    setLoadingSets(true);
    try {
      const response = await fetch("/api/food-sets", { cache: "no-store" });
      if (response.ok) {
        setFoodSets((await response.json()) as FoodSetRecord[]);
      }
    } finally {
      setLoadingSets(false);
    }
  }, []);

  useEffect(() => {
    setStep("pick");
    setSelectedSetName("");
    setSourceFoodSetId(null);
    emitMeta("", null);
    void loadSets();
  }, [resetToken, loadSets, emitMeta]);

  const applyMasterSet = (foodSet: FoodSetRecord) => {
    onChange(itemsFromFoodSet(foodSet, defaultIsExtra));
    setSelectedSetName(foodSet.name);
    setSourceFoodSetId(foodSet.id);
    emitMeta(foodSet.name, foodSet.id);
    setStep("edit");
  };

  const startItemByItem = () => {
    onChange([]);
    setSelectedSetName("สั่งทีละรายการ");
    setSourceFoodSetId(null);
    emitMeta("สั่งทีละรายการ", null);
    setStep("edit");
  };

  const restartPick = () => {
    onChange([]);
    setSelectedSetName("");
    setSourceFoodSetId(null);
    emitMeta("", null);
    setStep("pick");
  };

  if (step === "pick") {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">เลือกชุดอาหาร</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            เลือกชุดมาตรฐาน แล้วเปลี่ยน/เพิ่ม/ลดรายการได้ก่อนบันทึก
            {groupScoped
              ? " — การปรับใช้เฉพาะกรุ๊ปนี้ ชุดหลักไม่เปลี่ยน"
              : " — ชุดหลักใน Settings ไม่ถูกแก้"}
          </p>
        </div>

        {loadingSets ? (
          <p className="text-sm text-muted-foreground">กำลังโหลดชุดอาหาร...</p>
        ) : null}

        {!loadingSets && foodSets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              ยังไม่มีชุดอาหารในระบบ — ไปตั้งค่าที่ Settings → ชุดอาหาร
            </p>
            <button
              type="button"
              className="mt-3 text-sm text-primary underline"
              onClick={startItemByItem}
            >
              สั่งทีละรายการแทน
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {foodSets.map((foodSet) => (
              <li key={foodSet.id}>
                <button
                  type="button"
                  onClick={() => applyMasterSet(foodSet)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-primary/40"
                >
                  <UtensilsCrossed
                    size={18}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {foodSet.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {foodSet.itemCount} รายการ
                      {foodSet.description ? ` · ${foodSet.description}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {foodSets.length > 0 ? (
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={startItemByItem}
          >
            สั่งทีละรายการแทน
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-muted px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm text-foreground">
            กำลังสั่ง:{" "}
            <span className="font-medium">
              {selectedSetName || "รายการอาหาร"}
            </span>
          </p>
          {groupScoped ? (
            <p className="text-xs text-muted-foreground">
              ใช้เฉพาะกรุ๊ปนี้ · กด「เปลี่ยน」ที่แต่ละเมนูเพื่อสลับเป็นเมนูอื่น
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              กด「เปลี่ยน」ที่แต่ละเมนูเพื่อสลับเป็นเมนูอื่น
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={restartPick}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <RotateCcw size={14} />
          เปลี่ยนชุด
        </button>
      </div>
      <BookingFoodSelect
        items={items}
        onChange={onChange}
        included={included}
        allowPackagePricing={allowPackagePricing}
        defaultIsExtra={defaultIsExtra}
        allowReplace
      />
      {sourceFoodSetId ? (
        <p className="text-xs text-muted-foreground">
          อ้างอิงชุดมาตรฐาน — การเปลี่ยนเมนูไม่แก้ชุดต้นทางใน Settings
        </p>
      ) : null}
    </div>
  );
}
