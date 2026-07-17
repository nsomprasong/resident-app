import {
  PaymentStatus,
  type PaymentStatus as PaymentStatusType,
  type Prisma,
} from "@/generated/prisma/client";

const ALLOWED_TRANSITIONS: Readonly<
  Record<PaymentStatusType, ReadonlySet<PaymentStatusType>>
> = {
  PENDING: new Set([PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED]),
  PAID: new Set([PaymentStatus.REFUNDED]),
  FAILED: new Set([PaymentStatus.CANCELLED]),
  REFUNDED: new Set(),
  AWAITING_PAYMENT: new Set([
    PaymentStatus.PENDING_VERIFICATION,
    PaymentStatus.CANCELLED,
  ]),
  PENDING_VERIFICATION: new Set([
    PaymentStatus.VERIFIED,
    PaymentStatus.REJECTED,
    PaymentStatus.CANCELLED,
  ]),
  VERIFIED: new Set([
    PaymentStatus.PENDING_VERIFICATION,
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ]),
  CANCELLED: new Set(),
  REJECTED: new Set(),
  PARTIALLY_REFUNDED: new Set([
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ]),
};

export function canTransitionPaymentStatus(
  from: PaymentStatusType,
  to: PaymentStatusType,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

export function assertPaymentTransition(
  from: PaymentStatusType,
  to: PaymentStatusType,
) {
  if (!canTransitionPaymentStatus(from, to)) {
    throw new Error("INVALID_STATUS_TRANSITION");
  }
}

export function generatePaymentNumber(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `PP${y}${m}${d}-${rand}`;
}

type HistoryClient = {
  paymentStatusHistory: {
    create(args: {
      data: {
        paymentId: string;
        fromStatus?: PaymentStatusType | null;
        toStatus: PaymentStatusType;
        note?: string | null;
        actorId?: string | null;
      };
    }): Promise<unknown>;
  };
};

export async function recordPaymentStatusHistory(
  client: HistoryClient,
  input: {
    paymentId: string;
    fromStatus?: PaymentStatusType | null;
    toStatus: PaymentStatusType;
    note?: string | null;
    actorId?: string | null;
  },
) {
  await client.paymentStatusHistory.create({
    data: {
      paymentId: input.paymentId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      note: input.note ?? null,
      actorId: input.actorId ?? null,
    },
  });
}

export type PaymentListItem = {
  id: string;
  paymentNumber: string | null;
  amount: number;
  currency: string;
  method: string;
  purpose: string | null;
  status: string;
  reference: string | null;
  note: string | null;
  paidAt: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  promptpayAccountNameSnapshot: string | null;
  promptpayIdentifierMasked: string | null;
  hasSlip: boolean;
  createdAt: string;
};

export function serializePaymentListItem(payment: {
  id: string;
  paymentNumber: string | null;
  amount: Prisma.Decimal | number | string;
  currency: string;
  method: string;
  purpose: string | null;
  status: string;
  reference: string | null;
  note: string | null;
  paidAt: Date | null;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  promptpayAccountNameSnapshot: string | null;
  promptpayIdentifierMasked: string | null;
  slipStoragePath: string | null;
  createdAt: Date;
}): PaymentListItem {
  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    purpose: payment.purpose,
    status: payment.status,
    reference: payment.reference,
    note: payment.note,
    paidAt: payment.paidAt?.toISOString() ?? null,
    submittedAt: payment.submittedAt?.toISOString() ?? null,
    verifiedAt: payment.verifiedAt?.toISOString() ?? null,
    promptpayAccountNameSnapshot: payment.promptpayAccountNameSnapshot,
    promptpayIdentifierMasked: payment.promptpayIdentifierMasked,
    hasSlip: Boolean(payment.slipStoragePath),
    createdAt: payment.createdAt.toISOString(),
  };
}
