"use client";

import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  FoodCategoryRecord,
  ProductMasterRecord,
  ProductTypeRecord,
} from "@/lib/settings/product-master-shared";

type FormState = {
  name: string;
  description: string;
  price: string;
  typeId: string;
  categoryId: string;
  isMinibar: boolean;
  imageUrl: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  price: "",
  typeId: "",
  categoryId: "",
  isMinibar: false,
  imageUrl: "",
};

const NEW_TYPE_VALUE = "__new_type__";
const NEW_CATEGORY_VALUE = "__new_category__";

type ApiErrorBody = {
  message?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProductsManager() {
  const [items, setItems] = useState<ProductMasterRecord[]>([]);
  const [types, setTypes] = useState<ProductTypeRecord[]>([]);
  const [categories, setCategories] = useState<FoodCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newTypeName, setNewTypeName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTypes = useCallback(async () => {
    const response = await fetch("/api/product-types", { cache: "no-store" });
    const body = (await response.json()) as ProductTypeRecord[] | ApiErrorBody;
    if (!response.ok || !Array.isArray(body)) {
      throw new Error(
        !Array.isArray(body) && body.message
          ? body.message
          : "โหลดประเภทสินค้าไม่สำเร็จ",
      );
    }
    setTypes(body);
    return body;
  }, []);

  const loadCategories = useCallback(async () => {
    const response = await fetch("/api/food-categories", { cache: "no-store" });
    const body = (await response.json()) as FoodCategoryRecord[] | ApiErrorBody;
    if (!response.ok || !Array.isArray(body)) {
      throw new Error(
        !Array.isArray(body) && body.message
          ? body.message
          : "โหลดหมวดอาหารไม่สำเร็จ",
      );
    }
    setCategories(body);
    return body;
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productsResponse] = await Promise.all([
        fetch("/api/products/master", { cache: "no-store" }),
        loadTypes(),
        loadCategories(),
      ]);
      const body = (await productsResponse.json()) as
        | ProductMasterRecord[]
        | ApiErrorBody;
      if (!productsResponse.ok || !Array.isArray(body)) {
        throw new Error(
          !Array.isArray(body) && body.message
            ? body.message
            : "โหลดสินค้าไม่สำเร็จ",
        );
      }
      setItems(body);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดสินค้าไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadTypes]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const selectedType = useMemo(
    () => types.find((item) => item.id === form.typeId) ?? null,
    [form.typeId, types],
  );
  const requiresFoodCategory =
    selectedType?.requiresFoodCategory === true ||
    (form.typeId === NEW_TYPE_VALUE &&
      (newTypeName.trim() === "อาหาร" ||
        newTypeName.trim().toLowerCase().includes("อาหาร")));

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      typeId: types[0]?.id ?? NEW_TYPE_VALUE,
      categoryId: categories[0]?.id ?? NEW_CATEGORY_VALUE,
    });
    setNewTypeName("");
    setNewCategoryName("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: ProductMasterRecord) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      typeId: item.typeId || (types[0]?.id ?? NEW_TYPE_VALUE),
      categoryId: item.categoryId ?? categories[0]?.id ?? NEW_CATEGORY_VALUE,
      isMinibar: item.isMinibar,
      imageUrl: item.imageUrl ?? "",
    });
    setNewTypeName("");
    setNewCategoryName("");
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving || uploading) return;
    setModalOpen(false);
  };

  const createType = async (name: string) => {
    const response = await fetch("/api/product-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await response.json()) as ProductTypeRecord & ApiErrorBody;
    if (!response.ok || !data.id) {
      throw new Error(data.message ?? "เพิ่มประเภทสินค้าไม่สำเร็จ");
    }
    const next = await loadTypes();
    const selected = next.find((item) => item.id === data.id) ?? data;
    setForm((current) => ({ ...current, typeId: selected.id }));
    setNewTypeName("");
    return selected;
  };

  const createCategory = async (name: string) => {
    const response = await fetch("/api/food-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await response.json()) as FoodCategoryRecord & ApiErrorBody;
    if (!response.ok || !data.id) {
      throw new Error(data.message ?? "เพิ่มหมวดอาหารไม่สำเร็จ");
    }
    const next = await loadCategories();
    const selected = next.find((item) => item.id === data.id) ?? data;
    setForm((current) => ({ ...current, categoryId: selected.id }));
    setNewCategoryName("");
    return selected.id;
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setFormError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/products/images", {
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
      setForm((current) => ({ ...current, imageUrl: data.imageUrl! }));
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : "อัปโหลดรูปไม่สำเร็จ",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      let typeId = form.typeId;
      let typeMeta = selectedType;

      if (form.typeId === NEW_TYPE_VALUE) {
        const name = newTypeName.trim();
        if (!name) throw new Error("กรุณาระบุชื่อประเภทสินค้าใหม่");
        typeMeta = await createType(name);
        typeId = typeMeta.id;
      }

      if (!typeId) throw new Error("กรุณาเลือกประเภทสินค้า");

      const needsCategory =
        typeMeta?.requiresFoodCategory === true ||
        (typeMeta?.name === "อาหาร");

      let categoryId: string | null = null;
      if (needsCategory) {
        if (form.categoryId === NEW_CATEGORY_VALUE) {
          const name = newCategoryName.trim();
          if (!name) throw new Error("กรุณาระบุชื่อหมวดอาหารใหม่");
          categoryId = await createCategory(name);
        } else {
          categoryId = form.categoryId || null;
        }
        if (!categoryId) throw new Error("กรุณาเลือกหมวดอาหาร");
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        typeId,
        categoryId,
        isMinibar: form.isMinibar,
        imageUrl: form.imageUrl.trim() || null,
      };

      const response = await fetch(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        throw new Error(body.message ?? "บันทึกสินค้าไม่สำเร็จ");
      }

      setModalOpen(false);
      await loadItems();
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : "บันทึกสินค้าไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: ProductMasterRecord) => {
    setError("");
    try {
      const response = await fetch(`/api/products/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        throw new Error(body.message ?? "อัปเดตสถานะไม่สำเร็จ");
      }
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "อัปเดตสถานะไม่สำเร็จ",
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">สินค้า / เมนู</h2>
          <p className="text-sm text-muted-foreground">
            จัดการประเภท หมวดอาหาร มินิบาร์ และรูปภาพ
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} />
          เพิ่มสินค้า
        </button>
      </div>

      {error ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          ยังไม่มีสินค้า
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((product) => (
            <li
              key={product.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                product.isActive
                  ? "border-border bg-surface"
                  : "border-border/60 bg-muted/40 opacity-80"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <ImagePlus size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {product.name}
                    <span className="ml-2 text-muted-foreground">
                      {product.typeName}
                    </span>
                    {product.isMinibar ? (
                      <span className="ml-2 text-xs text-primary">มินิบาร์</span>
                    ) : null}
                    {!product.isActive ? (
                      <span className="ml-2 text-xs text-warning">ปิดขาย</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(product.price)}
                    {product.categoryName ? ` · ${product.categoryName}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(product)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
                >
                  <Pencil size={14} />
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => void toggleActive(product)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
                >
                  {product.isActive ? "ปิดขาย" : "เปิดขาย"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              {editingId ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
            </h3>
            <form className="mt-4 space-y-3" onSubmit={(e) => void submitForm(e)}>
              <label className="block text-sm">
                ชื่อสินค้า
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                รายละเอียด
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      description: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                ราคา (บาท)
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  value={form.price}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, price: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>

              <div className="space-y-2">
                <label className="block text-sm">
                  ประเภท
                  <select
                    required
                    value={form.typeId}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        typeId: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  >
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                    <option value={NEW_TYPE_VALUE}>+ เพิ่มประเภทใหม่...</option>
                  </select>
                </label>
                {form.typeId === NEW_TYPE_VALUE ? (
                  <label className="block text-sm">
                    ชื่อประเภทใหม่
                    <input
                      required
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="เช่น ของที่ระลึก"
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                    />
                  </label>
                ) : null}
              </div>

              {requiresFoodCategory ? (
                <div className="space-y-2">
                  <label className="block text-sm">
                    หมวดอาหาร
                    <select
                      required
                      value={form.categoryId}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          categoryId: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                      <option value={NEW_CATEGORY_VALUE}>
                        + เพิ่มหมวดใหม่...
                      </option>
                    </select>
                  </label>
                  {form.categoryId === NEW_CATEGORY_VALUE ? (
                    <label className="block text-sm">
                      ชื่อหมวดใหม่
                      <input
                        required
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="เช่น ทอด"
                        className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              <label className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.isMinibar}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      isMinibar: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <span>
                  <span className="font-medium text-foreground">ใส่ในมินิบาร์</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    ติ๊กถ้าต้องการให้สินค้านี้แสดงในแท็บมินิบาร์ตอนสั่งของ
                  </span>
                </span>
              </label>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">รูปเมนู</p>
                {form.imageUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.imageUrl}
                      alt="ตัวอย่างรูปเมนู"
                      className="h-40 w-full object-cover"
                    />
                    <button
                      type="button"
                      disabled={saving || uploading}
                      onClick={() =>
                        setForm((current) => ({ ...current, imageUrl: "" }))
                      }
                      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs text-white"
                    >
                      <Trash2 size={12} />
                      ลบรูป
                    </button>
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
                    ยังไม่มีรูป
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(file);
                  }}
                />
                <button
                  type="button"
                  disabled={saving || uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
                >
                  <ImagePlus size={16} />
                  {uploading
                    ? "กำลังอัปโหลด..."
                    : form.imageUrl
                      ? "เปลี่ยนรูปจากเครื่อง / มือถือ"
                      : "เลือกรูปจากเครื่อง / มือถือ"}
                </button>
              </div>

              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving || uploading}
                  onClick={closeModal}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
