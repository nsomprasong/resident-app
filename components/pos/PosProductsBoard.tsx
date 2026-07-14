"use client";

import { Camera, ImagePlus, ScanBarcode } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { BarcodeScanner } from "@/components/pos/BarcodeScanner";

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
  unit: string;
  sellPrice: string | number;
  quantityOnHand: string | number;
  isActive: boolean;
  imageUrl: string | null;
  category: Category;
};

type ProductForm = {
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  unit: string;
  costPrice: string;
  sellPrice: string;
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
  sku: "",
  barcode: "",
  name: "",
  categoryId: "",
  unit: "ชิ้น",
  costPrice: "",
  sellPrice: "",
  lowStockThreshold: "5",
  imageUrl: "",
};

export function PosProductsBoard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [product, setProduct] = useState<ProductForm>(blankProduct);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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

  async function createCategory() {
    try {
      await api<Category>("/api/pos/categories", {
        method: "POST",
        body: JSON.stringify({ name: categoryName }),
      });
      setCategoryName("");
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เพิ่มหมวดหมู่ไม่สำเร็จ");
    }
  }

  async function uploadImage(file: File | null | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      const body = await api<{ imageUrl: string }>("/api/pos/images", {
        method: "POST",
        body: form,
      });
      setProduct((current) => ({ ...current, imageUrl: body.imageUrl }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function createProduct() {
    try {
      await api<Product>("/api/pos/products", {
        method: "POST",
        body: JSON.stringify({
          ...product,
          barcode: product.barcode.trim() || undefined,
          imageUrl: product.imageUrl.trim() || undefined,
        }),
      });
      setProduct(blankProduct);
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เพิ่มสินค้าไม่สำเร็จ");
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
      {message ? (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-semibold">หมวดหมู่สินค้า</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="ชื่อหมวดหมู่"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2"
            />
            <button
              type="button"
              onClick={() => void createCategory()}
              className="rounded-xl bg-primary px-4 py-2 text-primary-foreground"
            >
              เพิ่ม
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  void api(`/api/pos/categories/${item.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ isActive: !item.isActive }),
                  }).then(load)
                }
                className={`rounded-xl border px-3 py-2 text-sm ${
                  item.isActive
                    ? "border-border"
                    : "border-destructive/30 text-muted-foreground"
                }`}
              >
                {item.name} · {item.isActive ? "ใช้งาน" : "ปิด"}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-semibold">เพิ่มสินค้า</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={product.sku}
              onChange={(event) =>
                setProduct((current) => ({ ...current, sku: event.target.value }))
              }
              placeholder="SKU"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
            <div className="flex gap-2">
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
                .filter((item) => item.isActive)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
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
            <input
              value={product.lowStockThreshold}
              onChange={(event) =>
                setProduct((current) => ({
                  ...current,
                  lowStockThreshold: event.target.value,
                }))
              }
              placeholder="จุดแจ้งเตือน"
              inputMode="decimal"
              className="rounded-xl border border-border bg-background px-3 py-2 sm:col-span-2"
            />
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
            {product.imageUrl ? (
              <div className="relative mt-3 overflow-hidden rounded-xl border border-border">
                <Image
                  src={product.imageUrl}
                  alt="รูปสินค้า"
                  width={480}
                  height={320}
                  className="h-40 w-full object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() =>
                    setProduct((current) => ({ ...current, imageUrl: "" }))
                  }
                  className="absolute right-2 top-2 rounded-lg bg-surface/90 px-2 py-1 text-xs"
                >
                  ลบรูป
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={() => void createProduct()}
            className="mt-3 rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            บันทึกสินค้า
          </button>
        </section>
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
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          width={48}
                          height={48}
                          className="size-12 rounded-lg object-cover"
                          unoptimized
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
                    <button
                      type="button"
                      onClick={() => void toggleProduct(item)}
                      className="rounded-lg border border-border px-2 py-1"
                    >
                      {item.isActive ? "ปิดขาย" : "เปิดขาย"}
                    </button>
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
