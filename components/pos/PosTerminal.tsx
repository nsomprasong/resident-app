"use client";

import { Download, Minus, PauseCircle, Plus, ScanBarcode, Search, Trash2 } from "lucide-react";
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
type Hold = { id: string; holdNumber: string; billDiscount: string | number; items: Array<{ productId: string; quantity: string | number; unitPrice: string | number; discount: string | number }> };
type Booking = { id: string; guest: { firstName: string; lastName: string } | null; rooms: Array<{ room: { number: string } }>; tourGroup: { name: string } | null };
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
  return value.toLocaleString("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
}
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string } | null;
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
  const [method, setMethod] = useState<(typeof paymentMethods)[number][0]>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showBookings, setShowBookings] = useState(false);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [showHolds, setShowHolds] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [promptPayAccounts, setPromptPayAccounts] = useState<PromptPayAccountOption[]>([]);
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
  useEffect(() => { void load(); }, [load]);

  const addProduct = useCallback((product: Product) => {
    if (amount(product.quantityOnHand) <= 0) {
      setMessage("สินค้านี้คงเหลือไม่พอ");
      return;
    }
    setCart((previous) => {
      const found = previous.find((line) => line.product.id === product.id);
      return found
        ? previous.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, amount(product.quantityOnHand)) } : line)
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
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        scanBuffer.current += event.key;
        if (scanTimer.current) clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => { scanBuffer.current = ""; }, 120);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addByCode]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + amount(line.product.sellPrice) * line.quantity - line.discount, 0), [cart]);
  const total = Math.max(0, subtotal - amount(billDiscount));
  const received = amount(cashReceived);
  const change = method === "CASH" ? Math.max(0, received - total) : 0;
  const visibleProducts = products.filter((product) =>
    (!categoryId || product.category.id === categoryId) &&
    (!query || [product.name, product.sku, product.barcode ?? ""].some((value) => value.toLowerCase().includes(query.toLowerCase()))),
  );

  function updateLine(productId: string, patch: Partial<Pick<CartLine, "quantity" | "discount">>) {
    setCart((previous) => previous.map((line) => line.product.id === productId ? { ...line, ...patch } : line).filter((line) => line.quantity > 0));
  }
  async function openShift() {
    setBusy(true);
    try { setShift(await request<Shift>("/api/pos/shifts", { method: "POST", body: JSON.stringify({ openingFloat }) })); }
    catch (error) { setMessage(error instanceof Error ? error.message : "เปิดกะไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function loadHolds() {
    try { setHolds(await request<Hold[]>("/api/pos/holds")); setShowHolds(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : "โหลดบิลพักไม่สำเร็จ"); }
  }
  async function holdBill() {
    if (!shift || !cart.length) return;
    setBusy(true);
    try {
      await request<Hold>("/api/pos/holds", { method: "POST", body: JSON.stringify({ shiftId: shift.id, billDiscount, lines: cart.map((line) => ({ productId: line.product.id, quantity: String(line.quantity), unitPrice: String(amount(line.product.sellPrice)), discount: String(line.discount) })) }) });
      setCart([]); setBillDiscount("0"); setMessage("พักบิลแล้ว");
    } catch (error) { setMessage(error instanceof Error ? error.message : "พักบิลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function resumeHold(hold: Hold) {
    const lines = hold.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return product ? { product, quantity: amount(item.quantity), discount: amount(item.discount) } : null;
    }).filter((item): item is CartLine => item !== null);
    setCart(lines); setBillDiscount(String(hold.billDiscount));
    await request(`/api/pos/holds/${hold.id}`, { method: "PATCH", body: JSON.stringify({ action: "resume" }) });
    setShowHolds(false);
  }
  async function chooseBooking() {
    try { setBookings(await request<Booking[]>("/api/pos/bookings/search")); setShowBookings(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : "ค้นหารายการเข้าพักไม่สำเร็จ"); }
  }
  function printReceipt(sale: Sale) {
    const popup = window.open("", "_blank", "width=360,height=600");
    if (!popup) return;
    popup.document.write(`<title>ใบเสร็จ ${sale.receiptNumber}</title><main style="font-family:sans-serif;padding:24px"><h2>Resident Supermarket</h2><p>ใบเสร็จ: ${sale.receiptNumber}</p><p>ยอดสุทธิ: ${baht(amount(sale.netTotal))}</p><p>${new Date().toLocaleString("th-TH")}</p></main>`);
    popup.document.close(); popup.print();
  }

  async function ensurePromptPayAccounts() {
    if (promptPayAccounts.length) return promptPayAccounts;
    const accounts = await request<PromptPayAccountOption[]>("/api/pos/promptpay-accounts");
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
        setMessage("ยังไม่มีบัญชีพร้อมเพย์ที่ใช้งานได้ — ตั้งค่าที่การชำระเงินก่อน");
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
          payments: [{
            method,
            amount: String(total),
            reference: reference ?? booking?.id,
          }],
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
      setMessage(error instanceof Error ? error.message : "บันทึกการขายไม่สำเร็จ");
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

  if (!shift) {
    return (
      <section className="mx-auto max-w-md rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-xl font-semibold">เปิดกะก่อนเริ่มขาย</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canOpenShift
            ? "ระบุเงินทอนตั้งต้นสำหรับกะนี้"
            : "ไม่มีสิทธิ์เปิดกะ — ติดต่อหัวหน้ากะหรือผู้ดูแลระบบ"}
        </p>
        {canOpenShift ? (
          <>
            <input
              autoFocus
              inputMode="decimal"
              value={openingFloat}
              onChange={(event) => setOpeningFloat(event.target.value)}
              className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2"
            />
            <button
              disabled={busy}
              onClick={() => void openShift()}
              className="mt-3 w-full rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
            >
              เปิดกะขาย
            </button>
          </>
        ) : null}
        {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {message && <p className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm">{message}</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        <section className="min-w-0 rounded-3xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Search size={18} />
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
                className="w-full bg-transparent py-2 outline-none"
              />
            </label>
            {canSell ? (
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                <ScanBarcode size={18} />
                สแกนบาร์โค้ด
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1"><button onClick={() => setCategoryId("")} className={`shrink-0 rounded-xl px-3 py-2 text-sm ${!categoryId ? "bg-primary text-primary-foreground" : "border border-border"}`}>ทั้งหมด</button>{categories.map((category) => <button key={category.id} onClick={() => setCategoryId(category.id)} className={`shrink-0 rounded-xl px-3 py-2 text-sm ${categoryId === category.id ? "bg-primary text-primary-foreground" : "border border-border"}`}>{category.name}</button>)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                disabled={!canSell}
                onClick={() => {
                  if (canSell) addProduct(product);
                }}
                className="rounded-2xl border border-border bg-background p-3 text-left transition hover:border-primary disabled:cursor-default disabled:opacity-70"
              >
                <div className="mb-2 aspect-square overflow-hidden rounded-xl bg-muted">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">
                      ไม่มีรูป
                    </div>
                  )}
                </div>
                <p className="line-clamp-2 font-medium">{product.name}</p>
                <p className="mt-2 text-sm text-primary">{baht(amount(product.sellPrice))}</p>
                <p className="text-xs text-muted-foreground">
                  คงเหลือ {amount(product.quantityOnHand)}
                </p>
              </button>
            ))}
          </div>
        </section>
        <aside className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">ตะกร้าสินค้า</h2>
            <PermissionGate permission="pos.hold">
              <button type="button" onClick={() => void loadHolds()} className="text-sm text-primary">
                เรียกบิลพัก
              </button>
            </PermissionGate>
          </div>
          <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">{cart.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีสินค้า</p> : cart.map((line) => <div key={line.product.id} className="border-b border-border pb-3"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{line.product.name}</p><button onClick={() => updateLine(line.product.id, { quantity: 0 })} aria-label="ลบสินค้า"><Trash2 size={16} className="text-destructive" /></button></div><div className="mt-2 flex items-center justify-between gap-2"><span className="flex items-center rounded-lg border border-border"><button onClick={() => updateLine(line.product.id, { quantity: line.quantity - 1 })} className="p-1"><Minus size={14} /></button><span className="min-w-8 text-center text-sm">{line.quantity}</span><button onClick={() => updateLine(line.product.id, { quantity: Math.min(line.quantity + 1, amount(line.product.quantityOnHand)) })} className="p-1"><Plus size={14} /></button></span>{canDiscount ? (
                    <label className="text-xs">
                      ลด{" "}
                      <input
                        inputMode="decimal"
                        value={line.discount}
                        onChange={(event) =>
                          updateLine(line.product.id, {
                            discount: amount(event.target.value),
                          })
                        }
                        className="ml-1 w-14 rounded border border-border px-1 py-1"
                      />
                    </label>
                  ) : null}<span className="text-sm">{baht(amount(line.product.sellPrice) * line.quantity - line.discount)}</span></div></div>)}</div>
          <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><span>รวม</span><span>{baht(subtotal)}</span></div>
            {canDiscount ? (
              <label className="flex items-center justify-between">
                ส่วนลดบิล{" "}
                <input
                  inputMode="decimal"
                  value={billDiscount}
                  onChange={(event) => setBillDiscount(event.target.value)}
                  className="w-24 rounded-lg border border-border px-2 py-1 text-right"
                />
              </label>
            ) : null}
            <div className="flex justify-between text-lg font-semibold"><span>สุทธิ</span><span>{baht(total)}</span></div>
          </div>
          <select
            value={method}
            onChange={(event) => {
              const next = event.target.value as typeof method;
              setMethod(next);
              setBooking(null);
              setPromptPayQr(null);
              if (next === "PROMPTPAY") void ensurePromptPayAccounts().catch((error) => {
                setMessage(error instanceof Error ? error.message : "โหลดบัญชีพร้อมเพย์ไม่สำเร็จ");
              });
            }}
            className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2"
          >
            {paymentMethods.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {method === "CASH" && (
            <>
              <input
                inputMode="decimal"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
                placeholder="เงินที่รับ"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2"
              />
              <p className="mt-1 text-sm text-muted-foreground">เงินทอน {baht(change)}</p>
            </>
          )}
          {method === "PROMPTPAY" && (
            <div className="mt-2 space-y-2">
              <select
                value={promptPayAccountId}
                onChange={(event) => {
                  setPromptPayAccountId(event.target.value);
                  setPromptPayQr(null);
                }}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {promptPayAccounts.length === 0 ? (
                  <option value="">กำลังโหลดบัญชี...</option>
                ) : (
                  promptPayAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName}
                      {account.isPrimary ? " (หลัก)" : ""} — {account.identifierMasked}
                    </option>
                  ))
                )}
              </select>
              <PermissionGate permission="pos.sell">
                <button
                  type="button"
                  disabled={busy || !cart.length || total <= 0}
                  onClick={() => void openPromptPayQr()}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50"
                >
                  แสดง QR Code
                </button>
              </PermissionGate>
            </div>
          )}
          {(method === "ROOM_CHARGE" || method === "TOUR_CHARGE") && (
            <button
              onClick={() => void chooseBooking()}
              className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm"
            >
              {booking
                ? `${booking.guest?.firstName ?? ""} ${booking.guest?.lastName ?? ""}`
                : "เลือกรายการเข้าพัก"}
            </button>
          )}
          <div className={`mt-4 grid gap-2 ${canHold && canSell ? "grid-cols-2" : "grid-cols-1"}`}>
            <PermissionGate permission="pos.hold">
              <button
                type="button"
                disabled={busy || !cart.length}
                onClick={() => void holdBill()}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50"
              >
                <PauseCircle className="mr-1 inline" size={16} />
                พักบิล
              </button>
            </PermissionGate>
            <PermissionGate permission="pos.sell">
              <button
                type="button"
                disabled={busy || !cart.length}
                onClick={() => void checkout()}
                className="w-full rounded-xl bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-50"
              >
                {method === "PROMPTPAY" ? "สร้าง QR / ชำระ" : "ชำระเงิน"}
              </button>
            </PermissionGate>
          </div>
          {!canSell ? (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              ไม่มีสิทธิ์ขาย — มองเห็นรายการสินค้าได้เท่านั้น
            </p>
          ) : null}
        </aside>
      </div>
      {showHolds && <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"><section className="w-full max-w-md rounded-3xl bg-surface p-5"><h2 className="font-semibold">บิลที่พักไว้</h2><div className="mt-3 space-y-2">{holds.map((hold) => <button key={hold.id} onClick={() => void resumeHold(hold)} className="w-full rounded-xl border border-border p-3 text-left">{hold.holdNumber} · {hold.items.length} รายการ</button>)}</div><button onClick={() => setShowHolds(false)} className="mt-4 text-sm">ปิด</button></section></div>}
      {showBookings && <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"><section className="w-full max-w-lg rounded-3xl bg-surface p-5"><h2 className="font-semibold">เลือกรายการเข้าพัก</h2><div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{bookings.map((item) => <button key={item.id} onClick={() => { setBooking(item); setShowBookings(false); }} className="w-full rounded-xl border border-border p-3 text-left">{item.guest?.firstName} {item.guest?.lastName} · ห้อง {item.rooms.map((room) => room.room.number).join(", ") || "-"} {item.tourGroup ? `· ${item.tourGroup.name}` : ""}</button>)}</div><button onClick={() => setShowBookings(false)} className="mt-4 text-sm">ปิด</button></section></div>}
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
              className="mx-auto h-64 w-64 rounded-xl border border-border bg-white p-2"
            />
            <p className="font-medium">{promptPayQr.accountName}</p>
            <p className="text-sm text-muted-foreground">{promptPayQr.identifierMasked}</p>
            <p className="text-3xl font-semibold text-foreground">
              {baht(promptPayQr.amount)}
            </p>
            <p className="text-xs text-amber-700">
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
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
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
