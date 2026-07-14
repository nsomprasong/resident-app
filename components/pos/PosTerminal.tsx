"use client";

import {
  Banknote,
  Download,
  Minus,
  Package,
  PauseCircle,
  Plus,
  QrCode,
  ScanBarcode,
  Search,
  ShoppingBag,
  Trash2,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { PermissionGate } from "@/components/auth/PermissionGate";
import { BarcodeScanner } from "@/components/pos/BarcodeScanner";
import Modal from "@/components/ui/Modal";

type Category = { id: string; name: string; isActive: boolean };
type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  sellPrice: string | number;
  quantityOnHand: string | number;
  isActive: boolean;
  imageUrl: string | null;
  category: Category;
};
type Shift = { id: string; openingFloat: string | number; openedAt: string };
type CartLine = { product: Product; quantity: number; discount: number };
type Hold = {
  id: string;
  holdNumber: string;
  billDiscount: string | number;
  items: Array<{
    productId: string;
    quantity: string | number;
    unitPrice: string | number;
    discount: string | number;
  }>;
};
type Booking = {
  id: string;
  guest: { firstName: string; lastName: string } | null;
  rooms: Array<{ room: { number: string } }>;
  tourGroup: { name: string } | null;
};
type Sale = { receiptNumber: string; netTotal: string | number };
type PromptPayAccountOption = {
  id: string;
  displayName: string;
  identifierMasked: string;
  accountName: string;
  isPrimary: boolean;
};
type PromptPayQr = {
  accountId: string;
  accountName: string;
  displayName: string;
  identifierMasked: string;
  amount: number;
  dataUrl: string;
};

const paymentMethods = [
  ["CASH", "เงินสด"],
  ["PROMPTPAY", "PromptPay"],
  ["TRANSFER", "โอนเงิน"],
  ["ROOM_CHARGE", "ลงห้องพัก"],
  ["TOUR_CHARGE", "ลงกรุ๊ปทัวร์"],
] as const;

function amount(value: string | number) {
  return Number(value) || 0;
}
function baht(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  });
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(error?.message ?? "ดำเนินการไม่สำเร็จ");
  }
  return response.json() as Promise<T>;
}

export function PosTerminal() {
  const { can } = useEmployeePermissions();
  const canSell = can("pos.sell");
  const canHold = can("pos.hold");
  const canDiscount = can("pos.discount");
  const canOpenShift = can("pos.shift.open");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shift, setShift] = useState<Shift | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [billDiscount, setBillDiscount] = useState("0");
  const [method, setMethod] =
    useState<(typeof paymentMethods)[number][0]>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showBookings, setShowBookings] = useState(false);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [showHolds, setShowHolds] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [promptPayAccounts, setPromptPayAccounts] = useState<
    PromptPayAccountOption[]
  >([]);
  const [promptPayAccountId, setPromptPayAccountId] = useState("");
  const [promptPayQr, setPromptPayQr] = useState<PromptPayQr | null>(null);
  const scanBuffer = useRef("");
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextCategories, nextProducts, nextShift] = await Promise.all([
        request<Category[]>("/api/pos/categories"),
        request<Product[]>("/api/pos/products"),
        request<Shift | null>("/api/pos/shifts/current"),
      ]);
      setCategories(nextCategories.filter((item) => item.isActive));
      setProducts(nextProducts.filter((item) => item.isActive));
      setShift(nextShift);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const addProduct = useCallback((product: Product) => {
    if (amount(product.quantityOnHand) <= 0) {
      setMessage("สินค้านี้คงเหลือไม่พอ");
      return;
    }
    setCart((previous) => {
      const found = previous.find((line) => line.product.id === product.id);
      return found
        ? previous.map((line) =>
            line.product.id === product.id
              ? {
                  ...line,
                  quantity: Math.min(
                    line.quantity + 1,
                    amount(product.quantityOnHand),
                  ),
                }
              : line,
          )
        : [...previous, { product, quantity: 1, discount: 0 }];
    });
    setMessage(`เพิ่ม ${product.name}`);
  }, []);

  const addByCode = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;
      const product = products.find(
        (item) =>
          item.barcode === code ||
          item.sku === code ||
          item.barcode?.replace(/\s+/g, "") === code.replace(/\s+/g, ""),
      );
      if (!product) {
        setMessage(`ไม่พบสินค้าสำหรับรหัส ${code}`);
        setQuery(code);
        return;
      }
      addProduct(product);
    },
    [addProduct, products],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Enter" && scanBuffer.current) {
        const code = scanBuffer.current;
        scanBuffer.current = "";
        addByCode(code);
        return;
      }
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        scanBuffer.current += event.key;
        if (scanTimer.current) clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => {
          scanBuffer.current = "";
        }, 120);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addByCode]);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, line) =>
          sum + amount(line.product.sellPrice) * line.quantity - line.discount,
        0,
      ),
    [cart],
  );
  const total = Math.max(0, subtotal - amount(billDiscount));
  const received = amount(cashReceived);
  const change = method === "CASH" ? Math.max(0, received - total) : 0;
  const cartCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  );
  const visibleProducts = products.filter(
    (product) =>
      (!categoryId || product.category.id === categoryId) &&
      (!query ||
        [product.name, product.sku, product.barcode ?? ""].some((value) =>
          value.toLowerCase().includes(query.toLowerCase()),
        )),
  );

  function updateLine(
    productId: string,
    patch: Partial<Pick<CartLine, "quantity" | "discount">>,
  ) {
    setCart((previous) =>
      previous
        .map((line) =>
          line.product.id === productId ? { ...line, ...patch } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }
  async function openShift() {
    setBusy(true);
    try {
      setShift(
        await request<Shift>("/api/pos/shifts", {
          method: "POST",
          body: JSON.stringify({ openingFloat }),
        }),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เปิดกะไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function loadHolds() {
    try {
      setHolds(await request<Hold[]>("/api/pos/holds"));
      setShowHolds(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดบิลพักไม่สำเร็จ");
    }
  }
  async function holdBill() {
    if (!shift || !cart.length) return;
    setBusy(true);
    try {
      await request<Hold>("/api/pos/holds", {
        method: "POST",
        body: JSON.stringify({
          shiftId: shift.id,
          billDiscount,
          lines: cart.map((line) => ({
            productId: line.product.id,
            quantity: String(line.quantity),
            unitPrice: String(amount(line.product.sellPrice)),
            discount: String(line.discount),
          })),
        }),
      });
      setCart([]);
      setBillDiscount("0");
      setMessage("พักบิลแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "พักบิลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function resumeHold(hold: Hold) {
    const lines = hold.items
      .map((item) => {
        const product = products.find(
          (candidate) => candidate.id === item.productId,
        );
        return product
          ? {
              product,
              quantity: amount(item.quantity),
              discount: amount(item.discount),
            }
          : null;
      })
      .filter((item): item is CartLine => item !== null);
    setCart(lines);
    setBillDiscount(String(hold.billDiscount));
    await request(`/api/pos/holds/${hold.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "resume" }),
    });
    setShowHolds(false);
  }
  async function chooseBooking() {
    try {
      setBookings(await request<Booking[]>("/api/pos/bookings/search"));
      setShowBookings(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ค้นหารายการเข้าพักไม่สำเร็จ",
      );
    }
  }
  function printReceipt(sale: Sale) {
    const popup = window.open("", "_blank", "width=360,height=600");
    if (!popup) return;
    popup.document.write(
      `<title>ใบเสร็จ ${sale.receiptNumber}</title><main style="font-family:sans-serif;padding:24px"><h2>Resident Supermarket</h2><p>ใบเสร็จ: ${sale.receiptNumber}</p><p>ยอดสุทธิ: ${baht(amount(sale.netTotal))}</p><p>${new Date().toLocaleString("th-TH")}</p></main>`,
    );
    popup.document.close();
    popup.print();
  }

  async function ensurePromptPayAccounts() {
    if (promptPayAccounts.length) return promptPayAccounts;
    const accounts = await request<PromptPayAccountOption[]>(
      "/api/pos/promptpay-accounts",
    );
    setPromptPayAccounts(accounts);
    if (!promptPayAccountId) {
      const primary = accounts.find((account) => account.isPrimary) ?? accounts[0];
      if (primary) setPromptPayAccountId(primary.id);
    }
    return accounts;
  }

  async function openPromptPayQr(accountId?: string) {
    if (total <= 0) {
      setMessage("ยอดชำระต้องมากกว่า 0");
      return;
    }
    setBusy(true);
    try {
      const accounts = await ensurePromptPayAccounts();
      if (!accounts.length) {
        setMessage(
          "ยังไม่มีบัญชีพร้อมเพย์ที่ใช้งานได้ — ตั้งค่าที่การชำระเงินก่อน",
        );
        return;
      }
      const selectedId =
        accountId ||
        promptPayAccountId ||
        accounts.find((account) => account.isPrimary)?.id ||
        accounts[0]?.id;
      if (!selectedId) {
        setMessage("กรุณาเลือกบัญชีพร้อมเพย์");
        return;
      }
      setPromptPayAccountId(selectedId);
      const qr = await request<PromptPayQr>("/api/pos/promptpay-qr", {
        method: "POST",
        body: JSON.stringify({ accountId: selectedId, amount: total }),
      });
      setPromptPayQr(qr);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "สร้าง QR ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function completeCheckout(reference?: string) {
    if (!shift || !cart.length) return;
    setBusy(true);
    try {
      const sale = await request<Sale>("/api/pos/sales", {
        method: "POST",
        body: JSON.stringify({
          shiftId: shift.id,
          idempotencyKey: crypto.randomUUID(),
          billDiscount,
          bookingId: booking?.id,
          lines: cart.map((line) => ({
            productId: line.product.id,
            quantity: String(line.quantity),
            discount: String(line.discount),
          })),
          payments: [
            {
              method,
              amount: String(total),
              reference: reference ?? booking?.id,
            },
          ],
        }),
      });
      setMessage(`ขายสำเร็จ เลขที่ ${sale.receiptNumber}`);
      setCart([]);
      setBillDiscount("0");
      setCashReceived("");
      setBooking(null);
      setPromptPayQr(null);
      printReceipt(sale);
      void load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "บันทึกการขายไม่สำเร็จ",
      );
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!shift || !cart.length) return;
    if (method === "CASH" && received < total) {
      setMessage("จำนวนเงินรับน้อยกว่ายอดชำระ");
      return;
    }
    if ((method === "ROOM_CHARGE" || method === "TOUR_CHARGE") && !booking) {
      setMessage("กรุณาเลือกรายการเข้าพัก");
      return;
    }
    if (method === "PROMPTPAY") {
      await openPromptPayQr();
      return;
    }
    await completeCheckout();
  }

  function downloadPromptPayQr() {
    if (!promptPayQr) return;
    const link = document.createElement("a");
    link.href = promptPayQr.dataUrl;
    link.download = `promptpay-pos-${promptPayQr.amount.toFixed(2)}.png`;
    link.click();
  }

  function printPromptPayQr() {
    if (!promptPayQr) return;
    const popup = window.open("", "_blank", "width=420,height=640");
    if (!popup) return;
    popup.document.write(
      `<title>PromptPay QR</title><main style="font-family:sans-serif;text-align:center;padding:24px"><h2>ชำระเงินซูเปอร์มาร์เก็ต</h2><img src="${promptPayQr.dataUrl}" width="280" height="280" /><p>${promptPayQr.accountName}</p><p>${promptPayQr.identifierMasked}</p><p style="font-size:28px;font-weight:700">${baht(promptPayQr.amount)}</p></main>`,
    );
    popup.document.close();
    popup.print();
  }

  function selectPaymentMethod(next: (typeof paymentMethods)[number][0]) {
    setMethod(next);
    setBooking(null);
    setPromptPayQr(null);
    if (next === "PROMPTPAY") {
      void ensurePromptPayAccounts().catch((error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "โหลดบัญชีพร้อมเพย์ไม่สำเร็จ",
        );
      });
    }
  }

  if (!shift) {
    return (
      <section className="mx-auto max-w-lg overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm">
        <div className="relative border-b border-border bg-gradient-to-br from-primary/20 via-surface to-secondary/10 px-6 py-8">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/20 text-primary shadow-sm ring-1 ring-primary/20">
            <Wallet size={28} />
          </div>
          <h2 className="mt-4 text-center text-2xl font-semibold tracking-tight">
            เปิดกะก่อนเริ่มขาย
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {canOpenShift
              ? "ใส่เงินทอนตั้งต้นในลิ้นชัก แล้วเริ่มรับออเดอร์ได้ทันที"
              : "ไม่มีสิทธิ์เปิดกะ — ติดต่อหัวหน้ากะหรือผู้ดูแลระบบ"}
          </p>
        </div>
        <div className="space-y-4 p-6">
          {canOpenShift ? (
            <>
              <label className="block text-sm font-medium text-foreground">
                เงินทอนตั้งต้น (บาท)
                <input
                  autoFocus
                  inputMode="decimal"
                  value={openingFloat}
                  onChange={(event) => setOpeningFloat(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg outline-none ring-primary/30 transition focus:ring-2"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                data-tooltip="เปิดกะขายพร้อมเงินทอนตั้งต้นในลิ้นชัก"
                onClick={() => void openShift()}
                className="w-full rounded-2xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition hover:brightness-105 disabled:opacity-50"
              >
                เปิดกะขาย
              </button>
            </>
          ) : null}
          {message ? (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {message}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface/90 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <span className="size-1.5 rounded-full bg-success" />
            กะเปิดอยู่
          </span>
          <p className="truncate text-sm text-muted-foreground">
            เปิดเมื่อ {new Date(shift.openedAt).toLocaleString("th-TH")} · เงินทอน{" "}
            {baht(amount(shift.openingFloat))}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          สินค้าในตะกร้า{" "}
          <span className="font-semibold text-foreground">{cartCount}</span> ชิ้น
        </p>
      </div>

      {message ? (
        <p
          role="status"
          className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground shadow-sm"
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 rounded-[1.75rem] border border-border bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-background px-3.5 shadow-inner transition focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
              <Search size={18} className="shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && query.trim()) {
                    event.preventDefault();
                    addByCode(query);
                  }
                }}
                placeholder="ค้นหาชื่อ, SKU หรือบาร์โค้ด"
                className="w-full bg-transparent py-3 outline-none placeholder:text-muted-foreground/80"
              />
            </label>
            {canSell ? (
              <button
                type="button"
                data-tooltip="เปิดกล้องสแกนบาร์โค้ดเพื่อเพิ่มสินค้า"
                onClick={() => setScannerOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground shadow-sm transition hover:brightness-110"
              >
                <ScanBarcode size={18} />
                สแกนบาร์โค้ด
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setCategoryId("")}
              className={`shrink-0 rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
                !categoryId
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              ทั้งหมด
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={`shrink-0 rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
                  categoryId === category.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {visibleProducts.length === 0 ? (
            <div className="mt-10 grid place-items-center gap-3 py-16 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Package size={26} />
              </div>
              <p className="font-medium text-foreground">ไม่พบสินค้า</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                ลองเปลี่ยนหมวดหมู่ หรือพิมพ์ชื่อ / SKU / บาร์โค้ดใหม่
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visibleProducts.map((product) => {
                const stock = amount(product.quantityOnHand);
                const outOfStock = stock <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={!canSell || outOfStock}
                    onClick={() => {
                      if (canSell && !outOfStock) addProduct(product);
                    }}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-background p-2.5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                  >
                    <div className="relative mb-2.5 aspect-square overflow-hidden rounded-xl bg-muted">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-muted-foreground">
                          <Package size={28} className="opacity-40" />
                        </div>
                      )}
                      <span
                        className={`absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[11px] font-medium shadow-sm ${
                          outOfStock
                            ? "bg-destructive text-destructive-foreground"
                            : stock <= 5
                              ? "bg-warning text-warning-foreground"
                              : "bg-surface/90 text-foreground"
                        }`}
                      >
                        {outOfStock ? "หมด" : `เหลือ ${stock}`}
                      </span>
                    </div>
                    <p className="line-clamp-2 min-h-10 text-sm font-medium leading-snug text-foreground">
                      {product.name}
                    </p>
                    <p className="mt-2 text-base font-semibold text-primary">
                      {baht(amount(product.sellPrice))}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="flex h-fit flex-col overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-sm lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-primary/15 via-surface to-secondary/10 px-4 py-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/20 text-primary">
                <ShoppingBag size={18} />
              </span>
              <div>
                <h2 className="text-lg font-semibold leading-tight">ตะกร้า</h2>
                <p className="text-xs text-muted-foreground">
                  {cartCount > 0 ? `${cartCount} รายการ` : "ยังว่าง"}
                </p>
              </div>
            </div>
            <PermissionGate permission="pos.hold">
              <button
                type="button"
                data-tooltip="เรียกบิลที่พักไว้กลับมาชำระต่อ"
                onClick={() => void loadHolds()}
                className="rounded-xl px-2.5 py-1.5 text-sm font-medium text-secondary transition hover:bg-secondary/10"
              >
                เรียกบิลพัก
              </button>
            </PermissionGate>
          </div>

          <div className="max-h-[22rem] space-y-2 overflow-y-auto px-3 py-3">
            {cart.length === 0 ? (
              <div className="grid place-items-center gap-2 py-12 text-center">
                <ShoppingBag size={28} className="text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  แตะสินค้าทางซ้ายเพื่อเพิ่มลงตะกร้า
                </p>
              </div>
            ) : (
              cart.map((line) => {
                const lineTotal =
                  amount(line.product.sellPrice) * line.quantity - line.discount;
                return (
                  <div
                    key={line.product.id}
                    className="rounded-2xl border border-border/80 bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">
                        {line.product.name}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          updateLine(line.product.id, { quantity: 0 })
                        }
                        aria-label="ลบสินค้า"
                        className="rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-surface">
                        <button
                          type="button"
                          onClick={() =>
                            updateLine(line.product.id, {
                              quantity: line.quantity - 1,
                            })
                          }
                          className="p-2 transition hover:bg-muted"
                          aria-label="ลดจำนวน"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-9 text-center text-sm font-semibold">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateLine(line.product.id, {
                              quantity: Math.min(
                                line.quantity + 1,
                                amount(line.product.quantityOnHand),
                              ),
                            })
                          }
                          className="p-2 transition hover:bg-muted"
                          aria-label="เพิ่มจำนวน"
                        >
                          <Plus size={14} />
                        </button>
                      </span>
                      {canDiscount ? (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          ลด
                          <input
                            inputMode="decimal"
                            value={line.discount}
                            onChange={(event) =>
                              updateLine(line.product.id, {
                                discount: amount(event.target.value),
                              })
                            }
                            className="w-16 rounded-lg border border-border bg-surface px-1.5 py-1 text-right text-foreground"
                          />
                        </label>
                      ) : null}
                      <span className="ml-auto text-sm font-semibold">
                        {baht(lineTotal)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-auto space-y-3 border-t border-border bg-muted/40 px-4 py-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>รวม</span>
                <span>{baht(subtotal)}</span>
              </div>
              {canDiscount ? (
                <label className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">ส่วนลดบิล</span>
                  <input
                    inputMode="decimal"
                    value={billDiscount}
                    onChange={(event) => setBillDiscount(event.target.value)}
                    className="w-28 rounded-xl border border-border bg-background px-2.5 py-1.5 text-right"
                  />
                </label>
              ) : null}
              <div className="flex items-end justify-between pt-1">
                <span className="text-base font-semibold">สุทธิ</span>
                <span className="text-2xl font-semibold tracking-tight text-primary">
                  {baht(total)}
                </span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                ช่องทางชำระ
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {paymentMethods.map(([value, label]) => {
                  const active = method === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectPaymentMethod(value)}
                      className={`rounded-xl px-2.5 py-2 text-left text-xs font-medium transition sm:text-sm ${
                        active
                          ? "bg-foreground text-background shadow-sm"
                          : "bg-background text-muted-foreground ring-1 ring-border hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {method === "CASH" ? (
              <div className="rounded-2xl border border-border bg-background p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Banknote size={16} className="text-primary" />
                  เงินที่รับ
                </label>
                <input
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(event) => setCashReceived(event.target.value)}
                  placeholder="0.00"
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-lg outline-none focus:ring-2 focus:ring-primary/25"
                />
                <p className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">เงินทอน</span>
                  <span className="font-semibold text-secondary">
                    {baht(change)}
                  </span>
                </p>
              </div>
            ) : null}

            {method === "PROMPTPAY" ? (
              <div className="space-y-2 rounded-2xl border border-border bg-background p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <QrCode size={16} className="text-secondary" />
                  บัญชีพร้อมเพย์
                </label>
                <select
                  value={promptPayAccountId}
                  onChange={(event) => {
                    setPromptPayAccountId(event.target.value);
                    setPromptPayQr(null);
                  }}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                >
                  {promptPayAccounts.length === 0 ? (
                    <option value="">กำลังโหลดบัญชี...</option>
                  ) : (
                    promptPayAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.displayName}
                        {account.isPrimary ? " (หลัก)" : ""} —{" "}
                        {account.identifierMasked}
                      </option>
                    ))
                  )}
                </select>
                <PermissionGate permission="pos.sell">
                  <button
                    type="button"
                    disabled={busy || !cart.length || total <= 0}
                    onClick={() => void openPromptPayQr()}
                    className="w-full rounded-xl border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm font-medium text-secondary disabled:opacity-50"
                  >
                    แสดง QR Code
                  </button>
                </PermissionGate>
              </div>
            ) : null}

            {method === "ROOM_CHARGE" || method === "TOUR_CHARGE" ? (
              <button
                type="button"
                onClick={() => void chooseBooking()}
                className="w-full rounded-2xl border border-dashed border-secondary/40 bg-secondary/5 px-3 py-3 text-sm font-medium text-secondary transition hover:bg-secondary/10"
              >
                {booking
                  ? `${booking.guest?.firstName ?? ""} ${booking.guest?.lastName ?? ""}`
                  : "เลือกรายการเข้าพัก"}
              </button>
            ) : null}

            <div
              className={`grid gap-2 ${canHold && canSell ? "grid-cols-2" : "grid-cols-1"}`}
            >
              <PermissionGate permission="pos.hold">
                <button
                  type="button"
                  disabled={busy || !cart.length}
                  data-tooltip="พักบิลนี้ไว้ก่อน เรียกกลับมาชำระทีหลังได้"
                  onClick={() => void holdBill()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-background px-3 py-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  <PauseCircle size={16} />
                  พักบิล
                </button>
              </PermissionGate>
              <PermissionGate permission="pos.sell">
                <button
                  type="button"
                  disabled={busy || !cart.length}
                  data-tooltip={
                    method === "PROMPTPAY"
                      ? "สร้าง QR PromptPay เพื่อรับชำระ"
                      : "ยืนยันรับชำระและพิมพ์ใบเสร็จ"
                  }
                  onClick={() => void checkout()}
                  className="w-full rounded-2xl bg-primary px-3 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition hover:brightness-105 disabled:opacity-50"
                >
                  {method === "PROMPTPAY" ? "สร้าง QR / ชำระ" : "ชำระเงิน"}
                </button>
              </PermissionGate>
            </div>
            {!canSell ? (
              <p className="text-center text-sm text-muted-foreground">
                ไม่มีสิทธิ์ขาย — มองเห็นรายการสินค้าได้เท่านั้น
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {showHolds ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-4 backdrop-blur-[2px]">
          <section className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">บิลที่พักไว้</h2>
              <p className="text-sm text-muted-foreground">
                แตะเพื่อเรียกกลับมาชำระต่อ
              </p>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto p-4">
              {holds.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  ไม่มีบิลพัก
                </p>
              ) : (
                holds.map((hold) => (
                  <button
                    key={hold.id}
                    type="button"
                    onClick={() => void resumeHold(hold)}
                    className="w-full rounded-2xl border border-border bg-background p-3.5 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <p className="font-medium">{hold.holdNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {hold.items.length} รายการ
                    </p>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setShowHolds(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                ปิด
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showBookings ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/45 p-4 backdrop-blur-[2px]">
          <section className="w-full max-w-lg overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">เลือกรายการเข้าพัก</h2>
              <p className="text-sm text-muted-foreground">
                สำหรับลงห้องพักหรือกรุ๊ปทัวร์
              </p>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto p-4">
              {bookings.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setBooking(item);
                    setShowBookings(false);
                  }}
                  className="w-full rounded-2xl border border-border bg-background p-3.5 text-left transition hover:border-secondary/40 hover:bg-secondary/5"
                >
                  <p className="font-medium">
                    {item.guest?.firstName} {item.guest?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ห้อง{" "}
                    {item.rooms.map((room) => room.room.number).join(", ") ||
                      "-"}
                    {item.tourGroup ? ` · ${item.tourGroup.name}` : ""}
                  </p>
                </button>
              ))}
            </div>
            <div className="border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setShowBookings(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                ปิด
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <Modal
        open={Boolean(promptPayQr)}
        onClose={() => setPromptPayQr(null)}
        title="ชำระเงินซูเปอร์มาร์เก็ต"
      >
        {promptPayQr ? (
          <div className="space-y-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={promptPayQr.dataUrl}
              alt="PromptPay QR"
              className="mx-auto h-64 w-64 rounded-2xl border border-border bg-white p-3 shadow-sm"
            />
            <p className="font-medium">{promptPayQr.accountName}</p>
            <p className="text-sm text-muted-foreground">
              {promptPayQr.identifierMasked}
            </p>
            <p className="text-3xl font-semibold text-foreground">
              {baht(promptPayQr.amount)}
            </p>
            <p className="text-xs text-warning">
              โปรดตรวจชื่อผู้รับในแอปธนาคารก่อนยืนยันโอนเงิน
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={downloadPromptPayQr}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <Download size={16} />
                ดาวน์โหลด
              </button>
              <button
                type="button"
                onClick={printPromptPayQr}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                พิมพ์
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void completeCheckout(
                  `${promptPayQr.displayName} (${promptPayQr.identifierMasked})`,
                )
              }
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              ยืนยันรับเงินแล้ว
            </button>
          </div>
        ) : null}
      </Modal>
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => addByCode(code)}
      />
    </div>
  );
}
