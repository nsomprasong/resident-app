"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { newFoodLineKey } from "@/lib/bookings/food-line";

import Modal from "./Modal";
import NumberInput from "./NumberInput";
import PricingToggle from "./PricingToggle";

export interface BookingFoodItem {
  /** Catalog product id — omit for tour-group-only custom dish */
  productId?: string;
  /** Stable row key in the picker */
  lineKey: string;
  /** Tour-group-only custom dish name (not saved to product master) */
  customName?: string;
  /** Unit price for custom dish */
  customUnitPrice?: number;
  quantity: number;
  isExtra?: boolean;
  /** Selected option labels for kitchen, e.g. "ไก่" or "เส้นแก้ว" */
  note?: string;
  /** Override from food set: force / skip option selection */
  requireOptions?: boolean;
}

export function foodItemKey(item: BookingFoodItem): string {
  return item.lineKey || item.productId || "";
}

export function isCustomBookingFoodItem(item: BookingFoodItem): boolean {
  return !item.productId && Boolean(item.customName?.trim());
}

export function ensureFoodItemLineKey(item: BookingFoodItem): BookingFoodItem {
  if (item.lineKey) return item;
  if (item.productId) return { ...item, lineKey: item.productId };
  return { ...item, lineKey: newFoodLineKey("custom") };
}

interface ProductOptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  options: Array<{ id: string; label: string }>;
}

interface Product {
  id: string;
  title: string;
  price: number;
  typeId?: string;
  typeName?: string;
  isMinibar?: boolean;
  optionGroups?: ProductOptionGroup[];
}

const OPTION_NOTE_SEP = " · ";

function parseOptionNoteParts(note: string | undefined): string[] {
  if (!note?.trim()) return [];
  return note
    .split(OPTION_NOTE_SEP)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getSelectedOptionLabel(
  note: string | undefined,
  group: ProductOptionGroup,
): string | null {
  const parts = parseOptionNoteParts(note);
  for (const option of group.options) {
    if (parts.includes(option.label)) return option.label;
  }
  const trimmed = note?.trim();
  if (trimmed && group.options.some((option) => option.label === trimmed)) {
    return trimmed;
  }
  return null;
}

function buildOptionNote(
  note: string | undefined,
  groups: ProductOptionGroup[],
  group: ProductOptionGroup,
  label: string | null,
): string {
  const selected = new Map<string, string>();
  for (const entry of groups) {
    const current = getSelectedOptionLabel(note, entry);
    if (current) selected.set(entry.id, current);
  }
  if (label) selected.set(group.id, label);
  else selected.delete(group.id);
  return groups
    .map((entry) => selected.get(entry.id))
    .filter((value): value is string => Boolean(value))
    .join(OPTION_NOTE_SEP);
}

function groupRequiresSelection(
  item: BookingFoodItem,
  group: ProductOptionGroup,
  groups: ProductOptionGroup[],
): boolean {
  if (item.requireOptions === false) return false;
  if (group.isRequired) return true;
  if (item.requireOptions === true) {
    return !groups.some((entry) => entry.isRequired);
  }
  return false;
}

/** True when a line still needs required option picks (kitchen note). */
export function foodItemMissingRequiredOptions(
  item: BookingFoodItem,
  product?: { optionGroups?: ProductOptionGroup[] } | null,
): boolean {
  if (item.requireOptions === false) return false;
  const groups = product?.optionGroups ?? [];
  const requiredGroups = groups.filter((group) =>
    groupRequiresSelection(item, group, groups),
  );

  if (requiredGroups.length > 0) {
    return requiredGroups.some(
      (group) => !getSelectedOptionLabel(item.note, group),
    );
  }

  if (item.requireOptions === true) {
    return !item.note?.trim();
  }

  return false;
}

export function foodItemsMissingRequiredOptions(
  items: BookingFoodItem[],
  products: Array<{ id: string; optionGroups?: ProductOptionGroup[] }>,
): boolean {
  const productMap = new Map(products.map((product) => [product.id, product]));
  return items.some((item) => {
    if (isCustomBookingFoodItem(item) || !item.productId) return false;
    return foodItemMissingRequiredOptions(
      item,
      productMap.get(item.productId),
    );
  });
}

const PAGE_SIZE = 40;

export default function BookingFoodSelect({
  items,
  onChange,
  included,
  allowPackagePricing = false,
  defaultIsExtra = true,
  allowReplace = true,
  allowCustomDish = false,
}: {
  items: BookingFoodItem[];
  onChange: (items: BookingFoodItem[]) => void;
  included: boolean;
  allowPackagePricing?: boolean;
  defaultIsExtra?: boolean;
  /** Show per-line "เปลี่ยนเมนู" to swap a dish without changing the master set */
  allowReplace?: boolean;
  /** Allow tour-group-only custom dishes with name + price (not saved to master) */
  allowCustomDish?: boolean;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState(0);
  const [customQty, setCustomQty] = useState(1);
  const [customIsExtra, setCustomIsExtra] = useState(defaultIsExtra);
  const [replaceTargetKey, setReplaceTargetKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(0);
  const [draftQty, setDraftQty] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/products");
        if (response.ok) {
          setProducts((await response.json()) as Product[]);
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const categories = useMemo(() => {
    const values = Array.from(
      new Set(products.map((product) => product.typeName).filter(Boolean)),
    ) as string[];
    return values;
  }, [products]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const replaceProductId = replaceTargetKey
      ? items.find((item) => foodItemKey(item) === replaceTargetKey)?.productId
      : null;
    return products.filter((product) => {
      if (replaceProductId && product.id === replaceProductId) return false;
      const matchCategory =
        category === "ALL" || product.typeName === category;
      const matchQuery =
        !normalized || product.title.toLowerCase().includes(normalized);
      return matchCategory && matchQuery;
    });
  }, [category, items, products, query, replaceTargetKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query, category, replaceTargetKey]);

  const closePicker = () => {
    setPickerOpen(false);
    setReplaceTargetKey(null);
  };

  const openAddPicker = () => {
    setReplaceTargetKey(null);
    setPickerOpen(true);
  };

  const openReplacePicker = (lineKey: string) => {
    setReplaceTargetKey(lineKey);
    setQuery("");
    setCategory("ALL");
    setPickerOpen(true);
  };

  const openCustomDish = () => {
    setCustomName("");
    setCustomPrice(0);
    setCustomQty(1);
    setCustomIsExtra(allowPackagePricing ? defaultIsExtra : true);
    setCustomOpen(true);
  };

  const addCustomDish = () => {
    const name = customName.trim();
    if (!name || !Number.isFinite(customPrice) || customPrice < 0) return;
    const qty = Math.max(1, Math.floor(customQty) || 1);
    onChange([
      ...items,
      {
        lineKey: newFoodLineKey("custom"),
        customName: name,
        customUnitPrice: customPrice,
        quantity: qty,
        isExtra: allowPackagePricing ? customIsExtra : true,
      },
    ]);
    setCustomOpen(false);
  };

  const setQuantityByKey = (lineKey: string, value: number) => {
    onChange(
      value <= 0
        ? items.filter((item) => foodItemKey(item) !== lineKey)
        : items.map((item) =>
            foodItemKey(item) === lineKey ? { ...item, quantity: value } : item,
          ),
    );
  };

  const addCatalogProduct = (productId: string, addQty: number) => {
    const product = productMap.get(productId);
    const needsOption =
      product?.optionGroups?.some((group) => group.isRequired) ?? false;
    const existing = items.find(
      (item) => item.productId === productId && !isCustomBookingFoodItem(item),
    );
    if (existing) {
      onChange(
        items.map((item) =>
          foodItemKey(item) === foodItemKey(existing)
            ? { ...item, quantity: item.quantity + addQty }
            : item,
        ),
      );
      return;
    }
    onChange([
      ...items,
      {
        productId,
        lineKey: productId,
        quantity: addQty,
        isExtra: allowPackagePricing ? defaultIsExtra : true,
        ...(needsOption ? { requireOptions: true } : {}),
      },
    ]);
  };

  const replaceProduct = (newProductId: string) => {
    if (!replaceTargetKey) return;
    const oldItem = items.find(
      (item) => foodItemKey(item) === replaceTargetKey,
    );
    if (!oldItem) {
      closePicker();
      return;
    }
    const product = productMap.get(newProductId);
    const needsOption =
      product?.optionGroups?.some((group) => group.isRequired) ?? false;
    const withoutOld = items.filter(
      (item) => foodItemKey(item) !== replaceTargetKey,
    );
    const existing = withoutOld.find(
      (item) => item.productId === newProductId && !isCustomBookingFoodItem(item),
    );
    if (existing) {
      onChange(
        withoutOld.map((item) =>
          foodItemKey(item) === foodItemKey(existing)
            ? {
                ...item,
                quantity: item.quantity + oldItem.quantity,
              }
            : item,
        ),
      );
    } else {
      onChange([
        ...withoutOld,
        {
          productId: newProductId,
          lineKey: newProductId,
          quantity: oldItem.quantity,
          isExtra: oldItem.isExtra,
          note: undefined,
          customName: undefined,
          customUnitPrice: undefined,
          ...(needsOption
            ? { requireOptions: true }
            : { requireOptions: false }),
        },
      ]);
    }
    closePicker();
  };

  const setItemExtra = (lineKey: string, isExtra: boolean) => {
    onChange(
      items.map((item) =>
        foodItemKey(item) === lineKey ? { ...item, isExtra } : item,
      ),
    );
  };

  const setGroupOption = (
    lineKey: string,
    product: Product,
    group: ProductOptionGroup,
    label: string | null,
  ) => {
    const groups = product.optionGroups ?? [];
    onChange(
      items.map((item) => {
        if (foodItemKey(item) !== lineKey) return item;
        const nextNote = buildOptionNote(item.note, groups, group, label);
        return { ...item, note: nextNote || undefined };
      }),
    );
  };

  const addFromPicker = (id: string) => {
    const addQty = Math.max(1, draftQty[id] ?? 1);
    addCatalogProduct(id, addQty);
    setDraftQty((prev) => ({ ...prev, [id]: 1 }));
  };

  const selectedRows = items.map((item) => {
    const key = foodItemKey(item);
    if (isCustomBookingFoodItem(item)) {
      return {
        ...item,
        lineKey: key,
        product: {
          id: key,
          title: item.customName ?? "เมนูพิเศษ",
          price: Number(item.customUnitPrice ?? 0),
          optionGroups: [] as ProductOptionGroup[],
        },
        isCustom: true as const,
      };
    }
    const product = item.productId ? productMap.get(item.productId) : undefined;
    if (!product) {
      return {
        ...item,
        lineKey: key,
        product: {
          id: key,
          title: "เมนู (โหลดไม่สำเร็จ)",
          price: 0,
          optionGroups: [] as ProductOptionGroup[],
        },
        isCustom: false as const,
      };
    }
    return {
      ...item,
      lineKey: key,
      product,
      isCustom: false as const,
    };
  });

  const foodTotal = selectedRows.reduce((sum, row) => {
    const isExtra = row.isExtra ?? defaultIsExtra;
    if (allowPackagePricing && !isExtra) return sum;
    return sum + row.product.price * row.quantity;
  }, 0);
  const foodCount = selectedRows.reduce((sum, row) => sum + row.quantity, 0);
  const replaceTargetTitle =
    replaceTargetKey != null
      ? (selectedRows.find((row) => row.lineKey === replaceTargetKey)?.product
          .title ?? "เมนูเดิม")
      : null;

  return (
    <>
      <section className="rounded-2xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Utensils size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                รายการอาหาร
              </h3>
              <p className="text-xs text-muted-foreground">
                {allowPackagePricing
                  ? "กำหนดได้ว่ารายการรวมในราคาเหมาหรือคิดเพิ่ม — กดเปลี่ยนเพื่อสลับเมนูในชุด"
                  : included
                    ? "อาหารที่เลือกตอนนี้รวมในราคาเหมา (เพิ่มทีหลังจากหน้ารายละเอียดการจองได้)"
                    : "อาหารคิดตามราคาจริงและรวมในบิล — กดเปลี่ยนเพื่อสลับเมนู"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {allowCustomDish ? (
              <button
                type="button"
                onClick={openCustomDish}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/5"
              >
                <Plus size={16} />
                เมนูพิเศษ
              </button>
            ) : null}
            <button
              type="button"
              onClick={openAddPicker}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={16} />
              เพิ่มจากเมนู
            </button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">กำลังโหลดอาหาร...</p>
          ) : selectedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center">
              <Utensils size={22} className="text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">
                ยังไม่มีรายการอาหาร
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                กดปุ่มเพิ่มรายการอาหารเพื่อเลือกจากเมนู
              </p>
            </div>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {selectedRows.map((row) => {
                const isExtra = row.isExtra ?? defaultIsExtra;
                const lineTotal =
                  allowPackagePricing && !isExtra
                    ? 0
                    : row.product.price * row.quantity;
                return (
                  <div
                    key={row.lineKey}
                    className="space-y-2 rounded-xl border border-border bg-background px-3 py-2"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto_auto]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.product.title}
                          {row.isCustom ? (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              · พิเศษ
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground sm:hidden">
                          ฿{row.product.price.toLocaleString()} · รวม ฿
                          {lineTotal.toLocaleString()}
                          {allowPackagePricing && !isExtra
                            ? " (รวมในเหมา)"
                            : ""}
                        </p>
                      </div>
                      <p className="hidden text-sm text-muted-foreground sm:block">
                        ฿{row.product.price.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
                        <button
                          type="button"
                          aria-label="ลดจำนวน"
                          onClick={() =>
                            setQuantityByKey(row.lineKey, row.quantity - 1)
                          }
                          className="rounded-md p-1.5 hover:bg-muted"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-7 text-center text-sm font-medium">
                          {row.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="เพิ่มจำนวน"
                          onClick={() =>
                            setQuantityByKey(row.lineKey, row.quantity + 1)
                          }
                          className="rounded-md p-1.5 hover:bg-muted"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="hidden text-sm font-medium text-foreground sm:block">
                        ฿{lineTotal.toLocaleString()}
                      </p>
                      {allowReplace && !row.isCustom ? (
                        <button
                          type="button"
                          aria-label={`เปลี่ยน ${row.product.title}`}
                          onClick={() => openReplacePicker(row.lineKey)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5"
                        >
                          <RefreshCw size={13} />
                          เปลี่ยน
                        </button>
                      ) : (
                        <span className="hidden sm:block" />
                      )}
                      <button
                        type="button"
                        aria-label={`ลบ ${row.product.title}`}
                        onClick={() => setQuantityByKey(row.lineKey, 0)}
                        className="justify-self-end rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {allowPackagePricing ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          การคิดเงิน
                        </p>
                        <PricingToggle
                          value={isExtra}
                          onChange={(next) => setItemExtra(row.lineKey, next)}
                        />
                      </div>
                    ) : null}
                    {!row.isCustom &&
                    (row.product.optionGroups?.length ?? 0) > 0 ? (
                      <div className="space-y-2 border-t border-border/60 pt-2">
                        {row.product.optionGroups!.map((group) => {
                          const groups = row.product.optionGroups!;
                          const required = groupRequiresSelection(
                            row,
                            group,
                            groups,
                          );
                          const selectedLabel = getSelectedOptionLabel(
                            row.note,
                            group,
                          );
                          const missing = required && !selectedLabel;
                          return (
                            <div key={group.id} className="space-y-1.5">
                              <p className="text-xs font-medium text-foreground">
                                {group.name}
                                {required ? (
                                  <span className="text-destructive"> *</span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    (ไม่บังคับ)
                                  </span>
                                )}
                                {missing ? (
                                  <span className="ml-1 text-destructive">
                                    เลือกตัวเลือก
                                  </span>
                                ) : null}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {group.options.map((option) => {
                                  const selected =
                                    selectedLabel === option.label;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() =>
                                        setGroupOption(
                                          row.lineKey,
                                          row.product,
                                          group,
                                          selected ? null : option.label,
                                        )
                                      }
                                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                                        selected
                                          ? "border-primary bg-primary/10 text-primary"
                                          : missing
                                            ? "border-destructive/40 bg-surface text-foreground hover:border-primary/40"
                                            : "border-border bg-surface text-foreground hover:border-primary/40"
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
            <p className="text-muted-foreground">{foodCount} รายการ</p>
            <p className="font-semibold text-foreground">
              รวมอาหาร ฿{foodTotal.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      <Modal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        title="เพิ่มเมนูพิเศษ"
        size="md"
        nested
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCustomOpen(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={addCustomDish}
              disabled={
                !customName.trim() ||
                !Number.isFinite(customPrice) ||
                customPrice < 0
              }
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              เพิ่มเมนูพิเศษ
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            เมนูนี้ใช้เฉพาะกรุ๊ป/การจองนี้เท่านั้น ไม่ถูกบันทึกลงเมนูหลักใน Settings
          </p>
          <label className="block text-xs text-muted-foreground">
            ชื่อเมนู
            <input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder="เช่น ต้มยำกุ้งพิเศษ"
              className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted-foreground">
              ราคาต่อหน่วย (บาท)
              <div className="mt-1">
                <NumberInput
                  value={customPrice}
                  onChange={setCustomPrice}
                  min={0}
                  step={1}
                />
              </div>
            </label>
            <label className="block text-xs text-muted-foreground">
              จำนวน
              <div className="mt-1">
                <NumberInput
                  value={customQty}
                  onChange={setCustomQty}
                  min={1}
                  step={1}
                />
              </div>
            </label>
          </div>
          {allowPackagePricing ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <p className="text-xs text-muted-foreground">การคิดเงิน</p>
              <PricingToggle value={customIsExtra} onChange={setCustomIsExtra} />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={pickerOpen}
        onClose={closePicker}
        title={
          replaceTargetKey
            ? `เปลี่ยนเมนู: ${replaceTargetTitle ?? ""}`
            : "เลือกเมนูอาหาร"
        }
        size="lg"
        nested
        fullScreenOnMobile
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {replaceTargetKey
                ? "เลือกเมนูใหม่แทนรายการนี้ — ใช้เฉพาะการจอง/กรุ๊ปนี้"
                : `เลือกแล้ว ${foodCount} รายการ`}
            </p>
            <button
              type="button"
              onClick={closePicker}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Check size={17} />
              เสร็จสิ้น
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {replaceTargetKey ? (
            <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">
              กำลังเปลี่ยน{" "}
              <span className="font-medium">{replaceTargetTitle}</span> เป็นเมนูอื่น
              — ชุดมาตรฐานใน Settings ไม่ถูกแก้
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">ค้นหาเมนู</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหาชื่อเมนู"
                className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="ALL">ทุกหมวด</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "FOOD"
                    ? "อาหาร"
                    : item === "MINIBAR"
                      ? "มินิบาร์"
                      : item}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-2">
            {pageItems.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                ไม่พบเมนูที่ตรงกับคำค้นหา
              </p>
            ) : (
              pageItems.map((product) => {
                const selectedQty =
                  items.find((item) => item.productId === product.id)
                    ?.quantity ?? 0;
                const qty = draftQty[product.id] ?? 1;
                return (
                  <div
                    key={product.id}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {product.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.typeName ?? "สินค้า"}
                        {product.isMinibar ? " · มินิบาร์" : ""} · ฿
                        {product.price.toLocaleString()}
                        {!replaceTargetKey && selectedQty > 0
                          ? ` · ในรายการ x${selectedQty}`
                          : ""}
                      </p>
                    </div>
                    {replaceTargetKey ? (
                      <button
                        type="button"
                        onClick={() => replaceProduct(product.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <RefreshCw size={14} />
                        ใช้เมนูนี้แทน
                      </button>
                    ) : (
                      <>
                        <NumberInput
                          min={1}
                          emptyValue={1}
                          value={qty}
                          onChange={(next) =>
                            setDraftQty((prev) => ({
                              ...prev,
                              [product.id]: next,
                            }))
                          }
                          className="w-16 rounded-lg border border-border px-2 py-1.5 text-center text-sm"
                          aria-label={`จำนวน ${product.title}`}
                        />
                        <button
                          type="button"
                          onClick={() => addFromPicker(product.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          <Plus size={14} />
                          เพิ่ม
                        </button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">
              หน้า {page + 1}/{pageCount} · {filtered.length} รายการ
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                ก่อนหน้า
              </button>
              <button
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() =>
                  setPage((value) => Math.min(pageCount - 1, value + 1))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 disabled:opacity-40"
              >
                ถัดไป
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
