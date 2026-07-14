"use client";

import { Camera, ImagePlus, Pencil, ScanBarcode, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { prepareImageForUpload } from "@/lib/media/prepare-image-upload";

type Category = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryId: string;
  unit: string;
  costPrice: string | number;
  sellPrice: string | number;
  lowStockThreshold: string | number;
  quantityOnHand: string | number;
  isActive: boolean;
  imageUrl: string | null;
  category: Category;
};

type ProductForm = {
  barcode: string;
  name: string;
  categoryId: string;
  unit: string;
  costPrice: string;
  sellPrice: string;
  quantityOnHand: string;
  lowStockThreshold: string;
  imageUrl: string;
};

async function api<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      ((await response.json().catch(() => null)) as { message?: string } | null)
        ?.message ?? "บันทึกไม่สำเร็จ",
    );
  }
  return response.json() as Promise<T>;
}

const blankProduct: ProductForm = {
  barcode: "",
  name: "",
  categoryId: "",
  unit: "ชิ้น",
  costPrice: "",
  sellPrice: "",
  quantityOnHand: "",
  lowStockThreshold: "5",
  imageUrl: "",
};

export function PosProductsBoard() {
  const { can } = useEmployeePermissions();
  const canManage = can("pos.product.manage");
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [product, setProduct] = useState<ProductForm>(blankProduct);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingSku, setEditingSku] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const formSectionRef = useRef<HTMLElement>(null);
  const imagePreviewRef = useRef<string | null>(null);

  function clearImagePreview() {
    if (imagePreviewRef.current) {
      URL.revokeObjectURL(imagePreviewRef.current);
      imagePreviewRef.current = null;
    }
    setImagePreview(null);
  }

  const load = useCallback(async () => {
    try {
      const [nextCategories, nextProducts] = await Promise.all([
        api<Category[]>("/api/pos/categories"),
        api<Product[]>(`/api/pos/products?q=${encodeURIComponent(query)}`),
      ]);
      setCategories(nextCategories);
      setProducts(nextProducts);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCategory() {
    const name = categoryName.trim();
    if (!name) {
      setMessage("กรุณาระบุชื่อหมวดหมู่");
      return;
    }
    try {
      if (editingCategoryId) {
        await api<Category>(`/api/pos/categories/${editingCategoryId}`, {
          method: "PATCH",
          body: JSON.stringify({ name }),
        });
      } else {
        await api<Category>("/api/pos/categories", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
      }
      setCategoryName("");
      setEditingCategoryId(null);
      void load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : editingCategoryId
            ? "แก้ไขหมวดหมู่ไม่สำเร็จ"
            : "เพิ่มหมวดหมู่ไม่สำเร็จ",
      );
    }
  }

  function startEditCategory(item: Category) {
    setEditingCategoryId(item.id);
    setCategoryName(item.name);
  }

  function cancelEditCategory() {
    setEditingCategoryId(null);
    setCategoryName("");
  }

  async function deleteCategory(item: Category) {
    const ok = await confirm({
      title: `ลบหมวดหมู่ "${item.name}"?`,
      description: "ลบได้เฉพาะหมวดที่ยังไม่มีสินค้า",
      confirmLabel: "ลบ",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api(`/api/pos/categories/${item.id}`, { method: "DELETE" });
      if (editingCategoryId === item.id) cancelEditCategory();
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ลบหมวดหมู่ไม่สำเร็จ");
    }
  }

  async function toggleCategory(item: Category) {
    try {
      await api(`/api/pos/categories/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      void load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "เปลี่ยนสถานะหมวดหมู่ไม่สำเร็จ",
      );
    }
  }

  async function uploadImage(file: File | null | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    clearImagePreview();
    const localPreview = URL.createObjectURL(file);
    imagePreviewRef.current = localPreview;
    setImagePreview(localPreview);
    try {
      const prepared = await prepareImageForUpload(file);
      const form = new FormData();
      form.set("file", prepared);
      const body = await api<{ imageUrl: string }>("/api/pos/images", {
        method: "POST",
        body: form,
      });
      setProduct((current) => ({ ...current, imageUrl: body.imageUrl }));
      clearImagePreview();
    } catch (error) {
      clearImagePreview();
      setMessage(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  function startEditProduct(item: Product) {
    clearImagePreview();
    setEditingProductId(item.id);
    setEditingSku(item.sku);
    setProduct({
      barcode: item.barcode ?? "",
      name: item.name,
      categoryId: item.categoryId || item.category?.id || "",
      unit: item.unit,
      costPrice: String(item.costPrice ?? ""),
      sellPrice: String(item.sellPrice ?? ""),
      quantityOnHand: String(item.quantityOnHand ?? "0"),
      lowStockThreshold: String(item.lowStockThreshold ?? "5"),
      imageUrl: item.imageUrl ?? "",
    });
    setMessage("");
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEditProduct() {
    clearImagePreview();
    setEditingProductId(null);
    setEditingSku("");
    setProduct(blankProduct);
  }

  async function saveProduct() {
    if (!product.name.trim()) {
      setMessage("กรุณาระบุชื่อสินค้า");
      return;
    }
    if (!product.categoryId) {
      setMessage("กรุณาเลือกหมวดหมู่");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        barcode: product.barcode.trim() || "",
        name: product.name.trim(),
        categoryId: product.categoryId,
        unit: product.unit.trim() || "ชิ้น",
        costPrice: product.costPrice,
        sellPrice: product.sellPrice,
        lowStockThreshold: product.lowStockThreshold,
        imageUrl: product.imageUrl.trim() || null,
      };
      if (editingProductId) {
        await api<Product>(`/api/pos/products/${editingProductId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api<Product>("/api/pos/products", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            barcode: product.barcode.trim() || undefined,
            imageUrl: product.imageUrl.trim() || undefined,
            ...(product.quantityOnHand.trim()
              ? { quantityOnHand: product.quantityOnHand.trim() }
              : {}),
          }),
        });
      }
      cancelEditProduct();
      void load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : editingProductId
            ? "แก้ไขสินค้าไม่สำเร็จ"
            : "เพิ่มสินค้าไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(item: Product) {
    const ok = await confirm({
      title: `ลบสินค้า "${item.name}"?`,
      description: "ลบได้เฉพาะสินค้าที่ยังไม่มีประวัติขายหรือสต๊อก",
      confirmLabel: "ลบ",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api(`/api/pos/products/${item.id}`, { method: "DELETE" });
      if (editingProductId === item.id) cancelEditProduct();
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ลบสินค้าไม่สำเร็จ");
    }
  }

  async function toggleProduct(item: Product) {
    try {
      await api<Product>(`/api/pos/products/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "แก้ไขสินค้าไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      {message ? (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-semibold">หมวดหมู่สินค้า</h2>
          <PermissionGate permission="pos.product.manage">
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder={
                  editingCategoryId ? "ชื่อหมวดหมู่ที่แก้ไข" : "ชื่อหมวดหมู่ใหม่"
                }
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveCategory()}
                  className="rounded-xl bg-primary px-4 py-2 text-primary-foreground"
                >
                  {editingCategoryId ? "บันทึก" : "เพิ่ม"}
                </button>
                {editingCategoryId ? (
                  <button
                    type="button"
                    onClick={cancelEditCategory}
                    className="rounded-xl border border-border px-4 py-2"
                  >
                    ยกเลิก
                  </button>
                ) : null}
              </div>
            </div>
          </PermissionGate>
          <div className="mt-4 space-y-2">
            {categories.map((item) => (
              <div
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
                  item.isActive
                    ? "border-border"
                    : "border-destructive/30 text-muted-foreground"
                } ${editingCategoryId === item.id ? "ring-2 ring-primary/40" : ""}`}
              >
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => void toggleCategory(item)}
                    className="min-w-0 flex-1 text-left"
                    title="คลิกเพื่อเปิด/ปิดใช้งาน"
                  >
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </button>
                ) : (
                  <div className="min-w-0 flex-1 text-left">
                    <span className="font-medium text-foreground">{item.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </div>
                )}
                <PermissionGate permission="pos.product.manage">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEditCategory(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1"
                    >
                      <Pencil size={14} />
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteCategory(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-destructive"
                    >
                      <Trash2 size={14} />
                      ลบ
                    </button>
                  </div>
                </PermissionGate>
              </div>
            ))}
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีหมวดหมู่</p>
            ) : null}
          </div>
        </section>

        <PermissionGate permission="pos.product.manage">
        <section
          ref={formSectionRef}
          className="rounded-3xl border border-border bg-surface p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {editingProductId ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}
            </h2>
            {editingProductId ? (
              <button
                type="button"
                onClick={cancelEditProduct}
                className="rounded-lg border border-border px-3 py-1 text-sm"
              >
                ยกเลิกแก้ไข
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="rounded-xl border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
              {editingProductId ? (
                <>
                  รหัส SKU{" "}
                  <span className="font-medium text-foreground">{editingSku}</span>
                  {" "}(แก้ไม่ได้)
                </>
              ) : (
                <>
                  รหัส SKU จะสร้างอัตโนมัติรูปแบบ{" "}
                  <span className="font-medium text-foreground">SKU-0001</span>
                </>
              )}
            </p>
            <div className="flex gap-2 sm:col-span-2">
              <input
                value={product.barcode}
                onChange={(event) =>
                  setProduct((current) => ({
                    ...current,
                    barcode: event.target.value,
                  }))
                }
                placeholder="บาร์โค้ด (ไม่บังคับ)"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2"
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm"
                title="สแกนบาร์โค้ดด้วยกล้อง"
              >
                <ScanBarcode size={16} />
                สแกน
              </button>
            </div>
            <input
              value={product.name}
              onChange={(event) =>
                setProduct((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="ชื่อสินค้า"
              className="rounded-xl border border-border bg-background px-3 py-2 sm:col-span-2"
            />
            <select
              value={product.categoryId}
              onChange={(event) =>
                setProduct((current) => ({
                  ...current,
                  categoryId: event.target.value,
                }))
              }
              className="rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">เลือกหมวดหมู่</option>
              {categories
                .filter(
                  (item) => item.isActive || item.id === product.categoryId,
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {!item.isActive ? " (ปิดใช้งาน)" : ""}
                  </option>
                ))}
            </select>
            <input
              value={product.unit}
              onChange={(event) =>
                setProduct((current) => ({
                  ...current,
                  unit: event.target.value,
                }))
              }
              placeholder="หน่วย"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
            <input
              value={product.costPrice}
              onChange={(event) =>
                setProduct((current) => ({
                  ...current,
                  costPrice: event.target.value,
                }))
              }
              placeholder="ราคาทุน"
              inputMode="decimal"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
            <input
              value={product.sellPrice}
              onChange={(event) =>
                setProduct((current) => ({
                  ...current,
                  sellPrice: event.target.value,
                }))
              }
              placeholder="ราคาขาย"
              inputMode="decimal"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
            {editingProductId ? (
              <p className="rounded-xl border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
                สต๊อกคงเหลือปัจจุบัน{" "}
                <span className="font-medium text-foreground">
                  {product.quantityOnHand} {product.unit || "ชิ้น"}
                </span>
                {" — "}
                ปรับสต๊อกที่เมนูสต๊อก
              </p>
            ) : (
              <label className="block text-sm sm:col-span-1">
                <span className="text-muted-foreground">
                  สต๊อกเริ่มต้น (ไม่บังคับ)
                </span>
                <input
                  value={product.quantityOnHand}
                  onChange={(event) =>
                    setProduct((current) => ({
                      ...current,
                      quantityOnHand: event.target.value,
                    }))
                  }
                  placeholder="ว่างไว้ = 0"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
            )}
            <label
              className={`block text-sm ${
                editingProductId ? "sm:col-span-2" : ""
              }`}
            >
              <span className="text-muted-foreground">สต๊อกขั้นต่ำ (แจ้งเตือน)</span>
              <input
                value={product.lowStockThreshold}
                onChange={(event) =>
                  setProduct((current) => ({
                    ...current,
                    lowStockThreshold: event.target.value,
                  }))
                }
                placeholder="เช่น 5"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-background p-3">
            <p className="text-sm font-medium">รูปสินค้า</p>
            <p className="mt-1 text-xs text-muted-foreground">
              เลือกจากเครื่องหรือถ่ายด้วยกล้องมือถือ
            </p>
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void uploadImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                void uploadImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => galleryRef.current?.click()}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50"
              >
                <ImagePlus size={16} />
                แนบรูป
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => cameraRef.current?.click()}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50"
              >
                <Camera size={16} />
                ถ่ายรูป
              </button>
            </div>
            {imagePreview || product.imageUrl ? (
              <div className="relative mt-3 overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview || product.imageUrl}
                  alt="รูปสินค้า"
                  className="h-40 w-full object-cover"
                />
                {uploading ? (
                  <p className="absolute inset-x-0 bottom-0 bg-foreground/70 px-2 py-1 text-center text-xs text-background">
                    กำลังอัปโหลดรูป...
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    clearImagePreview();
                    setProduct((current) => ({ ...current, imageUrl: "" }));
                  }}
                  className="absolute right-2 top-2 rounded-lg bg-surface/90 px-2 py-1 text-xs disabled:opacity-50"
                >
                  ลบรูป
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={uploading || saving}
            onClick={() => void saveProduct()}
            className="mt-3 rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {editingProductId ? "บันทึกการแก้ไข" : "บันทึกสินค้า"}
          </button>
        </section>
        </PermissionGate>
      </div>

      <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <h2 className="font-semibold">สินค้า</h2>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อ, SKU หรือบาร์โค้ด"
            className="rounded-xl border border-border bg-background px-3 py-2"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th>สินค้า</th>
                <th>หมวดหมู่</th>
                <th>ขาย</th>
                <th>คงเหลือ</th>
                <th>สถานะ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-border ${
                    editingProductId === item.id ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="size-12 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <ImagePlus size={16} />
                        </span>
                      )}
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.sku}
                          {item.barcode ? ` · ${item.barcode}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>{item.category?.name ?? "-"}</td>
                  <td>{Number(item.sellPrice).toLocaleString("th-TH")}</td>
                  <td>
                    {item.quantityOnHand} {item.unit}
                  </td>
                  <td>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => void toggleProduct(item)}
                        className="rounded-lg border border-border px-2 py-1"
                      >
                        {item.isActive ? "ปิดขาย" : "เปิดขาย"}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">
                        {item.isActive ? "เปิดขาย" : "ปิดขาย"}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <PermissionGate permission="pos.product.manage">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEditProduct(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1"
                        >
                          <Pencil size={14} />
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteProduct(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-destructive"
                        >
                          <Trash2 size={14} />
                          ลบ
                        </button>
                      </div>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) =>
          setProduct((current) => ({ ...current, barcode: code }))
        }
      />
    </div>
  );
}
