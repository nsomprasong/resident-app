import {
  apiErrorResponse,
  readJsonObject,
  validationErrorResponse,
  type ValidationIssue,
} from "@/lib/api/validation";
import { recordAuditLog } from "@/lib/audit/audit-log";
import { getCurrentUser } from "@/lib/auth/current-user";
import { acquireBookingFinancialLock } from "@/lib/payments/financial-locks";
import { calculateBookingFinancialSummary } from "@/lib/payments/financial-summary";
import { buildPromptPayQrDataUrl } from "@/lib/payments/promptpay-qr";
import {
  generatePaymentNumber,
  recordPaymentStatusHistory,
  serializePaymentListItem,
} from "@/lib/payments/promptpay-workflow";
import { maskPromptPayIdentifier } from "@/lib/settings/promptpay-accounts";
import { prisma } from "@/lib/prisma";
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
} from "@/generated/prisma/client";
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

type RouteContext = {
  params: Promise<{ bookingId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { bookingId } = await context.params;
    const [payments, refunds] = await Promise.all([
      prisma.payment.findMany({
        where: { bookingId },
        orderBy: { createdAt: "desc" },
        select: paymentSelect,
      }),
      prisma.paymentRefund.findMany({
        where: { bookingId },
        select: { amount: true },
      }),
    ]);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        charges: true,
        orders: {
          where: { status: { not: "CANCELLED" } },
          include: { items: true },
        },
        payments: true,
      },
    });
    if (!booking) {
      return apiErrorResponse("ไม่พบการจอง", 404, "NOT_FOUND");
    }

    const summary = calculateBookingFinancialSummary({
      charges: booking.charges,
      orders: booking.orders,
      payments: booking.payments,
      paymentRefunds: refunds,
    });

    return NextResponse.json({
      summary,
      payments: payments.map(serializePaymentListItem),
    });
  } catch (error) {
    console.error("GET promptpay-payments failed", error);
    return apiErrorResponse("โหลดรายการชำระเงินไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { bookingId } = await context.params;
    const currentUser = await getCurrentUser();
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;

    const issues: ValidationIssue[] = [];
    const amount = Number(parsed.body.amount);
    const purposeRaw =
      typeof parsed.body.purpose === "string" ? parsed.body.purpose : "PARTIAL";
    const accountId =
      typeof parsed.body.promptpayAccountId === "string"
        ? parsed.body.promptpayAccountId.trim()
        : "";
    const note =
      typeof parsed.body.note === "string" ? parsed.body.note.trim() : undefined;

    if (!Number.isFinite(amount) || amount <= 0) {
      issues.push({ path: "amount", message: "จำนวนเงินต้องมากกว่า 0" });
    }
    if (!Object.values(PaymentPurpose).includes(purposeRaw as PaymentPurpose)) {
      issues.push({ path: "purpose", message: "ประเภทการชำระไม่ถูกต้อง" });
    }
    if (!accountId) {
      issues.push({
        path: "promptpayAccountId",
        message: "กรุณาเลือกบัญชีพร้อมเพย์",
      });
    }
    if (issues.length) {
      return validationErrorResponse("ข้อมูลรับชำระไม่ถูกต้อง", issues);
    }

    const purpose = purposeRaw as PaymentPurpose;

    const result = await prisma.$transaction(async (tx) => {
      await acquireBookingFinancialLock(tx, bookingId);
      const account = await tx.promptPayAccount.findFirst({
        where: { id: accountId, isActive: true },
      });
      if (!account) throw new Error("ACCOUNT_NOT_FOUND");

      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          charges: true,
          payments: true,
          orders: {
            where: { status: { not: "CANCELLED" } },
            include: { items: true },
          },
          paymentRefunds: true,
        },
      });
      if (!booking) throw new Error("NOT_FOUND");
      if (booking.status === "CANCELLED") throw new Error("CANCELLED");

      const summary = calculateBookingFinancialSummary({
        charges: booking.charges,
        orders: booking.orders,
        payments: booking.payments,
        paymentRefunds: booking.paymentRefunds,
      });
      if (summary.outstandingTotal <= 0) throw new Error("ALREADY_PAID");
      if (amount > summary.outstandingTotal) throw new Error("OVERPAY");

      const payment = await tx.payment.create({
        data: {
          paymentNumber: generatePaymentNumber(),
          bookingId,
          amount,
          currency: "THB",
          method: PaymentMethod.PROMPTPAY_QR,
          purpose,
          status: PaymentStatus.AWAITING_PAYMENT,
          promptpayAccountId: account.id,
          promptpayAccountNameSnapshot: account.accountName,
          promptpayIdentifierMasked: maskPromptPayIdentifier(
            account.identifier,
            account.idType,
          ),
          note: note || null,
          createdById: currentUser?.employee?.id,
          reference:
            purpose === PaymentPurpose.DEPOSIT
              ? "มัดจำพร้อมเพย์"
              : purpose === PaymentPurpose.FULL
                ? "ชำระเต็มจำนวนพร้อมเพย์"
                : "ชำระบางส่วนพร้อมเพย์",
        },
        select: paymentSelect,
      });

      await recordPaymentStatusHistory(tx, {
        paymentId: payment.id,
        fromStatus: null,
        toStatus: PaymentStatus.AWAITING_PAYMENT,
        actorId: currentUser?.employee?.id,
      });

      const qr = await buildPromptPayQrDataUrl({
        identifier: account.identifier,
        idType: account.idType,
        amount,
      });

      return { payment, qr, account };
    });

    await recordAuditLog({
      actor: {
        employeeId: currentUser?.employee?.id,
        authUserId: currentUser?.user.id,
      },
      action: "PROMPTPAY_PAYMENT_CREATED",
      entityType: "PAYMENT",
      entityId: result.payment.id,
      metadata: {
        bookingId,
        amount,
        purpose,
        promptpayAccountId: result.account.id,
      },
    });

    return NextResponse.json(
      {
        payment: serializePaymentListItem(result.payment),
        qr: {
          dataUrl: result.qr.dataUrl,
          accountName: result.account.accountName,
          identifierMasked: maskPromptPayIdentifier(
            result.account.identifier,
            result.account.idType,
          ),
          amount,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return apiErrorResponse("ไม่พบการจอง", 404, "NOT_FOUND");
      }
      if (error.message === "ACCOUNT_NOT_FOUND") {
        return apiErrorResponse(
          "ไม่พบบัญชีพร้อมเพย์ที่ใช้งานได้",
          404,
          "ACCOUNT_NOT_FOUND",
        );
      }
      if (error.message === "CANCELLED") {
        return apiErrorResponse("การจองถูกยกเลิกแล้ว", 409, "BOOKING_CANCELLED");
      }
      if (error.message === "ALREADY_PAID") {
        return apiErrorResponse("ชำระครบแล้ว", 409, "ALREADY_PAID");
      }
      if (error.message === "OVERPAY") {
        return apiErrorResponse("ยอดเกินยอดคงเหลือ", 409, "OVERPAY");
      }
      if (
        error.message === "INVALID_AMOUNT" ||
        error.message === "INVALID_IDENTIFIER"
      ) {
        return apiErrorResponse("สร้าง QR ไม่สำเร็จ", 400, error.message);
      }
    }
    console.error("POST promptpay-payments failed", error);
    return apiErrorResponse("สร้างรายการพร้อมเพย์ไม่สำเร็จ", 500, "INTERNAL_ERROR");
  }
}
