import { refundPromptPayPayment } from "@/lib/payments/promptpay-actions";
import { NextRequest } from "next/server";

type RouteContext = {
  params: Promise<{ bookingId: string; paymentId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const ids = await context.params;
  return refundPromptPayPayment(request, ids);
}
