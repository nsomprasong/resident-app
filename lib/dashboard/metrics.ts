type RevenuePayment = {
  amount: number | string | { toString(): string };
  status: string;
};

export function calculateRate(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((used / total) * 100);
}

export function calculateNetRevenue(payments: RevenuePayment[]) {
  return payments.reduce((sum, payment) => {
    const amount = Number(payment.amount);
    if (payment.status === "PAID") return sum + amount;
    if (payment.status === "REFUNDED") return sum - amount;
    return sum;
  }, 0);
}
