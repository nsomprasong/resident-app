import {
  PaymentStatus,
  type PaymentStatus as PaymentStatusEnum,
} from "@/generated/prisma/client";
import {
  apiErrorResponse,
  readJsonObject,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { acquireBookingFinancialLock } from "@/lib/payments/financial-locks";
import {
  assertPaymentTransition,
  recordPaymentStatusHistory,
  serializePaymentListItem,
} from "@/lib/payments/promptpay-workflow";
import {
  PAYMENT_SLIP_ALLOWED_TYPES,
  PAYMENT_SLIP_MAX_BYTES,
  PAYMENT_SLIPS_BUCKET,
  uploadPaymentSlipObject,
  createPaymentSlipSignedUrl,
} from "@/lib/payments/slip-storage";
import { buildPromptPayQrDataUrl } from "@/lib/payments/promptpay-qr";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const paymentSelect = {
  id: true,
  paymentNumber: true,
  amount: true,
  currency: true,
  method: true,
  purpose: true,
  status: true,
  reference: true,
  note: true,
  paidAt: true,
  submittedAt: true,
  verifiedAt: true,
  promptpayAccountNameSnapshot: true,
  promptpayIdentifierMasked: true,
  slipStoragePath: true,
  createdAt: true,
} as const;

type Ids = { bookingId: string; paymentId: string };

async function loadOwnedPayment(ids: Ids) {
  return prisma.payment.findFirst({
    where: { id: ids.paymentId, bookingId: ids.bookingId },
    include: { promptpayAccount: true },
  });
}

export async function submitPromptPayPayment(
  request: NextRequest,
  ids: Ids,
) {
  try {
    const currentUser = await getCurrentUser();
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      form = new FormData();
    }
    const fileValue = form.get("file");
    const noteRaw = form.get("note");
    const note = typeof noteRaw === "string" ? noteRaw.trim() : "";
    const file =
      fileValue instanceof File && fileValue.size > 0 ? fileValue : null;

    let objectPath: string | null = null;
    let slipMeta:
      | {
          slipStorageBucket: string;
          slipStoragePath: string;
          slipFileName: string;
          slipContentType: string;
          slipSizeBytes: number;
        }
      | undefined;

    if (file) {
      if (
        !PAYMENT_SLIP_ALLOWED_TYPES.includes(
          file.type as (typeof PAYMENT_SLIP_ALLOWED_TYPES)[number],
        )
      ) {
        return apiErrorResponse("ชนิดไฟล์ไม่รองรับ", 400, "INVALID_FILE_TYPE");
      }
      if (file.size > PAYMENT_SLIP_MAX_BYTES) {
        return apiErrorResponse("ขนาดไฟล์ไม่ถูกต้อง", 400, "INVALID_FILE_SIZE");
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      objectPath = `${ids.bookingId}/${ids.paymentId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      await uploadPaymentSlipObject({
        objectPath,
        bytes,
        contentType: file.type,
      });
      slipMeta = {
        slipStorageBucket: PAYMENT_SLIPS_BUCKET,
        slipStoragePath: objectPath,
        slipFileName: file.name,
        slipContentType: file.type,
        slipSizeBytes: file.size,
      };
    }

    const payment = await prisma.$transaction(async (tx) => {
      await acquireBookingFinancialLock(tx, ids.bookingId);
      const existing = await tx.payment.findFirst({
        where: { id: ids.paymentId, bookingId: ids.bookingId },
      });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status === PaymentStatus.PENDING_VERIFICATION) {
        throw new Error("ALREADY_SUBMITTED");
      }
      assertPaymentTransition(
        existing.status,
        PaymentStatus.PENDING_VERIFICATION,
      );

      const updated = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: PaymentStatus.PENDING_VERIFICATION,
          submittedAt: new Date(),
          note: note || existing.note,
          ...slipMeta,
        },
        select: paymentSelect,
      });

      await recordPaymentStatusHistory(tx, {
        paymentId: existing.id,
        fromStatus: existing.status,
        toStatus: PaymentStatus.PENDING_VERIFICATION,
        note: note || null,
        actorId: currentUser?.employee?.id,
      });

      return updated;
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PROMPTPAY_PAYMENT_SUBMITTED",
      entityType: "PAYMENT",
      entityId: payment.id,
      metadata: {
        bookingId: ids.bookingId,
        slipPath: objectPath,
        hasSlip: Boolean(objectPath),
      },
    });

    return NextResponse.json({ payment: serializePaymentListItem(payment) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return apiErrorResponse("ไม่พบรายการชำระเงิน", 404, "NOT_FOUND");
      }
      if (error.message === "INVALID_STATUS_TRANSITION") {
        return apiErrorResponse("สถานะไม่อนุญาตให้ส่งตรวจสอบ", 409, "INVALID_TRANSITION");
      }
      if (error.message === "ALREADY_SUBMITTED") {
        return apiErrorResponse("ส่งตรวจสอบแล้ว", 409, "ALREADY_SUBMITTED");
      }
    }
    console.error("submitPromptPayPayment failed", error);
    return apiErrorResponse("ส่งตรวจสอบไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

async function transitionPayment(
  ids: Ids,
  toStatus: PaymentStatusEnum,
  options: {
    auditAction: string;
    note?: string | null;
    requireNote?: boolean;
    extraData?: Record<string, unknown>;
  },
) {
  try {
    const currentUser = await getCurrentUser();
    if (options.requireNote && !options.note?.trim()) {
      return apiErrorResponse("กรุณาระบุเหตุผล", 400, "NOTE_REQUIRED");
    }

    const payment = await prisma.$transaction(async (tx) => {
      await acquireBookingFinancialLock(tx, ids.bookingId);
      const existing = await tx.payment.findFirst({
        where: { id: ids.paymentId, bookingId: ids.bookingId },
      });
      if (!existing) throw new Error("NOT_FOUND");
      assertPaymentTransition(existing.status, toStatus);

      const updated = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: toStatus,
          note: options.note?.trim() || existing.note,
          ...(toStatus === PaymentStatus.VERIFIED
            ? {
                verifiedAt: new Date(),
                verifiedById: currentUser?.employee?.id,
                paidAt: new Date(),
              }
            : {}),
          ...(toStatus === PaymentStatus.CANCELLED
            ? {
                cancelledAt: new Date(),
                cancelReason: options.note?.trim() || null,
              }
            : {}),
          ...(options.extraData ?? {}),
        },
        select: paymentSelect,
      });

      await recordPaymentStatusHistory(tx, {
        paymentId: existing.id,
        fromStatus: existing.status,
        toStatus,
        note: options.note ?? null,
        actorId: currentUser?.employee?.id,
      });

      return updated;
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: options.auditAction,
      entityType: "PAYMENT",
      entityId: payment.id,
      metadata: { bookingId: ids.bookingId, toStatus, note: options.note },
    });

    return NextResponse.json({ payment: serializePaymentListItem(payment) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return apiErrorResponse("ไม่พบรายการชำระเงิน", 404, "NOT_FOUND");
      }
      if (error.message === "INVALID_STATUS_TRANSITION") {
        return apiErrorResponse("เปลี่ยนสถานะไม่ได้", 409, "INVALID_TRANSITION");
      }
    }
    console.error(options.auditAction, error);
    return apiErrorResponse("ดำเนินการไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

export async function verifyPromptPayPayment(request: NextRequest, ids: Ids) {
  const parsed = await readJsonObject(request);
  const note =
    parsed.ok && typeof parsed.body.note === "string"
      ? parsed.body.note
      : null;
  return transitionPayment(ids, PaymentStatus.VERIFIED, {
    auditAction: "PROMPTPAY_PAYMENT_VERIFIED",
    note,
  });
}

export async function rejectPromptPayPayment(request: NextRequest, ids: Ids) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const note =
    typeof parsed.body.note === "string" ? parsed.body.note.trim() : "";
  return transitionPayment(ids, PaymentStatus.REJECTED, {
    auditAction: "PROMPTPAY_PAYMENT_REJECTED",
    note,
    requireNote: true,
  });
}

/** Undo a mistaken verify — back to pending review (not counted as paid). */
export async function unverifyPromptPayPayment(request: NextRequest, ids: Ids) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    const note =
      parsed.ok && typeof parsed.body.note === "string"
        ? parsed.body.note.trim()
        : "";

    const payment = await prisma.$transaction(async (tx) => {
      await acquireBookingFinancialLock(tx, ids.bookingId);
      const existing = await tx.payment.findFirst({
        where: { id: ids.paymentId, bookingId: ids.bookingId },
        include: { refunds: { select: { id: true } } },
      });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status !== PaymentStatus.VERIFIED) {
        throw new Error("INVALID_STATUS_TRANSITION");
      }
      if (existing.refunds.length > 0) {
        throw new Error("HAS_REFUNDS");
      }
      assertPaymentTransition(
        existing.status,
        PaymentStatus.PENDING_VERIFICATION,
      );

      const updated = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: PaymentStatus.PENDING_VERIFICATION,
          verifiedAt: null,
          verifiedById: null,
          paidAt: null,
          note: note || existing.note,
        },
        select: paymentSelect,
      });

      await recordPaymentStatusHistory(tx, {
        paymentId: existing.id,
        fromStatus: existing.status,
        toStatus: PaymentStatus.PENDING_VERIFICATION,
        note: note || "ยกเลิกการยืนยัน",
        actorId: currentUser?.employee?.id,
      });

      return updated;
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PROMPTPAY_PAYMENT_UNVERIFIED",
      entityType: "PAYMENT",
      entityId: payment.id,
      metadata: { bookingId: ids.bookingId, note: note || null },
    });

    return NextResponse.json({ payment: serializePaymentListItem(payment) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return apiErrorResponse("ไม่พบรายการชำระเงิน", 404, "NOT_FOUND");
      }
      if (error.message === "INVALID_STATUS_TRANSITION") {
        return apiErrorResponse(
          "รายการนี้ยังไม่ได้ยืนยัน หรือแก้กลับไม่ได้",
          409,
          "INVALID_TRANSITION",
        );
      }
      if (error.message === "HAS_REFUNDS") {
        return apiErrorResponse(
          "มีการคืนเงินแล้ว แก้กลับการยืนยันไม่ได้",
          409,
          "HAS_REFUNDS",
        );
      }
    }
    console.error("unverifyPromptPayPayment failed", error);
    return apiErrorResponse("แก้กลับการยืนยันไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

export async function cancelPromptPayPayment(request: NextRequest, ids: Ids) {
  const parsed = await readJsonObject(request);
  const note =
    parsed.ok && typeof parsed.body.note === "string"
      ? parsed.body.note
      : null;
  return transitionPayment(ids, PaymentStatus.CANCELLED, {
    auditAction: "PROMPTPAY_PAYMENT_CANCELLED",
    note,
  });
}

export async function refundPromptPayPayment(request: NextRequest, ids: Ids) {
  try {
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const amount = Number(parsed.body.amount);
    const reason =
      typeof parsed.body.reason === "string" ? parsed.body.reason.trim() : "";
    if (!Number.isFinite(amount) || amount <= 0) {
      return apiErrorResponse("ยอดคืนต้องมากกว่า 0", 400, "INVALID_AMOUNT");
    }

    const result = await prisma.$transaction(async (tx) => {
      await acquireBookingFinancialLock(tx, ids.bookingId);
      const existing = await tx.payment.findFirst({
        where: { id: ids.paymentId, bookingId: ids.bookingId },
        include: { refunds: true },
      });
      if (!existing) throw new Error("NOT_FOUND");
      if (
        existing.status !== PaymentStatus.VERIFIED &&
        existing.status !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new Error("INVALID_STATUS_TRANSITION");
      }
      const refundedSoFar = existing.refunds.reduce(
        (sum, item) => sum + Number(item.amount),
        0,
      );
      const remaining = Number(existing.amount) - refundedSoFar;
      if (amount > remaining) throw new Error("OVER_REFUND");

      const refund = await tx.paymentRefund.create({
        data: {
          paymentId: existing.id,
          bookingId: ids.bookingId,
          amount,
          reason: reason || null,
          createdById: currentUser?.employee?.id,
        },
      });

      const nextStatus =
        amount === remaining
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
      assertPaymentTransition(existing.status, nextStatus);

      const payment = await tx.payment.update({
        where: { id: existing.id },
        data: { status: nextStatus },
        select: paymentSelect,
      });

      await recordPaymentStatusHistory(tx, {
        paymentId: existing.id,
        fromStatus: existing.status,
        toStatus: nextStatus,
        note: reason || null,
        actorId: currentUser?.employee?.id,
      });

      return { payment, refund };
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PROMPTPAY_PAYMENT_REFUNDED",
      entityType: "PAYMENT",
      entityId: result.payment.id,
      metadata: {
        bookingId: ids.bookingId,
        amount,
        refundId: result.refund.id,
      },
    });

    return NextResponse.json({
      payment: serializePaymentListItem(result.payment),
      refund: {
        id: result.refund.id,
        amount: Number(result.refund.amount),
        reason: result.refund.reason,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return apiErrorResponse("ไม่พบรายการชำระเงิน", 404, "NOT_FOUND");
      }
      if (error.message === "INVALID_STATUS_TRANSITION") {
        return apiErrorResponse("คืนเงินในสถานะนี้ไม่ได้", 409, "INVALID_TRANSITION");
      }
      if (error.message === "OVER_REFUND") {
        return apiErrorResponse("ยอดคืนเกินยอดที่ยืนยันแล้ว", 409, "OVER_REFUND");
      }
    }
    console.error("refundPromptPayPayment failed", error);
    return apiErrorResponse("บันทึกคืนเงินไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

export async function getPromptPaySlip(ids: Ids) {
  try {
    const payment = await loadOwnedPayment(ids);
    if (!payment?.slipStoragePath) {
      return apiErrorResponse("ไม่พบสลิป", 404, "NOT_FOUND");
    }
    const signedUrl = await createPaymentSlipSignedUrl(payment.slipStoragePath);
    return NextResponse.json({
      signedUrl,
      fileName: payment.slipFileName,
      contentType: payment.slipContentType,
    });
  } catch (error) {
    console.error("getPromptPaySlip failed", error);
    return apiErrorResponse("เปิดสลิปไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

export async function getPromptPayQr(ids: Ids) {
  try {
    const payment = await loadOwnedPayment(ids);
    if (!payment?.promptpayAccount) {
      return apiErrorResponse("ไม่พบข้อมูล QR", 404, "NOT_FOUND");
    }
    if (
      payment.status !== PaymentStatus.AWAITING_PAYMENT &&
      payment.status !== PaymentStatus.PENDING_VERIFICATION
    ) {
      return apiErrorResponse("สถานะนี้ไม่มี QR ที่ใช้งาน", 409, "INVALID_STATUS");
    }
    const qr = await buildPromptPayQrDataUrl({
      identifier: payment.promptpayAccount.identifier,
      idType: payment.promptpayAccount.idType,
      amount: Number(payment.amount),
    });
    return NextResponse.json({
      dataUrl: qr.dataUrl,
      amount: Number(payment.amount),
      accountName: payment.promptpayAccountNameSnapshot,
      identifierMasked: payment.promptpayIdentifierMasked,
      paymentNumber: payment.paymentNumber,
      bookingId: payment.bookingId,
    });
  } catch (error) {
    console.error("getPromptPayQr failed", error);
    return apiErrorResponse("สร้าง QR ไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
