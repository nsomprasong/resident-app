import { PaymentStatus } from "@/generated/prisma/client";

type MoneyValue = number | string | { toString(): string };

type ChargeLike = {
  amount: MoneyValue;
};

type OrderLike = {
  items: Array<{
    unitPrice: MoneyValue;
    quantity: number;
    isExtra: boolean;
  }>;
};

type PaymentLike = {
  amount: MoneyValue;
  status: string;
};

type RefundLike = {
  amount: MoneyValue;
};

export type BookingFinancialSummaryInput = {
  charges: ChargeLike[];
  orders: OrderLike[];
  payments: PaymentLike[];
  /** Linked refunds for VERIFIED PromptPay payments (Phase 19) */
  paymentRefunds?: RefundLike[];
};

function moneyToNumber(value: MoneyValue) {
  return Number(value);
}

const VERIFIED_STATUSES = new Set<string>([
  PaymentStatus.PAID,
  PaymentStatus.VERIFIED,
  PaymentStatus.PARTIALLY_REFUNDED,
]);

const PENDING_STATUSES = new Set<string>([
  PaymentStatus.PENDING_VERIFICATION,
  PaymentStatus.AWAITING_PAYMENT,
]);

export function isVerifiedPaymentStatus(status: string) {
  return VERIFIED_STATUSES.has(status);
}

export function isPendingPaymentStatus(status: string) {
  return PENDING_STATUSES.has(status);
}

export function calculateBookingFinancialSummary({
  charges,
  orders,
  payments,
  paymentRefunds = [],
}: BookingFinancialSummaryInput) {
  const chargeTotal = charges.reduce(
    (sum, item) => sum + moneyToNumber(item.amount),
    0,
  );
  const extraOrderTotal = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (sub, item) =>
          sub +
          (item.isExtra ? moneyToNumber(item.unitPrice) * item.quantity : 0),
        0,
      ),
    0,
  );
  const paidTotal = payments.reduce(
    (sum, payment) =>
      payment.status === PaymentStatus.PAID ||
      payment.status === PaymentStatus.VERIFIED ||
      payment.status === PaymentStatus.PARTIALLY_REFUNDED
        ? sum + moneyToNumber(payment.amount)
        : sum,
    0,
  );
  const legacyRefundedTotal = payments.reduce(
    (sum, payment) =>
      payment.status === PaymentStatus.REFUNDED
        ? sum + moneyToNumber(payment.amount)
        : sum,
    0,
  );
  const linkedRefundTotal = paymentRefunds.reduce(
    (sum, item) => sum + moneyToNumber(item.amount),
    0,
  );
  const refundedTotal = legacyRefundedTotal + linkedRefundTotal;
  const pendingTotal = payments.reduce(
    (sum, payment) =>
      isPendingPaymentStatus(payment.status)
        ? sum + moneyToNumber(payment.amount)
        : sum,
    0,
  );
  const netPaidTotal = paidTotal - refundedTotal;
  const grandTotal = chargeTotal + extraOrderTotal;

  return {
    chargeTotal,
    extraOrderTotal,
    paidTotal,
    refundedTotal,
    pendingTotal,
    netPaidTotal,
    grandTotal,
    outstandingTotal: Math.max(0, grandTotal - netPaidTotal),
    refundableTotal: Math.max(0, netPaidTotal),
  };
}
