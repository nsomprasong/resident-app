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

import Modal from "./Modal";
import PricingToggle from "./PricingToggle";

export interface BookingFoodItem {
  productId: string;
  quantity: number;
  isExtra?: boolean;
  /** Selected option labels for kitchen, e.g. "ไก่" or "เส้นแก้ว" */
  note?: string;
  /** Override from food set: force / skip option selection */
  requireOptions?: boolean;
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

const PAGE_SIZE = 40;

export default function BookingFoodSelect({
  items,
  onChange,
  included,
  allowPackagePricing = false,
  defaultIsExtra = true,
  allowReplace = true,
}: {
  items: BookingFoodItem[];
  onChange: (items: BookingFoodItem[]) => void;
  included: boolean;
  allowPackagePricing?: boolean;
  defaultIsExtra?: boolean;
  /** Show per-line "เปลี่ยนเมนู" to swap a dish without changing the master set */
  allowReplace?: boolean;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
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
    return products.filter((product) => {
      if (replaceTargetId && product.id === replaceTargetId) return false;
      const matchCategory =
        category === "ALL" || product.typeName === category;
      const matchQuery =
        !normalized || product.title.toLowerCase().includes(normalized);
      return matchCategory && matchQuery;
    });
  }, [category, products, query, replaceTargetId]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query, category, replaceTargetId]);

  const closePicker = () => {
    setPickerOpen(false);
    setReplaceTargetId(null);
  };

  const openAddPicker = () => {
    setReplaceTargetId(null);
    setPickerOpen(true);
  };

  const openReplacePicker = (productId: string) => {
    setReplaceTargetId(productId);
    setQuery("");
    setCategory("ALL");
    setPickerOpen(true);
  };

  const setQuantity = (id: string, value: number) => {
    const product = productMap.get(id);
    const needsOption =
      product?.optionGroups?.some((group) => group.isRequired) ?? false;
    onChange(
      value <= 0
        ? items.filter((item) => item.productId !== id)
        : items.some((item) => item.productId === id)
          ? items.map((item) =>
              item.productId === id ? { ...item, quantity: value } : item,
            )
          : [
              ...items,
              {
                productId: id,
                quantity: value,
                isExtra: allowPackagePricing ? defaultIsExtra : true,
                ...(needsOption ? { requireOptions: true } : {}),
              },
            ],
    );
  };

  const replaceProduct = (newProductId: string) => {
    if (!replaceTargetId) return;
    const oldItem = items.find((item) => item.productId === replaceTargetId);
    if (!oldItem) {
      closePicker();
      return;
    }
    const product = productMap.get(newProductId);
    const needsOption =
      product?.optionGroups?.some((group) => group.isRequired) ?? false;
    const withoutOld = items.filter(
      (item) => item.productId !== replaceTargetId,
    );
    const existing = withoutOld.find((item) => item.productId === newProductId);
    if (existing) {
      onChange(
        withoutOld.map((item) =>
          item.productId === newProductId
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
          quantity: oldItem.quantity,
          isExtra: oldItem.isExtra,
          note: undefined,
          ...(needsOption
            ? { requireOptions: true }
            : { requireOptions: false }),
        },
      ]);
    }
    closePicker();
  };

  const setItemExtra = (id: string, isExtra: boolean) => {
    onChange(
      items.map((item) =>
        item.productId === id ? { ...item, isExtra } : item,
      ),
    );
  };

  const setItemNote = (id: string, note: string) => {
    onChange(
      items.map((item) =>
        item.productId === id
          ? { ...item, note: note.trim() || undefined }
          : item,
      ),
    );
  };

  const itemNeedsOption = (item: BookingFoodItem, product: Product) => {
    const groups = product.optionGroups ?? [];
    if (!groups.length) return false;
    if (item.requireOptions === true) return true;
    if (item.requireOptions === false) return false;
    return groups.some((group) => group.isRequired);
  };

  const addFromPicker = (id: string) => {
    const addQty = Math.max(1, draftQty[id] ?? 1);
    const current = items.find((item) => item.productId === id)?.quantity ?? 0;
    setQuantity(id, current + addQty);
    setDraftQty((prev) => ({ ...prev, [id]: 1 }));
  };

  const selectedRows = items
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) return null;
      return { ...item, product };
    })
    .filter(Boolean) as Array<BookingFoodItem & { product: Product }>;

  const foodTotal = selectedRows.reduce((sum, row) => {
    const isExtra = row.isExtra ?? defaultIsExtra;
    if (allowPackagePricing && !isExtra) return sum;
    return sum + row.product.price * row.quantity;
  }, 0);
  const foodCount = selectedRows.reduce((sum, row) => sum + row.quantity, 0);
  const replaceTargetTitle =
    replaceTargetId != null
      ? (productMap.get(replaceTargetId)?.title ?? "เมนูเดิม")
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
          <button
            type="button"
            onClick={openAddPicker}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            เพิ่มรายการอาหาร
          </button>
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
                    key={row.productId}
                    className="space-y-2 rounded-xl border border-border bg-background px-3 py-2"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto_auto]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.product.title}
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
                            setQuantity(row.productId, row.quantity - 1)
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
                            setQuantity(row.productId, row.quantity + 1)
                          }
                          className="rounded-md p-1.5 hover:bg-muted"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="hidden text-sm font-medium text-foreground sm:block">
                        ฿{lineTotal.toLocaleString()}
                      </p>
                      {allowReplace ? (
                        <button
                          type="button"
                          aria-label={`เปลี่ยน ${row.product.title}`}
                          onClick={() => openReplacePicker(row.productId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5"
                        >
                          <RefreshCw size={13} />
                          เปลี่ยน
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`ลบ ${row.product.title}`}
                        onClick={() => setQuantity(row.productId, 0)}
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
                          onChange={(next) => setItemExtra(row.productId, next)}
                        />
                      </div>
                    ) : null}
                    {(row.product.optionGroups?.length ?? 0) > 0 ? (
                      <div className="space-y-2 border-t border-border/60 pt-2">
                        {row.product.optionGroups!.map((group) => {
                          const required = itemNeedsOption(row, row.product);
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
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {group.options.map((option) => {
                                  const selected = row.note === option.label;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() =>
                                        setItemNote(
                                          row.productId,
                                          selected ? "" : option.label,
                                        )
                                      }
                                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                                        selected
                                          ? "border-primary bg-primary/10 text-primary"
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
        open={pickerOpen}
        onClose={closePicker}
        title={
          replaceTargetId
            ? `เปลี่ยนเมนู: ${replaceTargetTitle ?? ""}`
            : "เลือกเมนูอาหาร"
        }
        size="lg"
        nested
        fullScreenOnMobile
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {replaceTargetId
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
          {replaceTargetId ? (
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
                        {!replaceTargetId && selectedQty > 0
                          ? ` · ในรายการ x${selectedQty}`
                          : ""}
                      </p>
                    </div>
                    {replaceTargetId ? (
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
                        <input
                          type="number"
                          min={1}
                          value={qty}
                          onChange={(event) =>
                            setDraftQty((prev) => ({
                              ...prev,
                              [product.id]: Math.max(
                                1,
                                Number(event.target.value) || 1,
                              ),
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
