"use client";

import { Camera, Download, Eye, ImagePlus, QrCode, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import Modal from "@/components/ui/Modal";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type { PromptPayAccountRecord } from "@/lib/settings/promptpay-account-shared";
import type { PaymentListItem } from "@/lib/payments/promptpay-workflow";

type Summary = {
  grandTotal: number;
  paidTotal: number;
  pendingTotal: number;
  refundedTotal: number;
  netPaidTotal: number;
  outstandingTotal: number;
};

type QrPayload = {
  dataUrl: string;
  amount: number;
  accountName: string | null;
  identifierMasked: string | null;
  paymentNumber?: string | null;
};

const purposeOptions = [
  { value: "DEPOSIT", label: "มัดจำ" },
  { value: "PARTIAL", label: "ชำระบางส่วน" },
  { value: "FULL", label: "ชำระเต็มจำนวน" },
] as const;

function statusLabel(status: string) {
  switch (status) {
    case "AWAITING_PAYMENT":
      return "รอชำระ";
    case "PENDING_VERIFICATION":
      return "รอตรวจสอบ";
    case "VERIFIED":
    case "PAID":
      return "ยืนยันแล้ว";
    case "REJECTED":
      return "ปฏิเสธ";
    case "CANCELLED":
      return "ยกเลิก";
    case "REFUNDED":
      return "คืนเงินแล้ว";
    case "PARTIALLY_REFUNDED":
      return "คืนบางส่วน";
    default:
      return status;
  }
}

export function BookingPromptPaySection({
  bookingId,
  bookingReference,
  outstanding,
  onChanged,
}: {
  bookingId: string;
  bookingReference: string;
  outstanding: number;
  onChanged: () => void;
}) {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [accounts, setAccounts] = useState<PromptPayAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [purpose, setPurpose] = useState<(typeof purposeOptions)[number]["value"]>("PARTIAL");
  const [amount, setAmount] = useState(outstanding);
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [activePaymentStatus, setActivePaymentStatus] = useState<string | null>(
    null,
  );
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const canSubmitActive =
    activePaymentStatus === "AWAITING_PAYMENT" && Boolean(activePaymentId);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [payRes, accRes] = await Promise.all([
        fetch(`/api/bookings/${bookingId}/promptpay-payments`, {
          cache: "no-store",
        }),
        fetch("/api/promptpay-accounts", { cache: "no-store" }),
      ]);
      const payBody = (await payRes.json()) as {
        summary?: Summary;
        payments?: PaymentListItem[];
        message?: string;
      };
      const accBody = (await accRes.json()) as
        | PromptPayAccountRecord[]
        | { message?: string };
      if (!payRes.ok) throw new Error(payBody.message ?? "โหลดการชำระไม่สำเร็จ");
      setSummary(payBody.summary ?? null);
      setPayments(payBody.payments ?? []);
      if (accRes.ok && Array.isArray(accBody)) {
        setAccounts(accBody);
        setAccountId((current) => current || accBody.find((a) => a.isPrimary)?.id || accBody[0]?.id || "");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setAmount(outstanding);
  }, [outstanding]);

  useEffect(() => {
    if (!slipFile || !slipFile.type.startsWith("image/")) {
      setSlipPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(slipFile);
    setSlipPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [slipFile]);

  const pickSlipFile = (file: File | null | undefined) => {
    setSlipFile(file ?? null);
  };

  const createPayment = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/bookings/${bookingId}/promptpay-payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promptpayAccountId: accountId,
            purpose,
            amount,
          }),
        },
      );
      const body = (await response.json()) as {
        message?: string;
        payment?: PaymentListItem;
        qr?: QrPayload;
      };
      if (!response.ok) throw new Error(body.message ?? "สร้างรายการไม่สำเร็จ");
      setActivePaymentId(body.payment?.id ?? null);
      setActivePaymentStatus(body.payment?.status ?? "AWAITING_PAYMENT");
      setSlipFile(null);
      setQr(body.qr ?? null);
      setCreateOpen(false);
      await load();
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "สร้างรายการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const submitForVerification = async () => {
    if (!activePaymentId) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      if (slipFile) form.set("file", slipFile);
      const response = await fetch(
        `/api/bookings/${bookingId}/promptpay-payments/${activePaymentId}/submit`,
        { method: "POST", body: form },
      );
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "ส่งตรวจสอบไม่สำเร็จ");
      setSlipFile(null);
      setQr(null);
      setActivePaymentId(null);
      setActivePaymentStatus(null);
      await load();
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ส่งตรวจสอบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const openSlip = async (paymentId: string) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/bookings/${bookingId}/promptpay-payments/${paymentId}/slip`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as {
        signedUrl?: string;
        message?: string;
      };
      if (!response.ok || !body.signedUrl) {
        throw new Error(body.message ?? "เปิดสลิปไม่สำเร็จ");
      }
      window.open(body.signedUrl, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เปิดสลิปไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const act = async (
    paymentId: string,
    action: "verify" | "reject" | "cancel",
  ) => {
    const ok = await confirm({
      title:
        action === "verify"
          ? "ยืนยันว่าได้รับเงินแล้ว?"
          : action === "reject"
            ? "ปฏิเสธรายการนี้?"
            : "ยกเลิกรายการนี้?",
      description:
        action === "reject"
          ? "สถานะจะเป็น REJECTED และไม่นับเป็นยอดรับเงิน"
          : undefined,
      confirmLabel:
        action === "verify"
          ? "ยืนยัน"
          : action === "reject"
            ? "ปฏิเสธ"
            : "ยกเลิกบิล",
      tone: action === "verify" ? "warning" : "danger",
    });
    if (!ok) return;
    const noteValue = action === "reject" ? "ปฏิเสธโดยเจ้าหน้าที่" : "";
    setSaving(true);
    try {
      const response = await fetch(
        `/api/bookings/${bookingId}/promptpay-payments/${paymentId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: noteValue }),
        },
      );
      const body = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(body.message ?? "ดำเนินการไม่สำเร็จ");
      await load();
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const openQr = async (paymentId: string) => {
    setSaving(true);
    try {
      const response = await fetch(
        `/api/bookings/${bookingId}/promptpay-payments/${paymentId}/qr`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as QrPayload & { message?: string };
      if (!response.ok) throw new Error(body.message ?? "โหลด QR ไม่สำเร็จ");
      const current = payments.find((item) => item.id === paymentId);
      setActivePaymentId(paymentId);
      setActivePaymentStatus(current?.status ?? null);
      setSlipFile(null);
      setQr(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "โหลด QR ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const downloadQr = () => {
    if (!qr?.dataUrl) return;
    const link = document.createElement("a");
    link.href = qr.dataUrl;
    link.download = `promptpay-${bookingReference}.png`;
    link.click();
  };

  const printQr = () => {
    if (!qr?.dataUrl) return;
    const popup = window.open("", "_blank", "noopener,noreferrer,width=480,height=720");
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>PromptPay QR</title>
      <style>body{font-family:sans-serif;text-align:center;padding:24px}img{width:280px;height:280px}</style>
      </head><body>
      <h1>ชำระค่าที่พัก</h1>
      <p>${bookingReference}</p>
      <img src="${qr.dataUrl}" alt="PromptPay QR" />
      <p>${qr.accountName ?? ""}</p>
      <p>${qr.identifierMasked ?? ""}</p>
      <p style="font-size:28px;font-weight:700">฿${qr.amount.toLocaleString()}</p>
      <p>โปรดตรวจชื่อผู้รับในแอปธนาคารก่อนยืนยัน</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    popup.document.close();
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      {confirmDialog}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-foreground">การชำระเงิน PromptPay</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            สร้าง QR ตามยอดคงเหลือ — นับเป็นชำระแล้วเมื่อยืนยันเท่านั้น
          </p>
        </div>
        <button
          type="button"
          disabled={outstanding <= 0}
          onClick={() => {
            setAmount(outstanding);
            setPurpose(outstanding > 0 ? "PARTIAL" : "FULL");
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <QrCode size={16} />
          รับชำระเงิน
        </button>
      </div>

      {summary ? (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>ยอดรวม: ฿{summary.grandTotal.toLocaleString()}</p>
          <p>ยืนยันแล้ว: ฿{summary.netPaidTotal.toLocaleString()}</p>
          <p>รอตรวจสอบ: ฿{summary.pendingTotal.toLocaleString()}</p>
          <p>คงเหลือ: ฿{summary.outstandingTotal.toLocaleString()}</p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="rounded-xl border border-border bg-background px-3 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    ฿{payment.amount.toLocaleString()} · {statusLabel(payment.status)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {payment.paymentNumber ?? payment.id.slice(0, 8)} ·{" "}
                    {payment.promptpayIdentifierMasked ?? payment.method}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["AWAITING_PAYMENT", "PENDING_VERIFICATION"].includes(
                    payment.status,
                  ) ? (
                    <button
                      type="button"
                      className="rounded-lg border border-border px-2 py-1 text-xs"
                      onClick={() => void openQr(payment.id)}
                    >
                      ดู QR
                    </button>
                  ) : null}
                  {payment.hasSlip ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs"
                      onClick={() => void openSlip(payment.id)}
                    >
                      <Eye size={12} />
                      ดูสลิป
                    </button>
                  ) : null}
                  {payment.status === "PENDING_VERIFICATION" ? (
                    <>
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-xs"
                        onClick={() => void act(payment.id, "verify")}
                      >
                        ยืนยัน
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-border px-2 py-1 text-xs"
                        onClick={() => void act(payment.id, "reject")}
                      >
                        ปฏิเสธ
                      </button>
                    </>
                  ) : null}
                  {["AWAITING_PAYMENT", "PENDING_VERIFICATION"].includes(
                    payment.status,
                  ) ? (
                    <button
                      type="button"
                      className="rounded-lg border border-border px-2 py-1 text-xs"
                      onClick={() => void act(payment.id, "cancel")}
                    >
                      ยกเลิก
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
          {payments.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground">
              ยังไม่มีรายการ PromptPay
            </li>
          ) : null}
        </ul>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="รับชำระเงิน PromptPay"
      >
        <div className="space-y-3">
          <label className="block text-sm">
            บัญชีพร้อมเพย์
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName}
                  {account.isPrimary ? " (หลัก)" : ""} — {account.identifierMasked}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            ประเภท
            <select
              value={purpose}
              onChange={(e) => {
                const next = e.target.value as typeof purpose;
                setPurpose(next);
                if (next === "FULL") setAmount(outstanding);
              }}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
            >
              {purposeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            จำนวนเงิน
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            ยอดคงเหลือ ฿{outstanding.toLocaleString()}
          </p>
          <button
            type="button"
            disabled={saving || !accountId || amount <= 0}
            onClick={() => void createPayment()}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            สร้าง QR Code
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(qr)}
        onClose={() => {
          setQr(null);
          setActivePaymentId(null);
          setActivePaymentStatus(null);
          setSlipFile(null);
        }}
        title="ชำระค่าที่พัก"
      >
        {qr ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">{bookingReference}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.dataUrl}
              alt="PromptPay QR"
              className="mx-auto h-64 w-64 rounded-xl border border-border bg-white p-2"
            />
            <p className="font-medium">{qr.accountName}</p>
            <p className="text-sm text-muted-foreground">{qr.identifierMasked}</p>
            <p className="text-3xl font-semibold text-foreground">
              ฿{qr.amount.toLocaleString()}
            </p>
            <p className="text-xs text-amber-700">
              โปรดตรวจชื่อผู้รับในแอปธนาคารก่อนยืนยันโอนเงิน
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={downloadQr}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm"
              >
                <Download size={16} />
                ดาวน์โหลด
              </button>
              <button
                type="button"
                onClick={printQr}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                พิมพ์
              </button>
            </div>

            {canSubmitActive ? (
              <>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    pickSlipFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    pickSlipFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />

                <div className="rounded-xl border border-border bg-background p-3 text-left">
                  <p className="text-sm font-medium text-foreground">สลิปการโอน</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    แนบสลิปได้ถ้ามี หรือกดส่งตรวจสอบได้เลยโดยไม่ต้องแนบ
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <ImagePlus size={16} />
                      แนบสลิป
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <Camera size={16} />
                      ถ่ายรูป
                    </button>
                  </div>
                  {slipFile ? (
                    <div className="mt-3 space-y-2">
                      {slipPreviewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={slipPreviewUrl}
                          alt="ตัวอย่างสลิป"
                          className="max-h-40 w-full rounded-lg border border-border object-contain bg-white"
                        />
                      ) : null}
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">
                          {slipFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSlipFile(null)}
                          className="shrink-0 text-destructive"
                        >
                          ลบ
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={saving || !activePaymentId}
                  onClick={() => void submitForVerification()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  <Upload size={16} />
                  ส่งตรวจสอบ
                </button>
              </>
            ) : activePaymentStatus === "PENDING_VERIFICATION" ? (
              <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                ส่งตรวจสอบแล้ว — รอเจ้าหน้าที่ยืนยัน
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
