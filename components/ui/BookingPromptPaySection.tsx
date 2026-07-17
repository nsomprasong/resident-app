"use client";

import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  ImagePlus,
  QrCode,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PermissionGate } from "@/components/auth/PermissionGate";
import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import Modal from "@/components/ui/Modal";
import NumberInput from "@/components/ui/NumberInput";
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

type RecipientDraft = {
  accountId: string;
  amount: number;
};

type CreatedQrItem = {
  paymentId: string;
  status: string;
  qr: QrPayload;
  hasSlip: boolean;
};

type SlipViewer = {
  url: string;
  fileName: string | null;
  contentType: string | null;
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
  const { can, canAny } = useEmployeePermissions();
  const canVerify = can("payment.verify");
  const canCancelPayment = canAny(["payment.cancel", "payment.collect"]);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<PaymentListItem[]>([]);
  const [accounts, setAccounts] = useState<PromptPayAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [recipients, setRecipients] = useState<RecipientDraft[]>([]);
  const [purpose, setPurpose] = useState<(typeof purposeOptions)[number]["value"]>("PARTIAL");
  const [saving, setSaving] = useState(false);
  const [createdQrs, setCreatedQrs] = useState<CreatedQrItem[]>([]);
  const [qrIndex, setQrIndex] = useState(0);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
  const [slipViewer, setSlipViewer] = useState<SlipViewer | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const activeQr = createdQrs[qrIndex] ?? null;
  const activePaymentId = activeQr?.paymentId ?? null;
  const activePaymentStatus = activeQr?.status ?? null;
  const qr = activeQr?.qr ?? null;
  const activeHasSlip = Boolean(activeQr?.hasSlip);
  const canSubmitActive =
    activePaymentStatus === "AWAITING_PAYMENT" && Boolean(activePaymentId);
  const canViewSlip = canAny([
    "payment.view",
    "payment.verify",
    "payment.read",
    "payment.collect",
    "payment.create",
    "payment.submit",
  ]);

  const selectedTotal = useMemo(
    () =>
      recipients.reduce(
        (sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0),
        0,
      ),
    [recipients],
  );

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

  const openCreateModal = () => {
    const primary =
      accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
    setRecipients(
      primary
        ? [{ accountId: primary.id, amount: Math.max(0, outstanding) }]
        : [],
    );
    setPurpose(outstanding > 0 ? "PARTIAL" : "FULL");
    setError("");
    setCreateOpen(true);
  };

  const toggleRecipient = (accountId: string) => {
    setRecipients((current) => {
      if (current.some((item) => item.accountId === accountId)) {
        return current.filter((item) => item.accountId !== accountId);
      }
      const used = current.reduce((sum, item) => sum + item.amount, 0);
      const remaining = Math.max(
        0,
        Math.round((outstanding - used) * 100) / 100,
      );
      return [...current, { accountId, amount: remaining }];
    });
  };

  const setRecipientAmount = (accountId: string, amount: number) => {
    setRecipients((current) =>
      current.map((item) =>
        item.accountId === accountId ? { ...item, amount } : item,
      ),
    );
  };

  const splitEvenly = () => {
    if (!recipients.length || outstanding <= 0) return;
    const cents = Math.round(outstanding * 100);
    const base = Math.floor(cents / recipients.length);
    const remainder = cents - base * recipients.length;
    setRecipients(
      recipients.map((item, index) => ({
        ...item,
        amount: (base + (index < remainder ? 1 : 0)) / 100,
      })),
    );
    if (recipients.length > 1) setPurpose("PARTIAL");
  };

  const createPayment = async () => {
    const lines = recipients.filter((item) => item.amount > 0);
    if (!lines.length) {
      setError("กรุณาเลือกผู้รับและระบุจำนวนเงิน");
      return;
    }
    if (selectedTotal > outstanding + 0.001) {
      setError("ยอดรวมของผู้รับต้องไม่เกินยอดคงเหลือ");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const created: CreatedQrItem[] = [];
      for (const line of lines) {
        const linePurpose =
          lines.length === 1 &&
          purpose === "FULL" &&
          Math.abs(line.amount - outstanding) < 0.001
            ? "FULL"
            : purpose === "FULL"
              ? "PARTIAL"
              : purpose;
        const response = await fetch(
          `/api/bookings/${bookingId}/promptpay-payments`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              promptpayAccountId: line.accountId,
              purpose: linePurpose,
              amount: line.amount,
            }),
          },
        );
        const body = (await response.json()) as {
          message?: string;
          payment?: PaymentListItem;
          qr?: QrPayload;
        };
        if (!response.ok) {
          throw new Error(body.message ?? "สร้างรายการไม่สำเร็จ");
        }
        if (body.payment && body.qr) {
          created.push({
            paymentId: body.payment.id,
            status: body.payment.status,
            qr: body.qr,
            hasSlip: Boolean(body.payment.hasSlip),
          });
        }
      }
      if (!created.length) {
        throw new Error("สร้างรายการไม่สำเร็จ");
      }
      setCreatedQrs(created);
      setQrIndex(0);
      setSlipFile(null);
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
      setCreatedQrs((current) => {
        const updated = current.map((item, index) =>
          index === qrIndex
            ? { ...item, status: "PENDING_VERIFICATION" }
            : item,
        );
        const remaining = updated.filter(
          (item) => item.status === "AWAITING_PAYMENT",
        );
        return remaining;
      });
      setQrIndex(0);
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
        fileName?: string | null;
        contentType?: string | null;
        message?: string;
      };
      if (!response.ok || !body.signedUrl) {
        throw new Error(body.message ?? "เปิดสลิปไม่สำเร็จ");
      }
      setSlipViewer({
        url: body.signedUrl,
        fileName: body.fileName ?? null,
        contentType: body.contentType ?? null,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เปิดสลิปไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const act = async (
    paymentId: string,
    action: "verify" | "unverify" | "reject" | "cancel",
  ) => {
    const ok = await confirm({
      title:
        action === "verify"
          ? "ยืนยันว่าได้รับเงินแล้ว?"
          : action === "unverify"
            ? "แก้กลับการยืนยัน?"
            : action === "reject"
              ? "ปฏิเสธรายการนี้?"
              : "ยกเลิกรายการนี้?",
      description:
        action === "unverify"
          ? "รายการจะกลับไปรอตรวจสอบ และไม่นับเป็นยอดรับเงิน จนกว่าจะยืนยันใหม่"
          : action === "reject"
            ? "สถานะจะเป็น REJECTED และไม่นับเป็นยอดรับเงิน"
            : undefined,
      confirmLabel:
        action === "verify"
          ? "ยืนยัน"
          : action === "unverify"
            ? "แก้กลับ"
            : action === "reject"
              ? "ปฏิเสธ"
              : "ยกเลิกบิล",
      tone: action === "verify" ? "warning" : "danger",
    });
    if (!ok) return;
    const noteValue =
      action === "reject"
        ? "ปฏิเสธโดยเจ้าหน้าที่"
        : action === "unverify"
          ? "ยกเลิกการยืนยันโดยเจ้าหน้าที่"
          : "";
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
      setCreatedQrs([
        {
          paymentId,
          status: current?.status ?? "AWAITING_PAYMENT",
          qr: body,
          hasSlip: Boolean(current?.hasSlip),
        },
      ]);
      setQrIndex(0);
      setSlipFile(null);
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
        <PermissionGate anyOf={["payment.create", "payment.collect"]}>
          <button
            type="button"
            disabled={outstanding <= 0 || accounts.length === 0}
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <QrCode size={16} />
            รับชำระเงิน
          </button>
        </PermissionGate>
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
                    {payment.promptpayAccountNameSnapshot
                      ? `${payment.promptpayAccountNameSnapshot} · `
                      : ""}
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
                  {payment.hasSlip && canViewSlip ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary"
                      onClick={() => void openSlip(payment.id)}
                    >
                      <Eye size={12} />
                      ดูสลิป
                    </button>
                  ) : null}
                  {payment.status === "PENDING_VERIFICATION" && canVerify ? (
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
                  {payment.status === "VERIFIED" && canVerify ? (
                    <button
                      type="button"
                      className="rounded-lg border border-border px-2 py-1 text-xs text-amber-800"
                      onClick={() => void act(payment.id, "unverify")}
                    >
                      แก้กลับ
                    </button>
                  ) : null}
                  {["AWAITING_PAYMENT", "PENDING_VERIFICATION"].includes(
                    payment.status,
                  ) && canCancelPayment ? (
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
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                เลือกผู้รับเงิน
              </p>
              {recipients.length > 1 ? (
                <button
                  type="button"
                  onClick={splitEvenly}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  แบ่งเท่ากัน
                </button>
              ) : null}
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              เลือกได้มากกว่า 1 คน — ระบบจะสร้าง QR แยกตามผู้รับ
            </p>
            {accounts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                ยังไม่มีบัญชีพร้อมเพย์ที่เปิดใช้ — เพิ่มใน Settings ก่อน
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => {
                  const selected = recipients.find(
                    (item) => item.accountId === account.id,
                  );
                  return (
                    <div
                      key={account.id}
                      className={`rounded-xl border px-3 py-2.5 transition-colors ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleRecipient(account.id)}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-surface"
                          }`}
                        >
                          {selected ? <Check size={12} strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {account.displayName}
                            {account.isPrimary ? " (หลัก)" : ""}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {account.accountName} · {account.identifierMasked}
                          </span>
                        </span>
                      </button>
                      {selected ? (
                        <label className="mt-2 block pl-7 text-xs text-muted-foreground">
                          จำนวนเงิน
                          <NumberInput
                            min={0}
                            step={0.01}
                            emptyValue={0}
                            value={selected.amount}
                            onChange={(amount) =>
                              setRecipientAmount(account.id, amount)
                            }
                            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <label className="block text-sm">
            ประเภท
            <select
              value={purpose}
              onChange={(e) => {
                const next = e.target.value as typeof purpose;
                if (next === "FULL" && recipients.length > 1) {
                  setPurpose("PARTIAL");
                  return;
                }
                setPurpose(next);
                if (next === "FULL" && recipients.length === 1) {
                  setRecipientAmount(recipients[0]!.accountId, outstanding);
                }
              }}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
            >
              {purposeOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.value === "FULL" && recipients.length > 1}
                >
                  {option.label}
                  {option.value === "FULL" && recipients.length > 1
                    ? " (ใช้ได้เมื่อเลือก 1 คน)"
                    : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              เลือก {recipients.length} คน · คงเหลือ ฿
              {outstanding.toLocaleString()}
            </span>
            <span
              className={`font-medium tabular-nums ${
                selectedTotal > outstanding + 0.001
                  ? "text-destructive"
                  : "text-foreground"
              }`}
            >
              รวม ฿{selectedTotal.toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            disabled={
              saving ||
              recipients.length === 0 ||
              selectedTotal <= 0 ||
              selectedTotal > outstanding + 0.001
            }
            onClick={() => void createPayment()}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {recipients.length > 1
              ? `สร้าง QR ${recipients.filter((item) => item.amount > 0).length} รายการ`
              : "สร้าง QR Code"}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(qr)}
        onClose={() => {
          setCreatedQrs([]);
          setQrIndex(0);
          setSlipFile(null);
        }}
        title="ชำระค่าที่พัก"
      >
        {qr ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">{bookingReference}</p>
            {createdQrs.length > 1 ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-2 py-1.5">
                <button
                  type="button"
                  disabled={qrIndex <= 0}
                  onClick={() => {
                    setQrIndex((index) => Math.max(0, index - 1));
                    setSlipFile(null);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface disabled:opacity-30"
                  aria-label="QR ก่อนหน้า"
                >
                  <ChevronLeft size={18} />
                </button>
                <p className="text-xs font-medium text-foreground">
                  ผู้รับ {qrIndex + 1} / {createdQrs.length}
                </p>
                <button
                  type="button"
                  disabled={qrIndex >= createdQrs.length - 1}
                  onClick={() => {
                    setQrIndex((index) =>
                      Math.min(createdQrs.length - 1, index + 1),
                    );
                    setSlipFile(null);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface disabled:opacity-30"
                  aria-label="QR ถัดไป"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            ) : null}
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
            ) : activePaymentStatus === "PENDING_VERIFICATION" ||
              activePaymentStatus === "VERIFIED" ? (
              <div className="space-y-2">
                <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {activePaymentStatus === "VERIFIED"
                    ? "ยืนยันรับเงินแล้ว"
                    : "ส่งตรวจสอบแล้ว — รอเจ้าหน้าที่ยืนยัน"}
                </p>
                {activeHasSlip && canViewSlip && activePaymentId ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void openSlip(activePaymentId)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary disabled:opacity-50"
                  >
                    <Eye size={16} />
                    ดูสลิปที่แนบ
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(slipViewer)}
        onClose={() => setSlipViewer(null)}
        title="สลิปที่แนบ"
      >
        {slipViewer ? (
          <div className="space-y-3">
            {slipViewer.contentType?.startsWith("image/") ||
            !slipViewer.contentType ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slipViewer.url}
                alt={slipViewer.fileName ?? "สลิปการโอน"}
                className="max-h-[70vh] w-full rounded-xl border border-border bg-white object-contain"
              />
            ) : (
              <iframe
                src={slipViewer.url}
                title={slipViewer.fileName ?? "สลิปการโอน"}
                className="h-[70vh] w-full rounded-xl border border-border bg-white"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={slipViewer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground"
              >
                <Eye size={16} />
                เปิดแท็บใหม่
              </a>
              <button
                type="button"
                onClick={() => setSlipViewer(null)}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
              >
                ปิด
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
