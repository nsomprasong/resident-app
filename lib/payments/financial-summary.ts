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

export type BookingFinancialSummaryInput = {
  charges: ChargeLike[];
  orders: OrderLike[];
  payments: PaymentLike[];
};

function moneyToNumber(value: MoneyValue) {
  return Number(value);
}

export function calculateBookingFinancialSummary({
  charges,
  orders,
  payments,
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
      payment.status === "PAID" ? sum + moneyToNumber(payment.amount) : sum,
    0,
  );
  const refundedTotal = payments.reduce(
    (sum, payment) =>
      payment.status === "REFUNDED" ? sum + moneyToNumber(payment.amount) : sum,
    0,
  );
  const netPaidTotal = paidTotal - refundedTotal;
  const grandTotal = chargeTotal + extraOrderTotal;

  return {
    chargeTotal,
    extraOrderTotal,
    paidTotal,
    refundedTotal,
    netPaidTotal,
    grandTotal,
    outstandingTotal: Math.max(0, grandTotal - netPaidTotal),
    refundableTotal: Math.max(0, netPaidTotal),
  };
}
